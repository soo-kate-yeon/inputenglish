// @MX:ANCHOR: [AUTO] GET /learning/history — Task 5.6 question-history tab entry page.
// @MX:REASON: [AUTO] EC-004-C: this page (and the learning screen) must NOT expose
//   flashcards, recall quizzes, or an "expression dictionary" curation UI — only the
//   question-history list itself (QuestionHistoryList).
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.6 (REQ-WEB-004-U3, EC-004-C)
import { QuestionHistoryList } from "./QuestionHistoryList";

export default function QuestionHistoryPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">질문 기록</h1>
        <p className="text-sm text-gray-500">
          학습 중 남긴 하이라이트 질문을 모아봤어요.
        </p>
      </header>
      <QuestionHistoryList />
    </div>
  );
}
