"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

interface CommentPopoverProps {
  initialValue?: string;
  onSubmit: (comment: string) => void;
  onClose?: () => void;
}

export function CommentPopover({
  initialValue = "",
  onSubmit,
  onClose,
}: CommentPopoverProps) {
  const [comment, setComment] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        onClose
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = () => {
    if (comment.trim()) {
      onSubmit(comment);
    }
  };

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-200"
      style={{ marginTop: 8 }}
    >
      <div
        ref={popoverRef}
        className="flex items-center"
        style={{
          maxWidth: 400,
          gap: 8,
          padding: 12,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          border: "1px solid #dfdedb",
          boxShadow:
            "0 4px 6px -2px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="코멘트 추가하기"
          className="flex-1 bg-transparent border-none outline-none"
          style={{
            fontSize: 16,
            lineHeight: 1.64,
            color: "#0c0b09",
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button
          onClick={handleSubmit}
          disabled={!comment.trim()}
          className="flex items-center justify-center transition-colors"
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: comment.trim() ? "#b45000" : "#b8b7b4",
            cursor: comment.trim() ? "pointer" : "not-allowed",
          }}
        >
          <ArrowUp className="w-4 h-4" style={{ color: "#faf9f5" }} />
        </button>
      </div>
    </div>
  );
}
