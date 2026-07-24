import {
  Annotation,
  StateGraph,
  interrupt,
  Command,
  MemorySaver,
  START,
  END,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { planLesson } from './nodes/plan';
import { ready } from '../lib/db';
import type { LessonPlan } from '../domain/types';

/**
 * A small LangGraph workflow for the planning + human-approval step. This is where
 * LangGraph earns its place: `interrupt()` pauses the graph after drafting a plan,
 * and a checkpointer (Postgres in production, in-memory otherwise) makes that pause
 * durable — the graph resumes exactly where it stopped, even after a refresh.
 *
 * The graded quiz loop that follows is deterministic application code over a tested
 * state machine (see lessonService), not agent-to-agent delegation.
 */
const PlanState = Annotation.Root({
  documentId: Annotation<string>(),
  plan: Annotation<LessonPlan | null>({ reducer: (_prev, next) => next, default: () => null }),
});

async function draftPlan(state: typeof PlanState.State) {
  const store = await ready();
  const chunks = await store.getChunks(state.documentId);
  const plan = await planLesson(chunks);
  return { plan };
}

async function approve(state: typeof PlanState.State) {
  // Pause for the human. The resume value may carry an edited plan.
  const decision = interrupt({ kind: 'approve_plan', plan: state.plan }) as {
    editedPlan?: LessonPlan;
  };
  return { plan: decision?.editedPlan ?? state.plan };
}

const workflow = new StateGraph(PlanState)
  .addNode('draftPlan', draftPlan)
  .addNode('approve', approve)
  .addEdge(START, 'draftPlan')
  .addEdge('draftPlan', 'approve')
  .addEdge('approve', END);

let compiled: ReturnType<typeof workflow.compile> | null = null;

async function getGraph() {
  if (!compiled) {
    const url = process.env.DATABASE_URL;
    let checkpointer: BaseCheckpointSaver;
    if (url) {
      const pg = PostgresSaver.fromConnString(url);
      await pg.setup();
      checkpointer = pg;
    } else {
      checkpointer = new MemorySaver();
    }
    compiled = workflow.compile({ checkpointer });
  }
  return compiled;
}

/** Run the graph until it pauses for plan approval; returns the drafted plan. */
export async function startPlanning(lessonId: string, documentId: string): Promise<LessonPlan> {
  const graph = await getGraph();
  const config = { configurable: { thread_id: lessonId } };
  await graph.invoke({ documentId }, config);
  const snap = await graph.getState(config);
  return snap.values.plan as LessonPlan;
}

/** Resume the paused graph with the user's approval (optionally an edited plan). */
export async function approvePlan(lessonId: string, editedPlan?: LessonPlan): Promise<LessonPlan> {
  const graph = await getGraph();
  const config = { configurable: { thread_id: lessonId } };
  await graph.invoke(new Command({ resume: { editedPlan } }), config);
  const snap = await graph.getState(config);
  return snap.values.plan as LessonPlan;
}
