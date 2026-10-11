import type { ReactNode } from "react";

type IconName =
  | "grid"
  | "clipboard"
  | "chart"
  | "swap"
  | "inbox"
  | "settings"
  | "calendar"
  | "wallet"
  | "arrow"
  | "search"
  | "home"
  | "bolt"
  | "phone"
  | "check"
  | "alert"
  | "bell";

type NovaVariant =
  | "core"
  | "landing"
  | "onboarding"
  | "dashboard"
  | "financial"
  | "risk-alert"
  | "empty"
  | "loading"
  | "success"
  | "contact";

export function NovaMascot({
  size = 72,
  variant = "core",
  label = "Breezey, your financial guide",
}: {
  size?: number;
  variant?: NovaVariant;
  label?: string;
}) {
  return (
    <img
      alt={label}
      className={`nova-mascot nova-mascot-${variant}`}
      height={size}
      src={`/assets/nova/${variant}.png`}
      width={size}
    />
  );
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <rect x="15" y="15" width="6" height="6" rx="1" />
      </>
    ),
    clipboard: (
      <>
        <path d="M9 5h6" />
        <path d="M9 3h6v4H9z" />
        <path d="M7 5H5v16h14V5h-2" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        <path d="m3 8 6-4 6 5 6-6" />
      </>
    ),
    swap: (
      <>
        <path d="M4 7h15l-3-3M20 17H5l3 3" />
        <path d="M19 7v4M5 17v-4" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 5h16l2 9v5H2v-5z" />
        <path d="M2 14h6l2 3h4l2-3h6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 13.5v-3l-2.2-.6a7 7 0 0 0-.7-1.7l1.1-2-2.1-2.1-2 1.1a7 7 0 0 0-1.7-.7L10.5 2h-3l-.6 2.2a7 7 0 0 0-1.7.7l-2-1.1-2.1 2.1 1.1 2a7 7 0 0 0-.7 1.7L0 10.5v3l2.2.6a7 7 0 0 0 .7 1.7l-1.1 2 2.1 2.1 2-1.1a7 7 0 0 0 1.7.7l.9 2.5h3l.6-2.2a7 7 0 0 0 1.7-.7l2 1.1 2.1-2.1-1.1-2a7 7 0 0 0 .7-1.7z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 6h16a2 2 0 0 1 2 2v11H3z" />
        <path d="M3 6V4h14v2M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    bolt: <path d="M13 2 5 14h6l-1 8 9-13h-6z" />,
    phone: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 5h4M11 18h2" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    alert: (
      <>
        <path d="M12 3 2 21h20z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </g>
    </svg>
  );
}

export function Button({
  children,
  secondary = false,
  onClick,
}: {
  children: ReactNode;
  secondary?: boolean;
  onClick?: () => void;
}) {
  return <button type="button" className={secondary ? "button button-secondary" : "button"} onClick={onClick}>{children}</button>;
}

export function MetricCard({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone?: "gold" | "red";
}) {
  return (
    <article className="metric-card">
      <div className="metric-label">{title}</div>
      <strong className={tone ? `metric-value ${tone}` : "metric-value"}>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export function PageTitle({
  eyebrow,
  title,
  children,
  action,
  mascotVariant = "core",
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  mascotVariant?: NovaVariant;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="page-title-side">
        <NovaMascot variant={mascotVariant} size={90} />
        {action}
      </div>
    </div>
  );
}

