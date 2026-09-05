import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { CalendarRange, Home, ListChecks, Refrigerator, Users } from "lucide-react";

import { QuickAdd } from "@/components/quick-add";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold, useHouseholdRealtime, useSession, type Household } from "@/lib/data";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/today", label: "Today", icon: Home },
  { to: "/list", label: "List", icon: ListChecks },
  { to: "/kitchen", label: "Kitchen", icon: Refrigerator },
  { to: "/meals", label: "Meals", icon: CalendarRange },
  { to: "/household", label: "Household", icon: Users },
] as const;

export function useEnsureProfile() {
  const { userId } = useSession();
  useEffect(() => {
    if (!userId) return;
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      const meta = user.user_metadata as { display_name?: string; full_name?: string; name?: string };
      const displayName =
        meta.display_name ?? meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "Member";
      supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true })
        .then(() => undefined);
    });
  }, [userId]);
}

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: (household: Household) => ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  useEnsureProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: household, isLoading, isError } = useHousehold();
  useHouseholdRealtime(household?.id);

  useEffect(() => {
    if (!isLoading && !isError && household === null) navigate({ to: "/setup", replace: true });
  }, [isLoading, isError, household, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-10">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/today" className="font-display text-lg font-semibold tracking-tight">
            Larder
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  pathname === tab.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>

        <div className="mt-7">
          {isLoading && <p className="text-sm text-muted-foreground">Loading your household…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              We couldn't load your household. Try refreshing the page.
            </p>
          )}
          {household && children(household)}
        </div>
      </main>

      {household && <QuickAdd householdId={household.id} />}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]",
                pathname === tab.to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-5" strokeWidth={1.6} aria-hidden />
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
