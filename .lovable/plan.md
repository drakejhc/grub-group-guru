# A real recipe library, cook-with-what-you-have

Today the Meals screen shows eight seeded dinners ranked by what's in your kitchen. That's the right idea with far too little to chew on. This turns it into a proper library you can search by ingredient, save from, and add your own to.

## What changes

**1. A much bigger built-in library**

Roughly 120 everyday dinners, breakfasts and quick lunches, each with a full ingredient list, timing, servings, simple steps and tags (quick, vegetarian, one-pan, batch-cook, kid-friendly). Shipped with the app, so it's instant and works for every household from day one.

**2. A new Recipes screen**

A dedicated tab, separate from the week planner:

- Top of the screen: "You can make 14 right now" — recipes where nothing is missing.
- Below: everything else, ordered by fewest missing ingredients, each showing exactly what's absent.
- Search by name, plus filters for time, tags, and "hide anything missing more than 2 things".
- Tap a recipe for the full page: ingredients ticked against your kitchen, steps, and buttons to plan it for a day or add the missing bits to the list.

**3. Ingredient-first search (the Supercook part)**

Your kitchen contents are the default basket. On the Recipes screen you can also tick extra ingredients you have but haven't logged (salt, oil, a spare tin) or untick something you're saving — results re-rank live. The extra ticks are remembered per household so you don't redo them.

**4. Favourites and your own recipes**

- A heart on any recipe; a "Saved" filter to see them.
- "Add your own recipe" — title, time, servings, ingredients, steps, tags. Your recipes sit in the same ranking as the built-in ones and only your household sees them.

**5. Meals screen gets simpler**

The week planner keeps the day strip and tonight's plan, and its short "ideas for you" list now links through to the full Recipes screen instead of trying to be the library.

## Not in this change

Nutrition and calories, importing recipes from a URL, photos for each recipe, ratings/reviews, and sharing recipes between households.

## Technical notes

- New route `src/routes/_authenticated/recipes.tsx` (list + search) and `recipes.$id.tsx` (detail); nav item added in `app-shell.tsx`.
- Library seeded as `household_id IS NULL` rows in the existing `recipes` / `recipe_ingredients` tables via one migration, so existing read policies and the ranking code already cover it. Own recipes keep using the existing household-scoped insert policy.
- New `recipe_favourites` table (household_id, recipe_id, user_id) with grants and household-scoped RLS, and a `household_pantry_flags` table for the extra ticked ingredients.
- Ranking reuses `matchesAny`/`sameProduct` from `src/lib/food.ts`, computed client-side over the already-cached recipe and inventory queries; the basket is inventory names plus flagged extras.
- `useRecipes` gains ingredient/tag/time filtering; favourites and flags get their own hooks in `src/lib/data.ts` and are added to the household realtime channel.
- Each new route gets its own `head()` title and description.
