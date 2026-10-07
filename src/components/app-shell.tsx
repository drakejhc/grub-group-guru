import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import {
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  Home,
  ListChecks,
  LogOut,
  Refrigerator,
  Users,
} from "lucide-react";

import { QuickAdd } from "@/components/quick-add";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  useHousehold,
  useListItems,
  useMyProfile,
  useSession,
  type Household,
} from "@/lib/data";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/today", label: "Today", icon: Home },
  { to: "/list", label: "List", icon: ListChecks },
  { to: "/kitchen", label: "Kitchen", icon: Refrigerator },
  { to: "/meals", label: "Meals", icon: CalendarRange },
  { to: "/recipes", label: "Recipes", icon: BookOpen },
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

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell({
  children,
  title,
  subtitle,
  action,
  eyebrow,
}: {
  children: (household: Household) => ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: household, isLoading, isError, households, setActive } = useHousehold();
  const { data: me } = useMyProfile();
  const { data: list = [] } = useListItems(household?.id);
  const toBuy = list.filter((i) => i.status === "open").length;

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
    <div className="min-h-screen bg-background pb-28 sm:pb-12">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/today" className="font-display text-xl font-semibold tracking-tight">
            Larder
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-0.5 sm:flex">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.to === "/list" && toBuy > 0 && (
                    <span className={cn("ml-1.5 tabular-nums", active ? "opacity-70" : "text-primary")}>
                      {toBuy}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex max-w-[11rem] items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Household and account menu"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground">
                {(me?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{household?.name ?? "…"}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm">{me?.display_name ?? "You"}</p>
                <p className="truncate text-xs text-muted-foreground">{household?.name}</p>
              </DropdownMenuLabel>
              {households.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Switch household
                  </DropdownMenuLabel>
                  {households.map((h) => (
                    <DropdownMenuItem
                      key={h.id}
                      onSelect={() => {
                        setActive(h.id);
                        void queryClient.invalidateQueries();
                      }}
                    >
                      <span className="flex-1 truncate">{h.name}</span>
                      {h.id === household?.id && <Check className="size-4" aria-hidden />}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/household" })}>
                <Users className="mr-2 size-4" aria-hidden /> Household &amp; staples
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={signOut}>
                <LogOut className="mr-2 size-4" aria-hidden /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pt-8 sm:pt-10">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="mb-1.5 text-sm text-muted-foreground">{eyebrow}</p>}
            <h1 className="text-[2rem] leading-tight sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>

        <div className="mt-7">
          {isLoading && (
            <div className="space-y-3" aria-label="Loading">
              <Skeleton className="h-32 rounded-3xl" />
              <Skeleton className="h-20 rounded-3xl" />
              <Skeleton className="h-20 rounded-3xl" />
            </div>
          )}
          {isError && (
            <div className="card-soft p-6">
              <p>We couldn't load your household.</p>
              <button
                onClick={() => void queryClient.invalidateQueries()}
                className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
          {household && children(household)}
        </div>
      </main>

      {household && <QuickAdd householdId={household.id} />}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="mx-auto flex max-w-lg px-1">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-accent text-accent-foreground",
                  )}
                >
                  <tab.icon className="size-5" strokeWidth={active ? 2 : 1.6} aria-hidden />
                </span>
                {tab.label}
                {tab.to === "/list" && toBuy > 0 && (
                  <span className="absolute right-[calc(50%-1.6rem)] top-2 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground tabular-nums">
                    {toBuy}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
