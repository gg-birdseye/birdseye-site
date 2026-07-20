"use client";

type PanelCloseButtonProps = {
  onClose?: () => void;
  label: string;
};

export function PanelCloseButton({ onClose, label }: PanelCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="course-panel-close"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}
