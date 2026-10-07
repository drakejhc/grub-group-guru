import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight, Camera, ChefHat } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addToList,
  listToast,
  useInventory,
  useListItems,
  useMealPlan,
  useMembers,
  useMutate,
  useMyProfile,
  useSession,
  useStaples,
  type Household,
} from "@/lib/data";
import { daysUntil, freshnessLabel, matchesAny, stapleDue, todayStr, weekDates } from "@/lib/food";
import { useRankedRecipes } from "@/lib/recipe-actions";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Larder" },
      {
        name: "description",
        content: "What your household needs, what's about to go off, and what's for dinner.",
      },
      { property: "og:title", content: "Today — Larder" },
      {
        property: "og:description",
        content: "What your household needs, what's about to go off, and what's for dinner.",
      },
    ],
  }),
  component: TodayPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function TodayPage() {
  const { data: me } = useMyProfile();
  const firstName = me?.display_name?.split(" ")[0];
  return (
    <AppShell
      title={firstName ? `${greeting()}, ${firstName}` : greeting()}
      subtitle="What needs your attention right now."
    >
      {(household) => <TodayBody household={household} />}
    </AppShell>
  );
}

type NextAction = {
  title: string;
  body: string;
  cta: ReactNode;
};

function TodayBody({ household }: { household: Household }) {
  const list = useListItems(household.id);
  const inventory = useInventory(household.id);
  const staples = useStaples(household.id);
  const members = useMembers(household.id);
  const dates = weekDates();
  const meals = useMealPlan(household.id, dates);
  const { ranked } = useRankedRecipes(household.id);
  const { userId } = useSession();

  const staplesToList = useMutate(
    async (staple: { name: string; category: string }) => {
      if (!userId) return null;
      return listToast(await addToList(household.id, userId, [staple]));
    },
    ["list"],
    { errorMessage: "Couldn't add that to the list" },
  );

  if (list.isLoading || inventory.isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
      </div>
    );
  }

  const items = list.data ?? [];
  const open = items.filter((i) => i.status === "open");
  const basket = items.filter((i) => i.status === "purchased");
  const kitchen = inventory.data ?? [];
  const nameOf = (id: string) =>
    id === userId ? "You" : (members.data?.find((m) => m.id === id)?.display_name ?? "Someone");

  const expiring = kitchen
    .filter((i) => {
      const d = daysUntil(i.expires_on);
      return d !== null && d <= 3;
    })
    .slice(0, 5);
  const dueStaples = (staples.data ?? []).filter(stapleDue);

  const today = todayStr();
  const tonight = (meals.data ?? []).find((m) => m.plan_date === today);

  // The best-ranked recipe that actually uses something about to go off.
  const expiringNames = expiring.map((i) => i.name);
  const useItUp = ranked.find(({ ingredients }) =>
    ingredients.some((ing) => matchesAny(ing.name, expiringNames)),
  );
  const useItUpItems = useItUp
    ? expiring.filter((item) =>
        useItUp.ingredients.some((ing) => matchesAny(ing.name, [item.name])),
      )
    : [];

  // One obvious next step, chosen by what the household is in the middle of.
  const next: NextAction | null = (() => {
    if (kitchen.length === 0 && items.length === 0) {
      return {
        title: "Add your first groceries",
        body: "Scan a receipt to fill your kitchen in one go, or start a shared list.",
        cta: (
          <>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/scan">
                <Camera className="mr-1.5 size-4" aria-hidden /> Scan a receipt
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/list">Start the list</Link>
            </Button>
          </>
        ),
      };
    }
    if (basket.length > 0) {
      const finishing = open.length > 0;
      return {
        title: finishing ? "Finish your shop" : "Put the shopping away",
        body: finishing
          ? `${basket.length} in the basket, ${open.length} still to find.`
          : `${basket.length} ${basket.length === 1 ? "thing" : "things"} bought — move them into your kitchen.`,
        cta: (
          <Button asChild size="sm" className="rounded-full">
            <Link to="/list">
              {finishing ? "Back to the list" : "Put it away"}{" "}
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        ),
      };
    }
    if (useItUp && !tonight) {
      return {
        title: "Find a meal for these",
        body: `${useItUpItems.map((i) => i.name.toLowerCase()).join(", ")} should be used soon.`,
        cta: (
          <Button asChild size="sm" className="rounded-full">
            <Link to="/recipes/$id" params={{ id: useItUp.recipe.id }}>
              See {useItUp.recipe.title}
            </Link>
          </Button>
        ),
      };
    }
    if (!tonight) {
      return {
        title: "Plan dinner",
        body: "Nothing is planned tonight. Ideas are ranked by what's already at home.",
        cta: (
          <Button asChild size="sm" className="rounded-full">
            <Link to="/meals">Plan dinner</Link>
          </Button>
        ),
      };
    }
    return null;
  })();

  const recent = items
    .filter((i) => Date.now() - new Date(i.created_at).getTime() < 48 * 3_600_000)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activity = (() => {
    if (recent.length === 0) return null;
    const people = Array.from(new Set(recent.map((i) => nameOf(i.requested_by))));
    const who = people.length > 2 ? `${people[0]} and ${people.length - 1} others` : people.join(" and ");
    return recent.length === 1
      ? `${who} added ${recent[0]!.name.toLowerCase()}`
      : `${who} added ${recent.length} items to the list`;
  })();

  return (
    <div className="space-y-4">
      {next && (
        <section
          className="card-soft border-primary/30 bg-accent/40 p-6 sm:p-7"
          aria-labelledby="next-action"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Next up</p>
          <h2 id="next-action" className="mt-1.5 text-2xl">
            {next.title}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{next.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">{next.cta}</div>
        </section>
      )}

      <section className="card-soft p-6 sm:p-7">
        <h2 className="text-xl">Tonight</h2>
        {tonight ? (
          <>
            <p className="mt-2 text-lg">{tonight.title}</p>
            {tonight.cooked && (
              <p className="text-sm text-muted-foreground">Cooked — enjoy.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!tonight.cooked && (
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/meals">
                    <ChefHat className="mr-1.5 size-4" aria-hidden /> Cook
                  </Link>
                </Button>
              )}
              {tonight.recipe_id && (
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/recipes/$id" params={{ id: tonight.recipe_id }}>
                    View recipe
                  </Link>
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing planned yet. Meal ideas are ranked by what's already in your kitchen.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4 rounded-full">
              <Link to="/meals">Plan dinner</Link>
            </Button>
          </>
        )}
      </section>

      <section className="card-soft p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl">Shopping</h2>
          <Link to="/list" className="text-sm text-primary underline-offset-4 hover:underline">
            Open the list
          </Link>
        </div>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            The list is clear. Anything anyone adds shows up here straight away.
          </p>
        ) : (
          <>
            <p className="mt-3 font-display text-4xl leading-none">{open.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {open.length === 1 ? "thing to buy" : "things to buy"}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {open.slice(0, 6).map((i) => (
                <li
                  key={i.id}
                  className="max-w-full truncate rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                >
                  {i.name}
                </li>
              ))}
              {open.length > 6 && (
                <li className="px-1 py-1 text-sm text-muted-foreground">+{open.length - 6} more</li>
              )}
            </ul>
          </>
        )}
        {activity && <p className="mt-4 text-xs text-muted-foreground">{activity}</p>}
      </section>

      <section className="card-soft p-6 sm:p-7">
        <h2 className="text-xl">Use these up</h2>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {kitchen.length === 0
              ? "Your kitchen is empty. Scan a receipt to see what's about to go off."
              : "Nothing is close to its date."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {expiring.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 text-sm text-clay">{freshnessLabel(item.expires_on)}</span>
              </li>
            ))}
          </ul>
        )}
        {useItUp && (
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm">
            Try{" "}
            <Link
              to="/recipes/$id"
              params={{ id: useItUp.recipe.id }}
              className="font-medium underline-offset-4 hover:underline"
            >
              {useItUp.recipe.title}
            </Link>{" "}
            — uses {useItUpItems.map((i) => i.name.toLowerCase()).join(", ")}
            {useItUp.missing.length > 0 && `, needs ${useItUp.missing.length} more`}.
          </p>
        )}
        <Button asChild size="sm" variant="ghost" className="-ml-3 mt-4 rounded-full">
          <Link to="/kitchen">See the kitchen</Link>
        </Button>
      </section>

      {dueStaples.length > 0 && (
        <section className="card-soft p-6 sm:p-7">
          <h2 className="text-xl">Probably running low</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on how often you normally buy these. Tap one to add it to the list.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {dueStaples.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() =>
                    staplesToList.mutate(s, {
                      onSuccess: (message) => message && toast.success(message),
                    })
                  }
                  aria-label={`Add ${s.name} to the list`}
                  className="rounded-full bg-secondary px-3.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.name} <span aria-hidden>+</span>
                </button>
              </li>
            ))}
          </ul>
          <Button asChild size="sm" variant="ghost" className="-ml-3 mt-4 rounded-full">
            <Link to="/household">Manage staples</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
