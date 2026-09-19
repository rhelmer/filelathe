/** Geometric “assembling a component” loader — pure SVG, no Lottie dependency. */
export function InventingAnimation({
  label = "Inventing component…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg
        viewBox="0 0 160 120"
        width="160"
        height="120"
        className="overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="invent-stroke"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.55 0.14 250)" />
            <stop offset="100%" stopColor="oklch(0.45 0.12 200)" />
          </linearGradient>
          <linearGradient id="invent-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.97 0.02 250)" />
            <stop offset="100%" stopColor="oklch(0.92 0.03 220)" />
          </linearGradient>
        </defs>

        {/* Soft pulse behind the card */}
        <circle cx="80" cy="62" r="46" fill="oklch(0.55 0.1 240 / 0.08)">
          <animate
            attributeName="r"
            values="40;48;40"
            dur="2.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.35;0.7;0.35"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Orbiting sparks */}
        <g>
          <circle r="2.5" fill="oklch(0.55 0.16 250)">
            <animateMotion
              dur="2.8s"
              repeatCount="indefinite"
              path="M80,20 A42,42 0 1,1 79.9,20"
            />
          </circle>
          <circle r="2" fill="oklch(0.5 0.12 190)">
            <animateMotion
              dur="3.4s"
              repeatCount="indefinite"
              path="M80,104 A42,42 0 1,0 80.1,104"
            />
          </circle>
          <circle r="1.8" fill="oklch(0.6 0.14 280)">
            <animateMotion
              dur="2.1s"
              repeatCount="indefinite"
              path="M38,62 A42,42 0 1,1 38.1,62"
            />
          </circle>
        </g>

        {/* Assembling card chrome */}
        <g>
          <rect
            x="38"
            y="28"
            width="84"
            height="64"
            rx="10"
            fill="url(#invent-fill)"
            stroke="url(#invent-stroke)"
            strokeWidth="2"
          >
            <animate
              attributeName="opacity"
              values="0.55;1;0.55"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </rect>
          <rect
            x="38"
            y="28"
            width="84"
            height="16"
            rx="10"
            fill="oklch(0.55 0.12 240 / 0.18)"
          />
          {/* Title bar dots */}
          <circle cx="48" cy="36" r="2.2" fill="oklch(0.55 0.14 250)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="56" cy="36" r="2.2" fill="oklch(0.5 0.12 200)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.2s"
              begin="0.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx="64" cy="36" r="2.2" fill="oklch(0.58 0.1 180)">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.2s"
              begin="0.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Content blocks sliding into place */}
        <rect
          x="48"
          y="52"
          width="48"
          height="6"
          rx="3"
          fill="oklch(0.55 0.1 240 / 0.45)"
        >
          <animate
            attributeName="width"
            values="12;48;48"
            dur="1.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.2;1;0.2"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </rect>
        <rect
          x="48"
          y="64"
          width="64"
          height="6"
          rx="3"
          fill="oklch(0.5 0.08 210 / 0.4)"
        >
          <animate
            attributeName="width"
            values="8;64;64"
            dur="1.6s"
            begin="0.25s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.2;1;0.2"
            dur="1.6s"
            begin="0.25s"
            repeatCount="indefinite"
          />
        </rect>
        <rect
          x="48"
          y="76"
          width="36"
          height="6"
          rx="3"
          fill="oklch(0.48 0.1 190 / 0.4)"
        >
          <animate
            attributeName="width"
            values="6;36;36"
            dur="1.6s"
            begin="0.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.2;1;0.2"
            dur="1.6s"
            begin="0.5s"
            repeatCount="indefinite"
          />
        </rect>

        {/* Floating brick that docks into the card */}
        <rect
          width="18"
          height="10"
          rx="3"
          fill="oklch(0.55 0.16 250)"
          opacity="0.9"
        >
          <animateTransform
            attributeName="transform"
            type="translate"
            values="18 8; 92 54; 92 54"
            keyTimes="0;0.55;1"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;0"
            keyTimes="0;0.45;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
      <p className="text-sm font-medium tracking-tight text-foreground/80">
        {label}
      </p>
    </div>
  );
}
