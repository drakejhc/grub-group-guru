import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Camera, Check, ChefHat, ShoppingBasket, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  useInventory,
  useListItems,
  useMealPlan,
  useMembers,
  useMyProfile,
  useStaples,
  type Household,
} from "@/lib/data";
import { daysUntil, freshnessLabel, matchesAny, stapleDue, todayStr, weekDates } from "@/lib/food";
import { useRankedRecipes } from "@/lib/recipe-actions";
import { cn } from "@/lib/utils";

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
  const [hello, setHello] = useState("Hello");
  useEffect(() => setHello(greeting()), []);
  const first = me?.display_name?.split(" ")[0];
  return (
    <AppShell title={first ? `${hello}, ${first}` : hello}>
      {(household) => <TodayBody household={household} />}
    </AppShell>
  );
}

const GUIDE_KEY = "larder.guide-dismissed";

function TodayBody({ household }: { household: Household }) {
  const list = useListItems(household.id);
  const inventory = useInventory(household.id);
  const staples = useStaples(household.id);
  const members = useMembers(household.id);
  const dates = useMemo(() => weekDates(), []);
  const meals = useMealPlan(household.id, dates);
  const { ranked } = useRankedRecipes(household.id);
  const [guideHidden, setGuideHidden] = useState(true);
  useEffect(() => setGuideHidden(localStorage.getItem(GUIDE_KEY) === household.id), [household.id]);

  const items = list.data ?? [];
  const open = items.filter((i) => i.status === "open");
  const basket = items.filter((i) => i.status === "purchased");
  const stock = inventory.data ?? [];
  const expiring = stock
    .filter((i) => {
      const d = daysUntil(i.expires_on);
      return d !== null && d <= 3;
    })
    .slice(0, 6);
  const dueStaples = (staples.data ?? []).filter(stapleDue).filter((s) => !open.some((o) => o.name.toLowerCase() === s.name.toLowerCase()));
  const today = todayStr();
  const plan = meals.data ?? [];
  const tonight = plan.find((m) => m.plan_date === today && !m.cooked) ?? plan.find((m) => m.plan_date === today);
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.display_name ?? "Someone";

  const useUp = useMemo(() => {
    if (expiring.length === 0) return [];
    const names = expiring.map((e) => e.name);
    return ranked
      .filter((r) => r.ingredients.some((i) => matchesAny(i.name, names)))
      .slice(0, 3);
  }, [ranked, expiring]);

  const dayAgo = Date.now() - 86_400_000;
  const recent = items.filter((i) => new Date(i.created_at).getTime() > dayAgo).slice(-4).reverse();

  const loading = list.isLoading || inventory.isLoading || meals.isLoading;

  // Single most useful next step, in priority order.
  const next = (() => {
    if (basket.length > 0)
      return { title: `Put away ${basket.length} thing${basket.length > 1 ? "s" : ""} from your shop`, body: "They'll go straight into the kitchen with an estimated date.", to: "/list" as const, cta: "Put it away" };
    if (stock.length === 0 && open.length === 0)
      return { title: "Add your first groceries", body: "Scan a recent receipt and your kitchen fills itself in — or add a few things by hand.", to: "/scan" as const, cta: "Scan a receipt" };
    if (expiring.length > 0 && !tonight)
      return { title: `Find a meal for ${expiring[0]!.name.toLowerCase()}${expiring.length > 1 ? ` and ${expiring.length - 1} more` : ""}`, body: "These are close to their date. Here's what you could cook with them.", to: "/recipes" as const, cta: "See recipes" };
    if (!tonight)
      return { title: "Plan tonight's dinner", body: "Ideas are ranked by what's already at home.", to: "/meals" as const, cta: "Plan dinner" };
    if (open.length >= 8)
      return { title: `Finish your shop — ${open.length} things to buy`, body: "Shopping mode gives you big tap targets and a progress count.", to: "/list" as const, cta: "Start shopping" };
    return null;
  })();

  const guide = [
    { done: (members.data?.length ?? 0) > 1, label: "Invite someone you live with", to: "/household" as const },
    { done: stock.length > 0, label: "Add or scan your groceries", to: "/scan" as const },
    { done: plan.length > 0, label: "Plan your first meal", to: "/meals" as const },
  ];
  const showGuide = !guideHidden && !loading && guide.some((g) => !g.done);

  return (
    <div className="space-y-4">
      <p className="-mt-5 text-sm text-muted-foreground">{household.name}</p>

      {showGuide && (
        <section className="card-soft p-6" aria-labelledby="guide-h">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="guide-h" className="text-lg">Getting set up</h2>
              <p className="text-sm text-muted-foreground">
                {guide.filter((g) => g.done).length} of {guide.length} done
              </p>
            </div>
            <button
              aria-label="Hide setup steps"
              onClick={() => (localStorage.setItem(GUIDE_KEY, household.id), setGuideHidden(true))}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ol className="mt-4 space-y-1">
            {guide.map((g) => (
              <li key={g.label}>
                <Link
                  to={g.to}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-secondary"
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border border-border",
                      g.done && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {g.done && <Check className="size-3.5" aria-hidden />}
                  </span>
                  <span className={cn("flex-1 text-sm", g.done && "text-muted-foreground line-through")}>
                    {g.label}
                  </span>
                  {!g.done && <ArrowRight className="size-4 text-muted-foreground" aria-hidden />}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {next && !loading && (
        <section className="rounded-[var(--radius-2xl)] bg-foreground p-6 text-background sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] opacity-60">Next up</p>
          <h2 className="mt-2 text-2xl leading-snug sm:text-3xl">{next.title}</h2>
          <p className="mt-2 max-w-md text-sm opacity-75">{next.body}</p>
          <Button asChild className="mt-5 rounded-full bg-background text-foreground hover:bg-background/90">
            <Link to={next.to}>
              {next.cta} <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card-soft flex flex-col p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChefHat className="size-4" aria-hidden /> Tonight
          </div>
          {tonight ? (
            <>
              <h2 className={cn("mt-2 text-2xl leading-snug", tonight.cooked && "text-muted-foreground line-through")}>
                {tonight.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tonight.cooked ? "Cooked — nice." : "Planned for dinner."}
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-2xl text-muted-foreground">Nothing planned yet</h2>
              {ranked[0] && (
                <p className="mt-1 text-sm text-muted-foreground">
                  You could make <span className="text-foreground">{ranked[0].recipe.title}</span>
                  {ranked[0].missing.length === 0 ? " with what's at home." : ` — just missing ${ranked[0].missing.length}.`}
                </p>
              )}
            </>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            {tonight?.recipe_id && (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/recipes/$id" params={{ id: tonight.recipe_id }}>View recipe</Link>
              </Button>
            )}
            <Button asChild size="sm" className="rounded-full">
              <Link to="/meals">{tonight ? (tonight.cooked ? "Plan tomorrow" : "Cook it") : "Plan dinner"}</Link>
            </Button>
          </div>
        </section>

        <section className="card-soft flex flex-col p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingBasket className="size-4" aria-hidden /> Shopping
          </div>
          <h2 className="mt-2 text-2xl">
            {open.length === 0 ? "List is clear" : `${open.length} thing${open.length > 1 ? "s" : ""} to buy`}
          </h2>
          {open.length > 0 && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {open.slice(0, 5).map((i) => i.name).join(", ")}
              {open.length > 5 && ` and ${open.length - 5} more`}
            </p>
          )}
          {dueStaples.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Probably running low: </span>
              {dueStaples.slice(0, 3).map((s) => s.name).join(", ")}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/list">Open the list</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/scan">
                <Camera className="mr-1 size-4" aria-hidden /> Scan receipt
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <section className="card-soft p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl">Use these soon</h2>
          <Link to="/kitchen" className="text-sm text-muted-foreground hover:text-foreground">
            Kitchen
          </Link>
        </div>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {stock.length === 0
              ? "Once your kitchen has food in it, anything close to its date shows up here."
              : "Nothing is close to its date. Good going."}
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap gap-2">
              {expiring.map((item) => (
                <li key={item.id} className="rounded-full border border-border px-3 py-1.5 text-sm">
                  {item.name}
                  <span className="ml-2 text-clay">{freshnessLabel(item.expires_on)}</span>
                </li>
              ))}
            </ul>
            {useUp.length > 0 && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Cook them in</p>
                <ul className="mt-2 divide-y divide-border/60">
                  {useUp.map((r) => (
                    <li key={r.recipe.id}>
                      <Link
                        to="/recipes/$id"
                        params={{ id: r.recipe.id }}
                        className="flex items-center justify-between gap-3 py-2.5 hover:text-primary"
                      >
                        <span className="truncate">{r.recipe.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {r.missing.length === 0 ? "have everything" : `missing ${r.missing.length}`} · {r.recipe.minutes} min
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {recent.length > 0 && (members.data?.length ?? 0) > 1 && (
        <section className="px-1">
          <h2 className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-sans">Lately</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {recent.map((i) => (
              <li key={i.id}>
                <span className="text-foreground">{nameOf(i.requested_by)}</span> added {i.name.toLowerCase()} to the list
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
