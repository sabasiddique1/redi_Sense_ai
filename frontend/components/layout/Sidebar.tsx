import { cn } from "@/components/ui/cn";
import { Button } from "@/components/ui/button";

type NavItem = {
  label: string;
  href: string;
  key: string;
};

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  navItems: NavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
}

export function Sidebar({
  expanded,
  onToggle,
  navItems,
  activeHref,
  onNavigate,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-[#E6ECF5] bg-[#FFFFFF]/90 backdrop-blur-sm transition-all duration-200",
        expanded ? "w-[248px]" : "w-[92px]"
      )}
    >
      <div className="flex h-[72px] items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EAF2FF] shadow-sm">
            <span className="text-[18px] font-semibold text-[#4C8DFF]">
              RQ
            </span>
          </div>
          {expanded && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-[#101828]">
                ReportIQ
              </span>
              <span className="text-[11px] text-[#667085]">
                AI Healthcare Copilot
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="h-8 w-8 rounded-full border border-[#E6ECF5] bg-white shadow-sm"
          onClick={onToggle}
        >
          <span className="text-xs text-[#667085]">
            {expanded ? "◀" : "▶"}
          </span>
        </Button>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-2 pb-4 pt-1">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? activeHref === "/"
              : activeHref.startsWith(item.href);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.href)}
              className={cn(
                "group flex w-full items-center rounded-[999px] px-3 py-2 text-left text-xs font-medium transition-colors",
                active
                  ? "bg-[#111111] text-white shadow-[0_10px_25px_rgba(15,23,42,0.35)]"
                  : "text-[#667085] hover:bg-[#F2F4F7] hover:text-[#101828]"
              )}
            >
              <span
                className={cn(
                  "mr-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#E6ECF5] bg-[#F8FAFD] text-[11px] font-semibold text-[#4C8DFF] shadow-sm",
                  active && "border-transparent bg-white text-[#4C8DFF]"
                )}
              >
                {item.label
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              {expanded && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#E6ECF5] px-3 py-3">
        <div className="flex items-center gap-2 rounded-[16px] bg-[#F8FAFD] px-2.5 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#DCFCE7] text-[11px] font-semibold text-[#15803D]">
            D
          </div>
          {expanded && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-[#101828]">
                Dr. A. Hernandez
              </span>
              <span className="truncate text-[11px] text-[#667085]">
                Internal Medicine
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

