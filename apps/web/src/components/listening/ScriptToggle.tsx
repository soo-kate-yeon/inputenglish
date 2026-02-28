"use client";

import { Eye, EyeOff } from "lucide-react";

interface ScriptToggleProps {
  isScriptVisible: boolean;
  onToggle: () => void;
}

export function ScriptToggle({ isScriptVisible, onToggle }: ScriptToggleProps) {
  return (
    <div
      className="flex items-center justify-between sticky top-0 z-10 shrink-0"
      style={{
        padding: "16px 24px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #dfdedb",
      }}
    >
      <span
        className="font-semibold"
        style={{
          fontSize: 16,
          lineHeight: 1.64,
          color: "#0c0b09",
        }}
      >
        {isScriptVisible ? "스크립트 보기" : "스크립트 숨김"}
      </span>
      <button
        onClick={onToggle}
        className="flex items-center font-medium transition-all"
        style={{
          gap: 8,
          padding: "8px 16px",
          borderRadius: 12,
          fontSize: 14,
          backgroundColor: isScriptVisible ? "#b45000" : "#f0efeb",
          color: isScriptVisible ? "#faf9f5" : "#565552",
        }}
        onMouseEnter={(e) => {
          if (isScriptVisible) {
            e.currentTarget.style.backgroundColor = "#964100";
          } else {
            e.currentTarget.style.backgroundColor = "#dfdedb";
          }
        }}
        onMouseLeave={(e) => {
          if (isScriptVisible) {
            e.currentTarget.style.backgroundColor = "#b45000";
          } else {
            e.currentTarget.style.backgroundColor = "#f0efeb";
          }
        }}
        aria-label={isScriptVisible ? "스크립트 숨기기" : "스크립트 보기"}
      >
        {isScriptVisible ? (
          <>
            <Eye className="w-5 h-5" />
            <span>보이는 중</span>
          </>
        ) : (
          <>
            <EyeOff className="w-5 h-5" />
            <span>숨김</span>
          </>
        )}
      </button>
    </div>
  );
}
