interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="space-y-1">
      <h1 className="text-lg font-semibold tracking-[-0.02em] text-text-primary">
        {title}
      </h1>
      {subtitle && (
        <p className="max-w-2xl text-xs text-text-secondary">{subtitle}</p>
      )}
    </header>
  );
}

