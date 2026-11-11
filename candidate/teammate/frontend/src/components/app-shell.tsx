"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  ShieldCheck,
  Snowflake,
  Truck,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OfflineStatus } from "@/components/offline-status";
import { fetchCurrentUser, logoutDemoUser } from "@/lib/api";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "TrustLedger";
const countryLabel = process.env.NEXT_PUBLIC_COUNTRY_LABEL ?? "Kenya blood cold-chain monitoring";
const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Incidents", href: "/incidents", icon: AlertTriangle },
  { label: "Transport alerts", href: "/transport-alerts", icon: Truck },
  { label: "Inventory", href: "/inventory", icon: PackageSearch },
  { label: "Data quality", href: "/data-quality", icon: Activity },
  { label: "Review centre", href: "/review", icon: ClipboardCheck },
  { label: "Audit log", href: "/audit-log", icon: ShieldCheck },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div role="status" className="p-8 text-sm text-muted-foreground">Preparing TrustLedger…</div>}>
      <RouteAwareAppShell>{children}</RouteAwareAppShell>
    </Suspense>
  );
}

function RouteAwareAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}

function AuthenticatedAppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    enabled: typeof window !== "undefined",
    retry: false,
  });
  const logout = useMutation({
    mutationFn: logoutDemoUser,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  useEffect(() => {
    if (currentUser.isError) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
    }
  }, [currentUser.isError, pathname, router]);

  const user = currentUser.data;
  const sessionVerified = Boolean(user);

  const nav = (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Snowflake className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[15px] font-bold tracking-tight">{appName}</p>
          <p className="text-xs text-muted-foreground">Cold-chain intelligence</p>
        </div>
      </div>
      <div className="px-4 pt-7">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-xl border bg-muted/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Database className="size-3.5 text-primary" aria-hidden="true" />
            Dataset mode
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Synthetic dataset. All flagged units are investigation candidates,
            not disposition decisions.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        {nav}
      </aside>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex justify-end p-3">
          <button
            aria-label="Close navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        {nav}
      </aside>
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b bg-background/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Snowflake className="size-4 text-primary" aria-hidden="true" />
              {countryLabel}
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-medium">{user.actor_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {user.role === "facility_staff" ? "Facility staff" : "Blood service supervisor"} · demo account
                </p>
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <LogOut className="size-3.5" aria-hidden="true" />
                {logout.isPending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Checking demo session…</span>
          )}
        </header>
        {logout.isError && (
          <p role="alert" className="border-b bg-destructive/10 px-5 py-2 text-center text-xs text-destructive sm:px-8">
            {logout.error.message}
          </p>
        )}
        {user && <OfflineStatus user={user} />}
        <main
          aria-busy={!sessionVerified}
          aria-hidden={!sessionVerified}
          className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9"
          inert={!sessionVerified}
        >
          {children}
        </main>
      </div>
      {!sessionVerified && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-6 backdrop-blur-sm">
          <p role="status" className="rounded-lg border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
            Checking your TrustLedger demo session…
          </p>
        </div>
      )}
    </div>
  );
}

function SidebarNavigation({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Suspense fallback={<NavigationLinks pathname="" onNavigate={onNavigate} />}>
      <ActiveNavigation onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavigation({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return <NavigationLinks pathname={pathname} onNavigate={onNavigate} />;
}

function NavigationLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="space-y-1" aria-label="Main navigation">
      {navigation.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[17px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
