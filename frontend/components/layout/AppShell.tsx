"use client";

import { usePathname, useRouter } from "next/navigation";
import { CopilotDrawer } from "@/components/copilot/CopilotDrawer";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { useAppState } from "@/hooks/useAppState";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", key: "dashboard", icon: "LayoutDashboard" },
  { label: "Report Analyzer", href: "/report-analyzer", key: "report-analyzer", icon: "FileSearch" },
  { label: "Symptom Triage", href: "/symptom-triage", key: "symptom-triage", icon: "Stethoscope" },
  { label: "Patient Profile", href: "/patient-profile", key: "patient-profile", icon: "User" },
  { label: "Timeline", href: "/timeline", key: "timeline", icon: "Clock" },
  { label: "Knowledge Center", href: "/knowledge-center", key: "knowledge", icon: "BookOpen" },
  { label: "Settings", href: "/settings", key: "settings", icon: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, copilotOpen, openCopilot, closeCopilot, sidebarCollapsed, setSidebarCollapsed } = useAppState();

  return (
    <div className="app-shell relative flex h-screen w-full overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-ink-900">
        Skip to content
      </a>
      <Sidebar
        user={user}
        expanded={!sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        navItems={NAV_ITEMS}
        activeHref={pathname || "/"}
        onNavigate={(href) => router.push(href)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopNav onOpenCopilot={() => openCopilot()} pathname={pathname || "/"} />
        <main id="main" className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CopilotDrawer open={copilotOpen} onClose={closeCopilot} />
    </div>
  );
}
