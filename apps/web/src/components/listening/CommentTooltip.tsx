"use client";

interface CommentTooltipProps {
  originalText: string;
  comment: string;
  onClose: () => void;
}

export function CommentTooltip({
  originalText,
  comment,
  onClose,
}: CommentTooltipProps) {
  return (
    <div className="absolute z-50 -top-2 left-0 right-0 transform -translate-y-full">
      <div
        className="relative"
        style={{
          maxWidth: 400,
          padding: 16,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          border: "1px solid #dfdedb",
          boxShadow:
            "0 4px 6px -2px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute transition-colors"
          style={{
            top: 8,
            right: 8,
            color: "#908f8c",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#565552")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#908f8c")}
          aria-label="Close"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div style={{ paddingRight: 24 }}>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.64,
              color: "#0c0b09",
              marginBottom: 8,
            }}
          >
            {originalText}
          </p>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.67,
              color: "#565552",
              paddingLeft: 16,
              borderLeft: "2px solid #ffc6a9",
            }}
          >
            {comment}
          </p>
        </div>

        {/* Arrow pointing down */}
        <div
          className="absolute transform rotate-45"
          style={{
            bottom: -8,
            left: 32,
            width: 16,
            height: 16,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #dfdedb",
            borderBottom: "1px solid #dfdedb",
          }}
        />
      </div>
    </div>
  );
}
