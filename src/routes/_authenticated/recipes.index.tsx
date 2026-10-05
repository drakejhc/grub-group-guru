import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Heart, Plus, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, useSession, type Household } from "@/lib/data";
import { guessCategory, sameProduct } from "@/lib/food";
import { useRankedRecipes, useRecipeActions } from "@/lib/recipe-actions";
import { COMMON_EXTRAS, type RankedRecipe } from "@/lib/recipes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recipes/")({
  head: () => ({
    meta: [
      { title: "Recipes — Larder" },
      {
        name: "description",
        content: "Over a hundred recipes ranked by what you can cook right now with what's at home.",
      },
      { property: "og:title", content: "Recipes — Larder" },
      {
        property: "og:description",
        content: "Over a hundred recipes ranked by what you can cook right now with what's at home.",
      },
    ],
  }),
  component: RecipesLayout,
});

function RecipesLayout() {
  return (
    <AppShell title="Recipes" subtitle="Cook with what you already have.">
      {(household) => <RecipesBody household={household} />}
    </AppShell>
  );
}

const TAGS = ["quick", "vegetarian", "one-pan", "batch-cook", "kid-friendly", "breakfast", "lunch", "dinner"];
const TIMES = [15, 30, 45];

function RecipesBody({ household }: { household: Household }) {
  const { ranked, inventory, flags, favourites, isLoading } = useRankedRecipes(household.id);
  const { toggleFavourite, toggleFlag } = useRecipeActions(household.id);
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [maxTime, setMaxTime] = useState<number | null>(null);
  const [closeOnly, setCloseOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extra, setExtra] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked.filter(({ recipe, ingredients, missing }) => {
      if (q && !recipe.title.toLowerCase().includes(q) && !ingredients.some((i) => i.name.toLowerCase().includes(q)))
        return false;
      if (tags.length && !tags.every((t) => recipe.tags.includes(t))) return false;
      if (maxTime && recipe.minutes > maxTime) return false;
      if (closeOnly && missing.length > 2) return false;
      if (savedOnly && !favourites.has(recipe.id)) return false;
      return true;
    });
  }, [ranked, query, tags, maxTime, closeOnly, savedOnly, favourites]);

  const ready = filtered.filter((r) => r.missing.length === 0);
  const rest = filtered.filter((r) => r.missing.length > 0);
  const extrasOptions = Array.from(new Set([...COMMON_EXTRAS, ...flags.map((f) => f.name)]));
  const inKitchen = (name: string) => inventory.some((i) => sameProduct(i.name, name));

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a dish or an ingredient…"
          className="h-12 rounded-full pl-11"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip active={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
          <Heart className="mr-1 size-3.5" aria-hidden /> Saved
        </Chip>
        <Chip active={closeOnly} onClick={() => setCloseOnly((v) => !v)}>Missing 2 or fewer</Chip>
        {TIMES.map((t) => (
          <Chip key={t} active={maxTime === t} onClick={() => setMaxTime(maxTime === t ? null : t)}>
            ≤ {t} min
          </Chip>
        ))}
        {TAGS.map((t) => (
          <Chip
            key={t}
            active={tags.includes(t)}
            onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
          >
            {t}
          </Chip>
        ))}
      </div>

      <section className="card-soft p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">What else do you have?</h2>
            <p className="text-sm text-muted-foreground">
              Your kitchen counts automatically. Tick basics you haven't logged.
            </p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setShowExtras((v) => !v)}>
            {showExtras ? "Done" : `Edit (${flags.length})`}
          </Button>
        </div>
        {showExtras && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {extrasOptions.map((name) => {
                const flag = flags.find((f) => f.name.toLowerCase() === name.toLowerCase());
                const kitchen = inKitchen(name);
                return (
                  <Chip
                    key={name}
                    active={!!flag || kitchen}
                    disabled={kitchen}
                    onClick={() => toggleFlag.mutate({ name, id: flag?.id })}
                  >
                    {(flag || kitchen) && <Check className="mr-1 size-3.5" aria-hidden />}
                    {name}
                  </Chip>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = extra.trim();
                if (!name || flags.some((f) => f.name.toLowerCase() === name.toLowerCase())) return;
                toggleFlag.mutate({ name });
                setExtra("");
              }}
            >
              <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add something else…" className="rounded-full" />
              <Button type="submit" size="sm" className="rounded-full">Add</Button>
            </form>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-xl">
          {isLoading ? "Loading…" : `You can make ${ready.length} right now`}
        </h2>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setCreating(true)}>
          <Plus className="mr-1 size-4" aria-hidden /> Add your own
        </Button>
      </div>
      <RecipeGrid items={ready} favourites={favourites} onHeart={(id, saved) => toggleFavourite.mutate({ recipeId: id, saved })} />

      {rest.length > 0 && (
        <>
          <h2 className="pt-2 text-xl">Almost there</h2>
          <RecipeGrid items={rest} favourites={favourites} onHeart={(id, saved) => toggleFavourite.mutate({ recipeId: id, saved })} />
        </>
      )}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No recipes match those filters.</p>
      )}

      <NewRecipeDialog householdId={household.id} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center rounded-full border border-border px-3 py-1.5 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
        disabled && "opacity-70",
      )}
    >
      {children}
    </button>
  );
}

function RecipeGrid({
  items,
  favourites,
  onHeart,
}: {
  items: RankedRecipe[];
  favourites: Set<string>;
  onHeart: (id: string, saved: boolean) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ recipe, ingredients, have, missing }) => {
        const saved = favourites.has(recipe.id);
        return (
          <article key={recipe.id} className="card-soft relative p-5">
            <button
              aria-label={saved ? `Unsave ${recipe.title}` : `Save ${recipe.title}`}
              onClick={() => onHeart(recipe.id, saved)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-primary"
            >
              <Heart className={cn("size-5", saved && "fill-primary text-primary")} aria-hidden />
            </button>
            <Link to="/recipes/$id" params={{ id: recipe.id }} className="block pr-8">
              <h3 className="text-lg leading-snug">{recipe.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {recipe.minutes} min · serves {recipe.servings}
                {recipe.household_id && " · yours"}
              </p>
              <p className="mt-3 text-sm">
                {missing.length === 0 ? (
                  <span className="text-primary">Everything at home</span>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {have.length}/{ingredients.length} at home · missing{" "}
                    </span>
                    <span>{missing.map((m) => m.name).join(", ")}</span>
                  </>
                )}
              </p>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

function NewRecipeDialog({
  householdId,
  open,
  onOpenChange,
}: {
  householdId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { userId } = useSession();
  const invalidate = useInvalidate();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [servings, setServings] = useState("4");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const ingLines = ingredients.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || ingLines.length === 0) {
      toast.error("Add a title and at least one ingredient");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          household_id: householdId,
          title: title.trim(),
          minutes: Number(minutes) || 30,
          servings: Number(servings) || 4,
          steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
          tags,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const rows = ingLines.map((line) => {
        // "200g pasta" → quantity "200g", name "pasta"; "pasta" alone stays as name
        const m = line.match(/^([\d½¼¾./]+\s*(?:g|kg|ml|l|tbsp|tsp|cups?|x)?)\s+(.+)$/i);
        const name = (m ? m[2]! : line).trim();
        return {
          recipe_id: data.id,
          name,
          quantity: m ? m[1]!.trim() : null,
          category: guessCategory(name),
        };
      });
      const { error: ingError } = await supabase.from("recipe_ingredients").insert(rows);
      if (ingError) throw ingError;
      invalidate(["recipes"]);
      toast.success("Recipe added");
      setTitle("");
      setIngredients("");
      setSteps("");
      setTags([]);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add your own recipe</DialogTitle>
          <DialogDescription>Only your household will see it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted-foreground">
              Minutes
              <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label className="flex-1 text-xs text-muted-foreground">
              Serves
              <Input type="number" value={servings} onChange={(e) => setServings(e.target.value)} />
            </label>
          </div>
          <Textarea
            rows={5}
            placeholder={"Ingredients, one per line\n200g pasta\n2 garlic cloves"}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          />
          <Textarea
            rows={4}
            placeholder="Steps, one per line"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <Chip
                key={t}
                active={tags.includes(t)}
                onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              >
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            <X className="mr-1 size-4" aria-hidden /> Cancel
          </Button>
          <Button className="rounded-full" disabled={saving} onClick={save}>
            Save recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
