import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TopNav() {
  return (
    <header className="flex h-[72px] items-center justify-between gap-4 border-b border-[#E6ECF5] bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-[#101828]">
          Welcome back, Dr. Hernandez
        </h2>
        <span className="hidden text-xl sm:inline">👋</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden max-w-[220px] sm:block">
          <Input
            placeholder="Search patients, reports..."
            className="h-9 rounded-[14px] border-[#E6ECF5] bg-[#F8FAFD]"
          />
        </div>
        <Button variant="outline" size="sm" className="hidden rounded-[14px] sm:inline-flex">
          New report
        </Button>
        <Button variant="primary" size="sm" className="rounded-[14px]">
          Open Copilot
        </Button>
      </div>
    </header>
  );
}

