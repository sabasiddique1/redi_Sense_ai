"use client";

import { useEffect } from "react";

import { useAppState } from "@/hooks/useAppState";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Pages declare their title and context here; the top bar renders them
 * (design: no in-page header). Also keeps the document title in sync.
 */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const { setPageHeader } = useAppState();
  useEffect(() => {
    setPageHeader({ title, context: subtitle });
    document.title = `${title} · RediSense`;
    return () => setPageHeader(null);
  }, [title, subtitle, setPageHeader]);
  return <h1 className="sr-only">{title}</h1>;
}
