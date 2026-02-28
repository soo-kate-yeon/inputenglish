"use client";

interface SaveToggleProps {
  sentenceId: string;
  isSaved?: boolean;
  onToggle?: (sentenceId: string, isSaved: boolean) => void;
}

export default function SaveToggle({
  sentenceId,
  isSaved = false,
  onToggle,
}: SaveToggleProps) {
  const handleToggle = () => {
    const newState = !isSaved;
    onToggle?.(sentenceId, newState);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center justify-center transition-all duration-200"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: isSaved ? "#b45000" : "#f0efeb",
        color: isSaved ? "#faf9f5" : "#565552",
        boxShadow: isSaved ? "0 1px 2px 0 rgba(0, 0, 0, 0.1)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isSaved) {
          e.currentTarget.style.backgroundColor = "#dfdedb";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSaved) {
          e.currentTarget.style.backgroundColor = "#f0efeb";
        }
      }}
      aria-label={isSaved ? "Remove from saved" : "Save sentence"}
      title={isSaved ? "저장됨" : "저장"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 2.5C3 2.22386 3.22386 2 3.5 2H12.5C12.7761 2 13 2.22386 13 2.5V13.5L8 10.5L3 13.5V2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={isSaved ? "currentColor" : "none"}
        />
      </svg>
    </button>
  );
}
