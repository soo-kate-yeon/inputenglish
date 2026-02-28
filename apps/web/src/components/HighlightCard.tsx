import React, { useState } from "react";
import { Trash2 } from "lucide-react";

interface HighlightCardProps {
  highlightedSentence: string;
  userCaption?: string;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function HighlightCard({
  highlightedSentence,
  userCaption,
  onClick,
  onDelete,
}: HighlightCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
                flex flex-col gap-3 cursor-pointer p-3 rounded-xl transition-colors relative group
                ${isHovered ? "bg-secondary-100" : "bg-transparent"}
            `}
    >
      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={handleDeleteClick}
          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-secondary-500 hover:text-error p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Highlight Text */}
      <div className="flex gap-3 items-start h-auto pr-6">
        <div className="w-1 bg-accent-highlight shrink-0 rounded-full self-stretch min-h-[24px]" />
        <p className="text-sm font-normal text-neutral-900 leading-snug pt-0.5 break-words">
          {highlightedSentence}
        </p>
      </div>

      {/* User Note (if exists) */}
      {userCaption && (
        <div className="h-auto relative w-full pl-[26px]">
          <div className="absolute left-[16px] top-0 w-[18px] h-[18px] flex items-center justify-center -ml-4">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 18 18">
              <path
                d="M1 4 L1 14 L11 14"
                stroke="#D8D8D8"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </div>
          <p className="text-base font-normal text-secondary-500 leading-tight font-['SF_Pro_Display'] break-words">
            {userCaption}
          </p>
        </div>
      )}
    </div>
  );
}
