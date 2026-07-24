import { Pool } from 'pg';
import type { AnswerKey, LessonState } from '../domain/types';
import type { Chunk } from './chunking';

export interface AttemptRecord {
  mcqId: string;
  objectiveId: string;
  selectedChoiceId: string;
  correct: boolean;
  attemptNo: number;
}

/**
 * Persistence for everything the graph state deliberately does NOT hold: PDF
 * chunks, the private answer keys, per-answer attempts, and the serialized lesson
 * state (which powers resume-after-refresh).
 */
export interface LessonStore {
  init(): Promise<void>;
  saveChunks(documentId: string, chunks: Chunk[]): Promise<void>;
  getChunks(documentId: string): Promise<Chunk[]>;
  saveAnswerKey(key: AnswerKey): Promise<void>;
  getAnswerKey(mcqId: string): Promise<AnswerKey | null>;
  saveAttempt(lessonId: string, attempt: AttemptRecord): Promise<void>;
  getAttempts(lessonId: string): Promise<AttemptRecord[]>;
  saveLesson(lessonId: string, state: LessonState): Promise<void>;
  getLesson(lessonId: string): Promise<LessonState | null>;
}

/** In-memory store — the zero-setup fallback so a reviewer can run without Docker. */
class MemoryStore implements LessonStore {
  private chunks = new Map<string, Chunk[]>();
  private answerKeys = new Map<string, AnswerKey>();
  private attempts = new Map<string, AttemptRecord[]>();
  private lessons = new Map<string, LessonState>();

  async init() {}
  async saveChunks(documentId: string, chunks: Chunk[]) {
    this.chunks.set(documentId, chunks);
  }
  async getChunks(documentId: string) {
    return this.chunks.get(documentId) ?? [];
  }
  async saveAnswerKey(key: AnswerKey) {
    this.answerKeys.set(key.mcqId, key);
  }
  async getAnswerKey(mcqId: string) {
    return this.answerKeys.get(mcqId) ?? null;
  }
  async saveAttempt(lessonId: string, attempt: AttemptRecord) {
    const list = this.attempts.get(lessonId) ?? [];
    list.push(attempt);
    this.attempts.set(lessonId, list);
  }
  async getAttempts(lessonId: string) {
    return this.attempts.get(lessonId) ?? [];
  }
  async saveLesson(lessonId: string, state: LessonState) {
    this.lessons.set(lessonId, state);
  }
  async getLesson(lessonId: string) {
    return this.lessons.get(lessonId) ?? null;
  }
}

/** Postgres store — the on-stack path, used when DATABASE_URL is set. */
class PostgresStore implements LessonStore {
  private pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        document_id TEXT NOT NULL,
        chunk_id TEXT NOT NULL,
        page INT NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (document_id, chunk_id)
      );
      CREATE TABLE IF NOT EXISTS answer_keys (
        mcq_id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id BIGSERIAL PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS lessons (
        lesson_id TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async saveChunks(documentId: string, chunks: Chunk[]) {
    for (const c of chunks) {
      await this.pool.query(
        `INSERT INTO document_chunks (document_id, chunk_id, page, text)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (document_id, chunk_id) DO UPDATE SET page = EXCLUDED.page, text = EXCLUDED.text`,
        [documentId, c.chunkId, c.page, c.text],
      );
    }
  }
  async getChunks(documentId: string) {
    const { rows } = await this.pool.query(
      `SELECT chunk_id, page, text FROM document_chunks WHERE document_id = $1 ORDER BY page, chunk_id`,
      [documentId],
    );
    return rows.map((r) => ({ chunkId: r.chunk_id, page: r.page, text: r.text }));
  }
  async saveAnswerKey(key: AnswerKey) {
    await this.pool.query(
      `INSERT INTO answer_keys (mcq_id, data) VALUES ($1,$2)
       ON CONFLICT (mcq_id) DO UPDATE SET data = EXCLUDED.data`,
      [key.mcqId, key],
    );
  }
  async getAnswerKey(mcqId: string) {
    const { rows } = await this.pool.query(`SELECT data FROM answer_keys WHERE mcq_id = $1`, [mcqId]);
    return rows[0] ? (rows[0].data as AnswerKey) : null;
  }
  async saveAttempt(lessonId: string, attempt: AttemptRecord) {
    await this.pool.query(`INSERT INTO attempts (lesson_id, data) VALUES ($1,$2)`, [lessonId, attempt]);
  }
  async getAttempts(lessonId: string) {
    const { rows } = await this.pool.query(
      `SELECT data FROM attempts WHERE lesson_id = $1 ORDER BY id`,
      [lessonId],
    );
    return rows.map((r) => r.data as AttemptRecord);
  }
  async saveLesson(lessonId: string, state: LessonState) {
    await this.pool.query(
      `INSERT INTO lessons (lesson_id, state, updated_at) VALUES ($1,$2, now())
       ON CONFLICT (lesson_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [lessonId, state],
    );
  }
  async getLesson(lessonId: string) {
    const { rows } = await this.pool.query(`SELECT state FROM lessons WHERE lesson_id = $1`, [lessonId]);
    return rows[0] ? (rows[0].state as LessonState) : null;
  }
}

let store: LessonStore | null = null;
let initialized: Promise<void> | null = null;

/** Get the process-wide store, choosing Postgres when DATABASE_URL is set. */
export function getStore(): LessonStore {
  if (!store) {
    const url = process.env.DATABASE_URL;
    store = url ? new PostgresStore(url) : new MemoryStore();
    initialized = store.init();
  }
  return store;
}

/** Ensure the store's schema is ready before first use. */
export async function ready(): Promise<LessonStore> {
  const s = getStore();
  if (initialized) await initialized;
  return s;
}
