import React from "react";
import { Button } from "./ui";

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = "🔍",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-stone-200 rounded-2xl bg-white/50 max-w-md mx-auto my-8 animate-[fadeIn_150ms_ease-out]">
      <div className="text-4xl mb-4 bg-stone-50 h-16 w-16 rounded-full flex items-center justify-center shadow-sm select-none">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-stone-800 mb-1">{title}</h3>
      <p className="text-xs text-stone-500 max-w-xs mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="text-xs px-4 py-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
