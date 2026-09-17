import { cn } from "@/components/ui/cn";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSearch,
  LayoutDashboard,
  Settings,
  Stethoscope,
  User,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  key: string;
  icon?: string;
};

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  LayoutDashboard,
  FileSearch,
  Stethoscope,
  User,
  Clock,
  BookOpen,
  Settings,
};

interface SidebarProps {
  user: { name: string; role: string };
  expanded: boolean;
  onToggle: () => void;
  navItems: NavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
}

/**
 * 240px sidebar that collapses to a 64px icon rail. The rail is forced below
 * 1024px (design breakpoint) and optional above it via the toggle, which is
 * persisted by the provider.
 */
export function Sidebar({ user, expanded, onToggle, navItems, activeHref, onNavigate }: SidebarProps) {
  return (
    <aside
      aria-label="Primary"
      className={cn(
        "flex shrink-0 flex-col border-r border-border-hairline bg-surface-raised transition-[width] duration-[var(--rs-motion-base)] ease-[var(--rs-motion-ease)]",
        "w-16",
        expanded && "lg:w-60",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border-hairline", expanded ? "justify-center px-3 lg:justify-between lg:px-5" : "justify-center px-3")}>
        <span className="text-lg font-bold tracking-[-0.01em] text-ink-900" aria-label="RediSense">
          <span className={cn(expanded ? "hidden lg:inline" : "hidden")}>RediSense</span>
          <span className={cn(expanded ? "lg:hidden" : "")}>RS</span>
        </span>
        <button
          type="button"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          className={cn("hidden h-7 w-7 items-center justify-center rounded-sm text-ink-500 hover:bg-surface-sunken hover:text-ink-900 lg:flex", !expanded && "absolute left-[46px] top-[18px] border border-border-hairline bg-surface")}
          onClick={onToggle}
        >
          {expanded ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3" aria-label="Sections">
        {navItems.map((item) => {
          const active = item.href === "/" ? activeHref === "/" : activeHref.startsWith(item.href);
          const Icon = item.icon ? NAV_ICONS[item.icon] : null;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.href)}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex w-full items-center gap-3 rounded-sm px-3 py-[9px] text-left text-sm transition-colors",
                "justify-center",
                expanded && "lg:justify-start",
                active ? "bg-accent-050 font-semibold text-accent-700" : "text-ink-700 hover:bg-surface-sunken hover:text-ink-900",
              )}
            >
              {Icon ? <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} /> : null}
              <span className={cn("truncate", expanded ? "hidden lg:inline" : "hidden")}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={cn("border-t border-border-hairline px-3 py-3", expanded ? "hidden lg:block" : "hidden")}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-2xs font-semibold text-accent-700" aria-hidden="true">
            {user.name.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xs font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-2xs text-ink-400">{user.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
