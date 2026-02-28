import React from "react";

interface VideoCardProps {
  thumbnailUrl?: string;
  title: string;
  duration: string;
  description: string;
  sentenceCount?: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

export default function VideoCard({
  thumbnailUrl,
  title,
  duration,
  description,
  sentenceCount,
  onClick,
  onMouseEnter,
}: VideoCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="flex flex-col group cursor-pointer rounded-lg overflow-hidden border-border-default transition-colors hover:border-interactive-default"
      style={{
        borderWidth: "var(--border-width-card)",
        borderStyle: "solid",
      }}
    >
      {/* Thumbnail Container */}
      <div className="relative w-full aspect-video overflow-hidden bg-bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-medium text-text-subtle">
            No Image
          </div>
        )}

        {/* Tags on Thumbnail */}
        <div className="absolute top-1 right-1 flex gap-1.5">
          {sentenceCount !== undefined && (
            <span className="px-1 py-1 rounded-md text-xs font-regular bg-bg-inverse text-text-inverse">
              {sentenceCount}문장
            </span>
          )}
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-1 right-1 px-1 py-1 rounded-md text-xs font-regular bg-bg-inverse text-text-inverse">
          {duration}
        </div>
      </div>

      {/* Content Area — separated by border-top */}
      <div
        className="flex flex-col gap-1 p-3 border-border-default"
        style={{
          borderTopWidth: "var(--border-width-card)",
          borderTopStyle: "solid",
        }}
      >
        <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:opacity-70 transition-opacity text-text-default">
          {title}
        </h3>

        {description && (
          <p className="text-xs leading-relaxed line-clamp-2 text-text-subtle">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
