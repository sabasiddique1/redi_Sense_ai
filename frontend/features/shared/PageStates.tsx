import type { ComponentType } from "react";
import { AlertOctagon, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/cn";

type IconComponent = ComponentType<{ className?: string }>;

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: IconComponent;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({
  title = "Unable to load this view",
  description,
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  title?: string;
  description?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <Card
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center border-risk-critical/30 bg-risk-critical-soft px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-risk-critical-text">
        <AlertOctagon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-risk-critical-text">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Card>
  );
}

/** A card-shaped placeholder with a title bar and `lines` text rows. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card aria-busy="true" className={cn("space-y-3 p-5", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3"
          style={{ width: `${88 - index * 14}%` }}
        />
      ))}
    </Card>
  );
}
