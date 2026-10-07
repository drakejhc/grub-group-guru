import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Heart, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import type { Household } from "@/lib/data";
import { shortDay, todayStr, upcomingDates } from "@/lib/food";
import { useRankedRecipes, useRecipeActions } from "@/lib/recipe-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recipes/$id")({
  head: () => ({
    meta: [
      { title: "Recipe — Larder" },
      { name: "description", content: "Ingredients checked against your kitchen, plus simple steps." },
      { property: "og:title", content: "Recipe — Larder" },
      { property: "og:description", content: "Ingredients checked against your kitchen, plus simple steps." },
    ],
  }),
  component: RecipePage,
});

function RecipePage() {
  const { id } = Route.useParams();
  return (
    <AppShell title="Recipe">{(household) => <RecipeDetail household={household} id={id} />}</AppShell>
  );
}

function RecipeDetail({ household, id }: { household: Household; id: string }) {
  const { ranked, favourites, isLoading } = useRankedRecipes(household.id);
  const { toggleFavourite, addMissing, plan } = useRecipeActions(household.id);
  const dates = useMemo(() => upcomingDates(), []);
  const [date, setDate] = useState(() => dates[0] ?? todayStr());
  const item = ranked.find((r) => r.recipe.id === id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!item)
    return (
      <div className="card-soft p-6">
        <p>That recipe couldn't be found.</p>
        <Link to="/recipes" className="mt-3 inline-block text-sm text-primary">Back to recipes</Link>
      </div>
    );

  const { recipe, ingredients, missing } = item;
  const saved = favourites.has(recipe.id);
  const missingIds = new Set(missing.map((m) => m.id));

  return (
    <div className="space-y-5">
      <Link to="/recipes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All recipes
      </Link>

      <section className="card-soft p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl">{recipe.title}</h2>
            {recipe.description && <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {recipe.minutes} min · serves {recipe.servings}
              {recipe.tags.length > 0 && ` · ${recipe.tags.join(", ")}`}
            </p>
          </div>
          <button
            aria-label={saved ? "Unsave recipe" : "Save recipe"}
            onClick={() => toggleFavourite.mutate({ recipeId: recipe.id, saved })}
            className="text-muted-foreground hover:text-primary"
          >
            <Heart className={cn("size-6", saved && "fill-primary text-primary")} aria-hidden />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto">
            {dates.map((d) => (
              <button
                key={d}
                aria-pressed={d === date}
                onClick={() => setDate(d)}
                className={cn(
                  "rounded-full border border-border px-3 py-1 text-xs",
                  d === date ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                )}
              >
                {d === todayStr() ? "Tonight" : shortDay(d)}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() =>
              plan.mutate(
                { recipeId: recipe.id, title: recipe.title, date },
                { onSuccess: () => toast.success(`Planned for ${shortDay(date)}`) },
              )
            }
          >
            <Plus className="mr-1 size-4" aria-hidden /> Plan it
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
              Add {missing.length} missing to list
            </Button>
          )}
        </div>
      </section>

      <section className="card-soft p-6">
        <h3 className="text-lg">Ingredients</h3>
        <ul className="mt-3 space-y-2">
          {ingredients.map((ing) => {
            const have = !missingIds.has(ing.id);
            return (
              <li key={ing.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border border-border",
                    have && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  <Check className={cn("size-3", !have && "text-transparent")} aria-hidden />
                </span>
                <span className={cn("flex-1", !have && "text-muted-foreground")}>
                  {ing.name}
                  {ing.optional && <span className="text-xs text-muted-foreground"> (optional)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{ing.quantity}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {recipe.steps.length > 0 && (
        <section className="card-soft p-6">
          <h3 className="text-lg">Method</h3>
          <ol className="mt-3 space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="font-display text-primary">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
