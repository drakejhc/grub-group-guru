import { matchesAny } from "@/lib/food";
import type { Recipe, RecipeIngredient } from "@/lib/data";

/** Always-assumed basics so "salt and pepper" never count as missing. */
export const ASSUMED = ["salt", "black pepper", "water"];

/** Common things people have but rarely log — offered as quick ticks. */
export const COMMON_EXTRAS = [
  "olive oil",
  "butter",
  "flour",
  "garlic",
  "onion",
  "stock cube",
  "soy sauce",
  "honey",
  "rice",
  "pasta",
  "eggs",
  "milk",
  "chopped tomatoes",
  "curry powder",
  "paprika",
  "cumin",
];

export type RankedRecipe = {
  recipe: Recipe & { recipe_ingredients: RecipeIngredient[] };
  ingredients: RecipeIngredient[];
  have: RecipeIngredient[];
  missing: RecipeIngredient[];
};

export function rankRecipes(
  recipes: Array<Recipe & { recipe_ingredients: RecipeIngredient[] }>,
  basket: string[],
): RankedRecipe[] {
  const all = [...basket, ...ASSUMED];
  return recipes
    .map((recipe) => {
      const ingredients = recipe.recipe_ingredients ?? [];
      const have = ingredients.filter((i) => i.optional || matchesAny(i.name, all));
      const missing = ingredients.filter((i) => !i.optional && !matchesAny(i.name, all));
      return { recipe, ingredients, have, missing };
    })
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        b.have.length - a.have.length ||
        a.recipe.minutes - b.recipe.minutes,
    );
}
