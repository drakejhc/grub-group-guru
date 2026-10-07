import { useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  addToList,
  listToast,
  useFavourites,
  useInventory,
  useMutate,
  usePantryFlags,
  useRecipes,
  useSession,
  type RecipeIngredient,
} from "@/lib/data";
import { rankRecipes } from "@/lib/recipes";

/** Recipes ranked against the household basket (kitchen + ticked extras). */
export function useRankedRecipes(householdId: string) {
  const { data: recipes = [], isLoading } = useRecipes(householdId);
  const { data: inventory = [] } = useInventory(householdId);
  const { data: flags = [] } = usePantryFlags(householdId);
  const { data: favourites = new Set<string>() } = useFavourites(householdId);
  const basket = useMemo(
    () => [...inventory.map((i) => i.name), ...flags.map((f) => f.name)],
    [inventory, flags],
  );
  const ranked = useMemo(() => rankRecipes(recipes, basket), [recipes, basket]);
  return { ranked, basket, inventory, flags, favourites, isLoading };
}

export function useRecipeActions(householdId: string) {
  const { userId } = useSession();

  const toggleFavourite = useMutate(
    async ({ recipeId, saved }: { recipeId: string; saved: boolean }) => {
      if (saved) {
        const { error } = await supabase
          .from("recipe_favourites")
          .delete()
          .eq("household_id", householdId)
          .eq("recipe_id", recipeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recipe_favourites")
          .insert({ household_id: householdId, recipe_id: recipeId, user_id: userId! });
        if (error) throw error;
      }
    },
    ["favourites"],
  );

  const toggleFlag = useMutate(
    async ({ name, id }: { name: string; id?: string | undefined }) => {
      if (id) {
        const { error } = await supabase.from("household_pantry_flags").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("household_pantry_flags")
          .insert({ household_id: householdId, name });
        if (error) throw error;
      }
    },
    ["pantry-flags"],
  );

  const addMissing = useMutate(async (missing: RecipeIngredient[]) => {
    if (!userId || missing.length === 0) return null;
    return listToast(
      await addToList(
        householdId,
        userId,
        missing.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          category: ing.category,
        })),
      ),
    );
  }, ["list"]);

  const plan = useMutate(
    async ({ recipeId, title, date }: { recipeId: string; title: string; date: string }) => {
      const { error } = await supabase.from("meal_plan_entries").insert({
        household_id: householdId,
        plan_date: date,
        slot: "dinner",
        recipe_id: recipeId,
        title,
        created_by: userId,
      });
      if (error) throw error;
    },
    ["meals"],
  );

  return { toggleFavourite, toggleFlag, addMissing, plan };
}
