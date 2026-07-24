# Lumen

**Turn any PDF into an interactive, guided lesson.**

Chat assistants are great at answering questions, but they don't give you a *structured, persistent* way
to actually learn a document. Lumen does: upload a PDF, and an agent reads it, proposes a learning path you
approve, then quizzes you one objective at a time — with questions drawn straight from the source, feedback
on every answer, and a tutor that helps without ever handing you the answer.

![Lumen](docs/screenshot.png)

## What it does

1. **Ingest** — upload a PDF; Lumen extracts the text page-by-page and reports what it found.
2. **Plan** — it drafts a short list of learning objectives, each grounded in specific pages of your document.
3. **Approve** — you review the plan and remove anything you don't want before the lesson starts (human-in-the-loop).
4. **Quiz** — for each objective it generates a multiple-choice question from the source material.
5. **Feedback** — a correct answer shows an explanation; a wrong one shows a hint and lets you retry, no penalty.
6. **Tutor** — ask the docked tutor to explain a concept or for a nudge. It teaches, but it *will not* reveal the answer.
7. **Summarize** — at the end you get a report: first-try accuracy, per-objective mastery, topics to review, and study tips.

## How it works

Lumen is built around a small **pure core** with framework/IO code as thin adapters around it — so the
important logic is simple to read and fully unit-tested.

```
Browser (Next.js + React)
  Upload → Plan review → Quiz card → Results dashboard  + docked Tutor
        │  fetch /api/*
API routes (Next.js route handlers)
        │
Lesson service ──> LangGraph.js graph (plan + human-approval interrupt)
        │          └─ OpenRouter LLM (objectives, questions) validated with Zod
        │
Pure domain core (no framework imports):
   state machine · grading · answer-privacy · hint guard · summary
        │
Store: PostgreSQL  ── or ──  in-memory (zero-setup fallback)
```

A few deliberate design decisions:

- **The correct answer never reaches the browser.** Each question is split into a *public* part (question +
  choices) and a server-only *answer key* (correct choice, explanation, hints). The client submits its choice
  and the **server grades it in code** — deterministically, not with an LLM. You can't find the answer in any
  network response or in page state.
- **The model proposes, code decides.** The LLM writes the objectives and questions; plain functions own the
  control flow, the grading, and the pass/fail of each generated question.
- **Generated questions are self-checked.** Every MCQ passes a validator (the correct choice is real, choices
  are unique, an explanation exists, and no hint leaks the answer) and is regenerated if it fails.
- **The tutor is guarded.** Its replies are grounded in the PDF and checked against the answer key before they
  are sent — if the answer ever slips through, Lumen refuses instead of revealing it.
- **Questions are grounded.** Objectives and questions cite the pages they come from, so the quiz reflects the
  document rather than the model's general knowledge.

## Getting started

Requires **Node 22+**. An [OpenRouter](https://openrouter.ai/keys) API key (or any OpenAI-compatible endpoint)
is needed to generate lessons.

```bash
npm install
cp .env.example .env      # then add your OPENROUTER_API_KEY
npm run dev               # http://localhost:3000
```

Try it with the included documents in [`samples/`](samples/) — a simple one (`water-cycle.pdf`) and denser
ones (`neural-networks.pdf`, `french-revolution.pdf`, `photosynthesis.pdf`).

### Persistence (optional)

By default Lumen uses an in-memory store, so it runs with zero setup. To persist lessons across restarts —
and resume a lesson after a page refresh — start Postgres and point `DATABASE_URL` at it:

```bash
docker compose up -d
# in .env:  DATABASE_URL=postgresql://lesson:lesson@localhost:5432/lesson
```

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | API key for the LLM (required) | — |
| `OPENROUTER_BASE_URL` | OpenAI-compatible base URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | Model id | `openai/gpt-4o-mini` |
| `DATABASE_URL` | Postgres connection string; omit to use the in-memory store | — |

## Tech stack

TypeScript · Next.js (App Router) · React · Tailwind CSS · LangGraph.js · PostgreSQL · Zod · Vitest ·
OpenRouter.

## Testing

```bash
npm test          # unit + boundary tests (no network; LLM calls are faked)
npm run test:watch
```

The pure domain core (state machine, grading, answer-privacy, hint guard, summary) is covered directly, and
the LLM-boundary logic (question validation, retries) is tested with fake structured responses so tests are
fast and deterministic.

## Project layout

```
src/
  domain/      pure logic: types, lessonMachine, grading, mcq (answer privacy), hintGuard, summary
  lib/         adapters: pdf, chunking, llm, prompts, db (postgres + in-memory), lessonService, api
  agent/       LangGraph graph + nodes (plan, mcq generation + self-eval validator)
  app/         Next.js routes + API; page.tsx orchestrates the flow
  components/   UploadScreen, PlanReview, QuizCard, ResultsDashboard, TutorPanel
tests/         domain + boundary tests
samples/       example PDFs
```
