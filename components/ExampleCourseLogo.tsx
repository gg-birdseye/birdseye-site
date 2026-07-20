type Props = {
  className?: string;
};

/** Inline SVG so text renders reliably (external SVG `<img>` often drops text). */
export function ExampleCourseLogo({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Example Course"
    >
      <path
        d="M200 210 L200 90"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M200 90 L260 108 L200 126 Z" fill="#ffffff" />
      <text
        x="200"
        y="278"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="31"
        fontWeight="700"
        letterSpacing="5"
      >
        EXAMPLE
      </text>
      <text
        x="200"
        y="322"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="31"
        fontWeight="700"
        letterSpacing="5"
      >
        COURSE
      </text>
    </svg>
  );
}
