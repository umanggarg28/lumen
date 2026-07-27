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
- **The model generates; application code controls.** The LLM writes the objectives and questions, but plain,
  tested functions own the control flow, the grading, and the accept/reject decision on each generated question.
- **Generated questions are self-checked, in two layers.** First a structural validator (the correct choice is
  real, choices are unique, an explanation exists, no hint leaks the answer). Then a second, independent LLM
  pass — a *faithfulness check* — that judges whether the proposed correct answer is actually supported by the
  cited source, and that no other choice is equally defensible. A question is regenerated if either gate fails.
  (The judge is itself an LLM, so this lowers the risk of a confident-but-wrong answer rather than eliminating
  it; higher-stakes use would add human review.) These checks are observable at **`/observability`**, which shows
  how many questions each gate caught and the specific questions the faithfulness check rejected — because that
  check runs only after the structural one passes, every catch there is a question the naive pipeline would have
  served.
- **The tutor is guarded.** Its replies are grounded in the PDF and checked against the answer key before they
  are sent — if the answer ever slips through, Lumen refuses instead of revealing it.
- **Questions are grounded.** Objectives and questions cite the pages they come from, so the quiz reflects the
  document rather than the model's general knowledge.

### On the stack

LangGraph.js drives the plan and the human-approval interrupt; PostgreSQL is supported for persistence (with a
zero-setup in-memory fallback). For the UI I went with a custom React front end rather than a generative-UI
layer, for one deliberate reason: it keeps the answer-privacy and hint guards running deterministically on the
server. The correct answer and any un-shown hints never enter the client bundle or the agent's UI state — the
browser only ever receives a question and its choices. That's a safety property I'd rather guarantee in code
than delegate to a rendering layer. The tradeoff is a bit more UI code, which felt worth it for an app whose
whole point is trustworthy assessment.

## Getting started

Requires **Node 22+**. An [OpenRouter](https://openrouter.ai/keys) API key (or any OpenAI-compatible endpoint)
is needed to generate lessons.

```bash
npm install
cp .env.example .env      # then add your OPENROUTER_API_KEY
npm run dev               # http://localhost:3000
```

Try it with the included documents in [`samples/`](samples/) — short single-page ones (`water-cycle.pdf`,
`photosynthesis.pdf`, `neural-networks.pdf`, `french-revolution.pdf`) and multi-page ones (`cell-biology.pdf`,
`money-and-inflation.pdf`). Or drop in any text-based PDF of your own.

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
  lib/         adapters: pdf, chunking, llm, prompts, db (postgres + in-memory),
               lessonService, metrics, api (client)
  agent/       LangGraph graph + nodes (plan; mcq generation + structural & faithfulness self-eval)
  app/         Next.js routes + API (api/lesson, api/upload, api/metrics); page.tsx orchestrates the flow
  components/   UploadScreen, PlanReview, QuizCard, ResultsDashboard, TutorPanel, ThemeToggle, Spinner
tests/         domain + boundary + lib tests
samples/       example PDFs (single- and multi-page)
```

## Known limitations & next steps

Scoped deliberately for a focused build; here's what I'd harden next:

- **Prompt injection via the PDF.** The document's text flows into the planning, question, and tutor prompts.
  A maliciously crafted PDF could try to steer the model (e.g. instruct the tutor to reveal an answer). The
  deterministic guards (server-side grading, the answer-leak check on hints/tutor replies) contain the worst
  case, but a production version would add input sanitization and stronger output classification.
- **The answer-leak guard is a substring check.** `isHintSafe` catches a reply that contains the correct
  choice's text. It's a backstop, not a semantic one — a paraphrased leak could slip through, and it can be
  over-eager. Embedding similarity or a small classifier would be the production upgrade.
- **In-memory store is per-process.** The zero-setup fallback lives in module memory, so on a serverless/
  multi-instance deployment it won't share state across cold starts — use the PostgreSQL path there.
- **Faithfulness judge is itself an LLM.** It lowers the odds of a confident-but-wrong question; it doesn't
  eliminate them. High-stakes use would add self-consistency and human review.
