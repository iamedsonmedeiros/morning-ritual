"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app/hoje", label: "Hoje", icon: HomeIcon },
  { href: "/app/habitos", label: "Hábitos", icon: CheckCircleIcon },
  { href: "/app/config", label: "Config", icon: SettingsIcon },
];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M4.5 11.3 12 4.8l7.5 6.5"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 10.7V20h11.2v-9.3"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 20v-5.3h3.6V20"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8.1"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
      />
      <path
        d="m9.2 12.1 1.9 1.9 3.9-4.2"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none">
      <path
        d="M12 7.1v-.9"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M12 17.8v-.9"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M7.1 12H6.2"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M17.8 12h-.9"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M8.1 8.1l-.6-.6"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M16.5 16.5l-.6-.6"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M8.1 15.9l-.6.6"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <path
        d="M16.5 7.5l-.6.6"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.45}
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth={active ? 1.9 : 1.45} />
    </svg>
  );
}

export default function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-full border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-[10px] font-medium tracking-wide transition ${
                active
                  ? "bg-white text-slate-950 shadow-[0_6px_18px_rgba(255,255,255,0.16)] ring-1 ring-white/60"
                  : "text-white/55 hover:bg-white/8 hover:text-white/85"
              }`}
            >
              <span className={active ? "drop-shadow-sm" : ""}>
                <Icon active={active} />
              </span>
              <span className={active ? "text-slate-950" : "text-inherit"}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
