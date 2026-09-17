import * as React from "react";
import { cn } from "./cn";

export interface TabsProps {
  value: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  isActive?: boolean;
}

export interface TabsContentProps {
  value: string;
  activeValue: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <div className={cn("space-y-3", className)} data-value={value}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        // Inject current value and onChange into children via context-like props
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return React.cloneElement(child as any, { activeValue: value, onChange });
      })}
    </div>
  );
}

export function TabsList({
  children,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeValue,
}: TabsListProps & { activeValue?: string; onChange?: (value: string) => void }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-subtle p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  className,
  value,
  onClick,
  isActive,
  ...props
}: TabsTriggerProps & {
  onChange?: (value: string) => void;
  activeValue?: string;
}) {
  const { onChange, activeValue } = props as {
    onChange?: (value: string) => void;
    activeValue?: string;
  };
  const active = isActive ?? activeValue === value;

  return (
    <button
      type="button"
      className={cn(
        "px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors",
        active
          ? "bg-pill-active text-surface"
          : "text-text-secondary hover:text-text-primary",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        onChange?.(value);
      }}
      {...props}
    />
  );
}

export function TabsContent({
  value,
  activeValue,
  children,
  className,
}: TabsContentProps) {
  if (value !== activeValue) return null;
  return <div className={cn("pt-1", className)}>{children}</div>;
}

