type ScrollFlyHintProps = {
  label?: string;
};

function ChevronStack({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 28"
      className={className}
      width={48}
      height={28}
      aria-hidden
    >
      <path
        d="M24 2 L44 14 L4 14 Z"
        fill="currentColor"
        opacity={0.35}
      />
      <path
        d="M24 10 L44 22 L4 22 Z"
        fill="currentColor"
        opacity={0.75}
      />
    </svg>
  );
}

export function ScrollFlyHint({ label = "SCROLL TO FLY" }: ScrollFlyHintProps) {
  return (
    <div className="flex flex-col items-center gap-3 md:gap-4">
      <span className="inline-flex animate-scroll-hint-up">
        <ChevronStack className="h-5 w-10 text-white md:h-6 md:w-12" />
      </span>
      <p className="text-[10px] font-medium uppercase tracking-[0.45em] text-white/85 md:text-xs">
        {label}
      </p>
      <span className="inline-flex animate-scroll-hint-down">
        <ChevronStack className="h-5 w-10 rotate-180 text-white md:h-6 md:w-12" />
      </span>
    </div>
  );
}
