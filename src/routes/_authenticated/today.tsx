import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  useInventory,
  useListItems,
  useMealPlan,
  useMembers,
  useStaples,
  type Household,
} from "@/lib/data";
import { daysUntil, freshnessLabel, stapleDue, todayStr, weekDates } from "@/lib/food";

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
            <span className="text-foreground">{tonight.title}</span> is planned for dinner.
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
        <Button asChild size="sm" variant="ghost" className="mt-4 -ml-3 rounded-full">
          <Link to="/kitchen">See the kitchen</Link>
        </Button>
      </section>

      {dueStaples.length > 0 && (
        <section className="card-soft p-7">
          <h2 className="text-xl">Probably running low</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Based on how often you normally buy these.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {dueStaples.map((s) => (
              <li
                key={s.id}
                className="rounded-full bg-secondary px-3.5 py-1.5 text-sm text-secondary-foreground"
              >
                {s.name}
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
