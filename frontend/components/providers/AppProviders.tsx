"use client";

import { AppStateProvider } from "@/components/providers/AppStateProvider";


export function AppProviders({ children }: { children: React.ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
