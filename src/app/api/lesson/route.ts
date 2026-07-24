import { NextRequest, NextResponse } from 'next/server';
import {
  startLesson,
  approveLessonPlan,
  submitAnswer,
  retryQuestion,
  continueLesson,
  getLessonView,
  tutorReply,
} from '../../../lib/lessonService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    switch (body.action) {
      case 'start':
        return NextResponse.json(await startLesson(body.documentId));
      case 'approve':
        return NextResponse.json(await approveLessonPlan(body.lessonId, body.editedPlan));
      case 'answer':
        return NextResponse.json(await submitAnswer(body.lessonId, body.selectedChoiceId));
      case 'retry':
        return NextResponse.json(await retryQuestion(body.lessonId));
      case 'continue':
        return NextResponse.json(await continueLesson(body.lessonId));
      case 'tutor':
        return NextResponse.json({ reply: await tutorReply(body.lessonId, body.message) });
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const lessonId = req.nextUrl.searchParams.get('lessonId');
  if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 });
  const v = await getLessonView(lessonId);
  return v ? NextResponse.json(v) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
