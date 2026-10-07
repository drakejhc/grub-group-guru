import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera } from "lucide-react";
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
  component: () => (
    <AppShell title={greeting()} subtitle="Your household at a glance.">
      {(household) => <TodayBody household={household} />}
    </AppShell>
  ),
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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

  const open = (list.data ?? []).filter((i) => i.status === "open");
  const expiring = (inventory.data ?? [])
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
    ? expiring.filter((item) => useItUp.ingredients.some((ing) => matchesAny(ing.name, [item.name])))
    : [];

  if (list.isLoading || inventory.isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-36 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card-soft p-7">
        <p className="text-sm text-muted-foreground">{household.name}</p>
        <p className="mt-4 font-display text-5xl leading-none">{open.length}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {open.length === 1 ? "thing on the shared list" : "things on the shared list"}
          {open.length > 0 &&
            ` · added by ${new Set(open.map((i) => i.requested_by)).size} of ${members.data?.length ?? 1}`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full">
            <Link to="/list">
              Open the list <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/scan">
              <Camera className="mr-1 size-4" aria-hidden /> Scan a receipt
            </Link>
          </Button>
        </div>
      </section>

      <section className="card-soft p-7">
        <h2 className="text-xl">Tonight</h2>
        {tonight ? (
          <p className="mt-2 text-muted-foreground">
            {tonight.recipe_id ? (
              <Link
                to="/recipes/$id"
                params={{ id: tonight.recipe_id }}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {tonight.title}
              </Link>
            ) : (
              <span className="text-foreground">{tonight.title}</span>
            )}{" "}
            {tonight.cooked ? "was cooked tonight." : "is planned for dinner."}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing planned yet. Meal ideas are ranked by what's already in your kitchen.
          </p>
        )}
        <Button asChild size="sm" variant="ghost" className="mt-4 -ml-3 rounded-full">
          <Link to="/meals">Plan the week</Link>
        </Button>
      </section>

      <section className="card-soft p-7">
        <h2 className="text-xl">Use these up</h2>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing is close to its date. Add what's at home from a receipt to keep this useful.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {expiring.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4">
                <span>{item.name}</span>
                <span className="text-sm text-clay">{freshnessLabel(item.expires_on)}</span>
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
        <Button asChild size="sm" variant="ghost" className="mt-4 -ml-3 rounded-full">
          <Link to="/kitchen">See the kitchen</Link>
        </Button>
      </section>

      {dueStaples.length > 0 && (
        <section className="card-soft p-7">
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
          <Button asChild size="sm" variant="ghost" className="mt-4 -ml-3 rounded-full">
            <Link to="/household">Manage staples</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
