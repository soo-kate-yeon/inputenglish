// @MX:ANCHOR: [AUTO] GET /learning/weekly-prep — Task 6.2 weekly prep entry page.
// @MX:SPEC: SPEC-WEB-001 Phase 6 Task 6.2 (REQ-WEB-006-U1)
import { WeeklyPrepView } from "./WeeklyPrepView";

export default function WeeklyPrepPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 print:px-0 print:py-0">
      <header className="print:hidden">
        <h1 className="text-2xl font-bold">이번 주 예습자료</h1>
        <p className="text-sm text-gray-500">
          이번 주 콘텐츠에서 뽑은 핵심 표현과 단어를 실제 문장과 함께
          확인하세요.
        </p>
      </header>
      <WeeklyPrepView />
    </div>
  );
}
