import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: {
    default: "TrustLedger | Cold-chain monitoring",
    template: "%s | TrustLedger",
  },
  description: "Cold-chain incident detection and blood-unit traceability.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
