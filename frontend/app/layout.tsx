import type { Metadata } from "next";
import { DM_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { THEME_INIT_SCRIPT } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RediSense | AI Healthcare Copilot",
  description:
    "RediSense is an AI healthcare copilot for medical report analysis, symptom triage, and evidence-backed clinical guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline theme script sets data-theme before
    // React hydrates, which is intentional and must not be reconciled away.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${nunitoSans.variable} ${dmMono.variable} antialiased bg-shell text-ink-900`}>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
