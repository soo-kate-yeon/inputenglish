"use client";

import { useRouter } from "next/navigation";

interface ListeningHeaderProps {
  title: string;
  onBack?: () => void;
  onNextStep?: () => void;
}

export function ListeningHeader({
  title,
  onBack,
  onNextStep,
}: ListeningHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className="h-14 flex items-center justify-between shrink-0 relative z-10"
      style={{
        backgroundColor: "#faf9f5",
        borderBottom: "1px solid #dfdedb",
        padding: "0 24px",
      }}
    >
      <div className="flex items-center overflow-hidden" style={{ gap: 16 }}>
        <button
          onClick={handleBack}
          className="font-medium transition-colors shrink-0"
          style={{
            backgroundColor: "#b45000",
            color: "#faf9f5",
            padding: "8px 16px",
            borderRadius: 12,
            fontSize: 14,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#964100")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#b45000")
          }
        >
          학습 종료
        </button>
        <h1
          className="font-semibold tracking-tight truncate"
          style={{
            fontSize: 17,
            lineHeight: 1.62,
            color: "#0c0b09",
            maxWidth: 640,
          }}
        >
          {title}
        </h1>
      </div>

      <div
        className="flex items-center"
        style={{
          backgroundColor: "#f0efeb",
          padding: 4,
          borderRadius: 12,
        }}
      >
        <div
          className="font-semibold"
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            fontSize: 14,
            backgroundColor: "#ffffff",
            color: "#b45000",
          }}
        >
          리스닝 모드
        </div>
        <button
          onClick={onNextStep}
          className="font-medium transition-colors"
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            fontSize: 14,
            color: "#72716e",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#0c0b09")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#72716e")}
        >
          쉐도잉 모드
        </button>
      </div>
    </header>
  );
}
