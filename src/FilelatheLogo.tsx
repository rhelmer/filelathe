type FilelatheLogoProps = {
  className?: string;
  title?: string;
};

/** Inline brand mark — file on a lathe axis with a cutting tool. */
export function FilelatheLogo({
  className = "h-10 w-10 text-primary",
  title = "Filelathe",
}: FilelatheLogoProps) {
  const titleId = "filelathe-logo-mark";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{title}</title>
      <path
        d="M18 8h18l12 12v32a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d="M36 8v10a2 2 0 0 0 2 2h10"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx={14}
        cy={36}
        r={5.5}
        stroke="currentColor"
        strokeWidth={2.5}
        fill="none"
      />
      <circle cx={14} cy={36} r={2} fill="currentColor" />
      <path
        d="M19.5 36H46"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path d="M46 36h6l3-3.5V39.5L52 36Z" fill="currentColor" />
      <path
        d="M24 28h16M24 44h12"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.45}
      />
    </svg>
  );
}
