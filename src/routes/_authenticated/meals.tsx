import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import {
  addToList,
  listToast,
  useMealPlan,
  useMutate,
  useSession,
  type Household,
  type MealEntry,
  type RecipeIngredient,
} from "@/lib/data";
import { dayNumber, matchesAny, shortDay, todayStr, weekDates } from "@/lib/food";
import { useRankedRecipes } from "@/lib/recipe-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meals")({
  head: () => ({
    meta: [
      { title: "Meals — Larder" },
      {
        name: "description",
        content: "Plan the week with dinner ideas ranked by what's already in your kitchen.",
      },
      { property: "og:title", content: "Meals — Larder" },
      {
        property: "og:description",
        content: "Plan the week with dinner ideas ranked by what's already in your kitchen.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Meals" subtitle="Ideas ranked by what you already have at home.">
      {(household) => <MealsBody household={household} />}
    </AppShell>
  ),
});

type UseStatus = "used" | "some" | "still";

const USE_OPTIONS: Array<{ value: UseStatus; label: string }> = [
  { value: "used", label: "Used up" },
  { value: "some", label: "Some left" },
  { value: "still", label: "Didn't use" },
];

function weekLabel(offset: number, dates: string[]) {
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  const first = new Date(dates[0]! + "T12:00:00");
  return `Week of ${first.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function MealsBody({ household }: { household: Household }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = useMemo(() => weekDates(weekOffset), [weekOffset]);
  const [selected, setSelected] = useState(() => {
    const today = todayStr();
    return dates.includes(today) ? today : dates[0]!;
  });
  const { ranked: allRanked, inventory } = useRankedRecipes(household.id);
  const { data: plan = [] } = useMealPlan(household.id, dates);
  const { userId } = useSession();

  // Ranked against the kitchen *and* the basics ticked on the Recipes page, so counts agree there.
  const ranked = useMemo(
    () => allRanked.slice(0, 5).map((r) => ({ ...r, have: r.have.length })),
    [allRanked],
  );

  function changeWeek(delta: number) {
    const next = Math.max(0, weekOffset + delta);
    const nextDates = weekDates(next);
    const today = todayStr();
    setWeekOffset(next);
    setSelected(nextDates.includes(today) ? today : nextDates[0]!);
  }

  const addMeal = useMutate(
    async ({ title, recipeId }: { title: string; recipeId: string | null }) => {
      const { error } = await supabase.from("meal_plan_entries").insert({
        household_id: household.id,
        plan_date: selected,
        slot: "dinner",
        recipe_id: recipeId,
        title,
        created_by: userId,
      });
      if (error) throw error;
    },
    ["meals"],
    { errorMessage: "Couldn't plan that" },
  );

  const removeMeal = useMutate(
    async (id: string) => {
      const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id);
      if (error) throw error;
    },
    ["meals"],
    { errorMessage: "Couldn't remove that" },
  );

  const [cooking, setCooking] = useState<{
    entry: MealEntry;
    status: Record<string, UseStatus>;
  } | null>(null);

  /** Kitchen items that match an ingredient of the meal's recipe. */
  function kitchenMatches(entry: MealEntry) {
    const recipe = allRanked.find((r) => r.recipe.id === entry.recipe_id);
    const ingredients = recipe?.ingredients ?? [];
    return inventory.filter((inv) => ingredients.some((ing) => matchesAny(ing.name, [inv.name])));
  }

  const cookCandidates = useMemo(
    () => (cooking ? kitchenMatches(cooking.entry) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cooking?.entry, allRanked, inventory],
  );

  const cookMeal = useMutate(
    async ({ entry, status }: { entry: MealEntry; status: Record<string, UseStatus> }) => {
      const usedUp = Object.keys(status).filter((id) => status[id] === "used");
      if (usedUp.length > 0) {
        const { error: usedError } = await supabase
          .from("inventory_items")
          .delete()
          .in("id", usedUp);
        if (usedError) throw usedError;
      }
      // Quantities are free text, so "partly used" keeps the item and notes it rather than guessing.
      for (const inv of inventory.filter((i) => status[i.id] === "some")) {
        if (inv.quantity?.includes("some used")) continue;
        const { error: partError } = await supabase
          .from("inventory_items")
          .update({ quantity: inv.quantity ? `${inv.quantity} (some used)` : "some used" })
          .eq("id", inv.id);
        if (partError) throw partError;
      }
      // Last, so a failure above leaves the meal un-cooked and the dialog can simply be retried.
      const { error } = await supabase
        .from("meal_plan_entries")
        .update({ cooked: true })
        .eq("id", entry.id);
      if (error) throw error;
    },
    ["meals", "inventory"],
    { errorMessage: "Couldn't update that" },
  );

  function startCooking(entry: MealEntry) {
    // Default to the non-destructive answer: nothing leaves the kitchen unless the user says so.
    setCooking({
      entry,
      status: Object.fromEntries(kitchenMatches(entry).map((c) => [c.id, "some" as UseStatus])),
    });
  }

  const addMissing = useMutate(
    async (missing: RecipeIngredient[]) => {
      if (!userId || missing.length === 0) return null;
      return listToast(
        await addToList(
          household.id,
          userId,
          missing.map((ing) => ({ name: ing.name, quantity: ing.quantity, category: ing.category })),
        ),
      );
    },
    ["list"],
    { errorMessage: "Couldn't add those to the list" },
  );

  const dayMeals = plan.filter((m) => m.plan_date === selected);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          disabled={weekOffset === 0}
          onClick={() => changeWeek(-1)}
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {weekLabel(weekOffset, dates)}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => changeWeek(1)}
          aria-label="Next week"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {dates.map((date) => {
          const planned = plan.filter((m) => m.plan_date === date).length;
          return (
            <button
              key={date}
              aria-pressed={selected === date}
              onClick={() => setSelected(date)}
              className={cn(
                "flex min-w-14 flex-1 flex-col items-center rounded-2xl border border-border px-2 py-3 transition-colors",
                selected === date
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-secondary",
              )}
            >
              <span className="text-[11px] uppercase tracking-wide opacity-70">
                {shortDay(date)}
              </span>
              <span className="mt-1 font-display text-lg leading-none">{dayNumber(date)}</span>
              <span
                className={cn(
                  "mt-2 size-1.5 rounded-full",
                  planned > 0
                    ? selected === date
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <section className="card-soft p-6">
        <h2 className="text-xl">
          {selected === todayStr() ? "Tonight" : shortDay(selected) + "'s dinner"}
        </h2>
        {dayMeals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing planned. Pick something from the ideas below.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dayMeals.map((meal) => (
              <li key={meal.id} className="flex items-center gap-3">
                <span className={cn("flex-1", meal.cooked && "text-muted-foreground line-through")}>
                  {meal.title}
                </span>
                {!meal.cooked && (
                  <button
                    onClick={() => startCooking(meal)}
                    className="flex items-center gap-1 px-1 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Check className="size-3.5" aria-hidden /> Mark cooked
                  </button>
                )}

                <button
                  aria-label={`Remove ${meal.title}`}
                  onClick={() => removeMeal.mutate(meal.id)}
                  className="-mr-2 p-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xl">Ideas for you</h2>
        <Link to="/recipes" className="text-sm text-primary hover:underline">
          Browse all recipes
        </Link>
      </div>
      <div className="space-y-3">
        {ranked.map(({ recipe, ingredients, have, missing }) => (
          <article key={recipe.id} className="card-soft p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link to="/recipes/$id" params={{ id: recipe.id }} className="hover:underline"><h3 className="text-lg">{recipe.title}</h3></Link>
                <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                {recipe.minutes} min
              </span>
            </div>

            <p className="mt-4 text-sm">
              <span className={have > 0 ? "text-primary" : "text-muted-foreground"}>
                {have} of {ingredients.length} {ingredients.length === 1 ? "ingredient" : "ingredients"} at home
              </span>
              {missing.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · missing {missing.map((m) => m.name).join(", ")}
                </span>
              )}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() =>
                  addMeal.mutate(
                    { title: recipe.title, recipeId: recipe.id },
                    { onSuccess: () => toast.success(`Planned for ${shortDay(selected)}`) },
                  )
                }
              >
                <Plus className="mr-1 size-4" aria-hidden /> Plan for {shortDay(selected)}
              </Button>
              {missing.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() =>
                    addMissing.mutate(missing, {
                      onSuccess: (message) => message && toast.success(message),
                    })
                  }
                >
                  Add what's missing to the list
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!cooking} onOpenChange={(open) => !open && setCooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What did you use?</DialogTitle>
            <DialogDescription>
              Only items marked “Used up” leave your kitchen. Everything else stays.
            </DialogDescription>
          </DialogHeader>
          {cookCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in your kitchen matches this meal, so nothing will change.
            </p>
          ) : (
            <ul className="max-h-72 space-y-3 overflow-y-auto">
              {cookCandidates.map((inv) => {
                const current = cooking?.status[inv.id] ?? "some";
                return (
                  <li key={inv.id} className="rounded-2xl border border-border/70 p-3">
                    <p className="truncate text-sm">
                      {inv.name}
                      {inv.quantity && (
                        <span className="ml-2 text-xs text-muted-foreground">{inv.quantity}</span>
                      )}
                    </p>
                    <div
                      className="mt-2 grid grid-cols-3 gap-1.5"
                      role="radiogroup"
                      aria-label={`How much ${inv.name} was used`}
                    >
                      {USE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={current === option.value}
                          onClick={() =>
                            setCooking((c) =>
                              c ? { ...c, status: { ...c.status, [inv.id]: option.value } } : c,
                            )
                          }
                          className={cn(
                            "rounded-full border border-border px-2 py-2 text-xs transition-colors",
                            current === option.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-secondary",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setCooking(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                if (!cooking) return;
                cookMeal.mutate(cooking, {
                  onSuccess: () => {
                    const used = Object.values(cooking.status).filter((v) => v === "used").length;
                    toast.success(
                      used > 0
                        ? `Marked dinner as cooked · ${used} ${used === 1 ? "item" : "items"} used up`
                        : "Marked dinner as cooked",
                    );
                    setCooking(null);
                  },
                });
              }}
              disabled={cookMeal.isPending}
            >
              Mark cooked
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}
