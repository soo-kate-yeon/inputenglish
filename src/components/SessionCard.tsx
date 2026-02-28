import React from "react";

interface SessionCardProps {
  thumbnailUrl?: string;
  title: string;
  description?: string;
  totalSentences?: number;
  timeLeft?: string;
  progress?: number;
  onClick?: () => void;
  isEditMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onMouseEnter?: () => void;
}

export default function SessionCard({
  thumbnailUrl,
  title,
  onClick,
  isEditMode = false,
  isSelected = false,
  onToggleSelection,
  onMouseEnter,
}: SessionCardProps) {
  return (
    <div
      className={`group w-[280px] shrink-0 rounded-lg overflow-hidden border-border-default transition-colors hover:border-interactive-default ${isEditMode ? "cursor-pointer" : ""}`}
      style={{
        borderWidth: "var(--border-width-card)",
        borderStyle: "solid",
      }}
      onClick={isEditMode ? onToggleSelection : undefined}
      onMouseEnter={onMouseEnter}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video overflow-hidden bg-bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-medium text-text-subtle">
            No Image
          </div>
        )}

        {/* Edit Checkbox overlay */}
        {isEditMode && (
          <div className="absolute top-2 left-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
              style={{
                borderWidth: "var(--border-width-default)",
                borderStyle: "solid",
                backgroundColor: isSelected
                  ? "var(--color-interactive-default)"
                  : "var(--color-bg-default)",
                borderColor: isSelected
                  ? "var(--color-interactive-default)"
                  : "var(--color-border-muted)",
              }}
            >
              {isSelected && (
                <svg
                  width="14"
                  height="11"
                  viewBox="0 0 14 11"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5.5L5 9.5L13 1.5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Hover Overlay with Start Button */}
        {!isEditMode && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            style={{ backgroundColor: "rgba(12, 11, 9, 0.6)" }}
            onClick={onClick}
          >
            <button className="rounded-lg text-sm font-semibold px-3 py-2 bg-bg-default text-text-default">
              시작
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className="p-3 border-border-default"
        style={{
          borderTopWidth: "var(--border-width-card)",
          borderTopStyle: "solid",
        }}
      >
        <h3 className="text-sm font-semibold line-clamp-2 leading-snug text-text-default">
          {title}
        </h3>
        <p className="text-xs mt-1 text-text-subtle">
          이 영상으로 마저 공부할까요?
        </p>
      </div>
    </div>
  );
}
