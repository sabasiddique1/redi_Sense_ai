'use client';

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", key: "dashboard" },
  { label: "Report Analyzer", href: "/report-analyzer", key: "report-analyzer" },
  { label: "Symptom Triage", href: "/symptom-triage", key: "symptom-triage" },
  { label: "Patient Profile", href: "/patient-profile", key: "patient-profile" },
  { label: "Timeline", href: "/timeline", key: "timeline" },
  { label: "Knowledge Center", href: "/knowledge-center", key: "knowledge" },
  { label: "Settings", href: "/settings", key: "settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex w-full max-w-[1440px] overflow-hidden rounded-[28px] border border-[#E6ECF5] bg-[#F4F7FB] shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
        <Sidebar
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          navItems={NAV_ITEMS}
          activeHref={pathname || "/"}
          onNavigate={(href) => router.push(href)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav />
          <main className="flex-1 overflow-y-auto px-6 pb-8 pt-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

