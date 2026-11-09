import type { ReactNode, SVGProps } from 'react'

/**
 * The one icon set (DESIGN_SYSTEM §4): 24 px line icons drawn on the same grid, stroke 1.75, round
 * caps. Decorative by default — the label beside each icon carries the meaning.
 */

type IconProps = { size?: number; className?: string } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>

function Svg({ size = 20, className, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
  </Svg>
)

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M5.2 18.8l1.4-1.4M17.4 6.6l1.4-1.4" />
  </Svg>
)

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 10.6 12 3.5l8.5 7.1" />
    <path d="M5.5 9.6V20a.5.5 0 0 0 .5.5h4v-5.7h4v5.7h4a.5.5 0 0 0 .5-.5V9.6" />
  </Svg>
)
export const IconExam = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 3.5h7.5L19 8v12a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 7 20V4a.5.5 0 0 1 .5-.5Z" />
    <path d="M14 3.8V8h4.2" />
    <path d="m10 14.2 1.6 1.6 3-3.2" />
  </Svg>
)
export const IconDrill = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3" />
  </Svg>
)
export const IconChart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20.2V4" />
    <path d="M4 20.2h16.2" />
    <path d="M8 16.4v-4.2M12.6 16.4V8.6M17.2 16.4v-2.6" />
  </Svg>
)
export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
)
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
)
export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h14.5M13.5 6.5 19 12l-5.5 5.5" />
  </Svg>
)
export const IconArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Svg>
)
export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.6v12.8L18.5 12 8 5.6Z" />
  </Svg>
)
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)
export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.2 12.2 2.6 2.6 5-5.2" />
  </Svg>
)
export const IconFlag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21V4.2" />
    <path d="M6 4.6h9.6l-1.5 3.4 1.5 3.4H6" />
  </Svg>
)
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.8" rx="2.2" />
    <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
  </Svg>
)
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2 5 6v6.1c0 4.2 2.9 7.3 7 8.7 4.1-1.4 7-4.5 7-8.7V6l-7-2.8Z" />
    <path d="m8.8 12 2.2 2.2 4.2-4.4" />
  </Svg>
)
export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 7.6V12l3 1.8" />
  </Svg>
)
export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.2c2.6-.9 5.3-.9 8 .8 2.7-1.7 5.4-1.7 8-.8v13.1c-2.6-.9-5.3-.9-8 .8-2.7-1.7-5.4-1.7-8-.8V5.2Z" />
    <path d="M12 6v13.1" />
  </Svg>
)
export const IconSparkle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 10.9 10.1 9 12 3.2Z" />
    <path d="M18.6 16.4 19.4 18.6l2.2.8-2.2.8-.8 2.2" />
  </Svg>
)
export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.4 14.4a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.3-2.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.2Z" />
  </Svg>
)
export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.4 8.4 4.4-8.4 4.4L3.6 7.8 12 3.4Z" />
    <path d="m4 12 8 4.2 8-4.2" />
    <path d="m4 16.2 8 4.2 8-4.2" />
  </Svg>
)
export const IconTable = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2" />
    <path d="M3.6 9.4h16.8M9.6 9.4v10.2" />
  </Svg>
)
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.6" />
    <path d="m16 16 4 4" />
  </Svg>
)
export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.4 21 19.4H3L12 4.4Z" />
    <path d="M12 10v4M12 16.8v.2" />
  </Svg>
)
export const IconCross = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" />
  </Svg>
)
export const IconDash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12h12" />
  </Svg>
)
export const IconDot = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.4M12 7.8v.2" />
  </Svg>
)
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8.4" r="3.9" />
    <path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0" />
  </Svg>
)
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.4A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4.4v4.1h4.1" />
    <path d="M4 12.6A8 8 0 0 0 17.7 17.7L20 15.5" />
    <path d="M20 19.6v-4.1h-4.1" />
  </Svg>
)
export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
)
export const IconPlug = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3.5v5M15 3.5v5" />
    <path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0v-3Z" />
    <path d="M12 17v3.5" />
  </Svg>
)
export const IconBrain = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.4 4.2a3 3 0 0 0-3 3 2.8 2.8 0 0 0-1.6 4.9A3 3 0 0 0 6.3 17a3 3 0 0 0 3.1 2.8V4.2Z" />
    <path d="M14.6 4.2a3 3 0 0 1 3 3 2.8 2.8 0 0 1 1.6 4.9A3 3 0 0 1 17.7 17a3 3 0 0 1-3.1 2.8V4.2Z" />
  </Svg>
)
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10.5M7.6 10.4 12 14.8l4.4-4.4" />
    <path d="M4.6 19.4h14.8" />
  </Svg>
)
export const IconSpark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.6 13.6 8l5.4 1.6-5.4 1.6L12 16.6l-1.6-5.4L5 9.6 10.4 8 12 2.6Z" />
  </Svg>
)
