# Larder — issue sweep and fix plan

I went through the whole app and the data behind it. Everything below is something I confirmed, not a guess.

## What's broken today

**1. Ticking something off the list gives no feedback**
The tick circle on the list draws an invisible checkmark, so bought and not-bought items look identical until the item jumps to "In the basket". Fix: filled circle with a visible tick, plus a dimmed name.

**2. "Probably running low" never appears**
The home screen only suggests a staple once it has a purchase date recorded, and every staple in the database currently has none (checked: all 10 rows are empty). So the feature is invisible for every household forever. Fix: treat a staple with no purchase history as due, and set the date when the household is set up.

**3. Buying a staple doesn't record it**
When you put shopping away, the app looks for staples using lowercase names ("milk") while they're stored capitalised ("Milk"), so nothing ever matches and the restock rhythm never learns. Fix: case-insensitive matching in both the list and the receipt flows.

**4. Marking a meal cooked can wipe out the wrong food**
Cooking deletes every fridge item that loosely matches an ingredient — all of it, silently, with no undo and no way to say "I only used half". Fix: show what will be used, let you untick items, and remove only what you confirm.

**5. Receipt photos are sent at full size**
A modern phone photo can exceed the size limit and simply fail, or be slow and expensive. Fix: shrink the photo in the browser before sending.

**6. Loose name matching**
"Egg" matching "eggplant" and similar false matches affect the recipe "you already have this" counts and receipt-to-list ticking. Fix: tighter word-level matching.

**7. Invite codes are readable by anyone signed in**
Any signed-in account can read the invite table and join a stranger's household. Fix: look up codes through a checked server-side path instead of an open read.

**8. Smaller things**
- Only the first household you belong to is ever shown; no way to switch.
- Live updates fire for every household's changes, not just yours.
- Meals and staples don't update live for other members.
- Removing an item from the list has no undo.
- "Shopping mode" only makes rows bigger; it doesn't keep working if signal drops in the shop.

## What I'll do

Round 1 — correctness (the loop actually working)
- Visible tick state on the list, with undo on delete.
- Staples: due when never bought, case-insensitive purchase recording from both the list and receipts, purchase date set at setup.
- Cooking a meal: a confirm step showing exactly which kitchen items get used, with items you can untick.
- Tighter ingredient/product matching used everywhere.

Round 2 — reliability
- Resize and compress receipt photos in the browser before sending; friendlier failure messages.
- Live updates scoped to your household, and extended to meals and staples.
- Household switcher when you belong to more than one.

Round 3 — safety
- Join-by-code moves behind a checked server path; the open read on the invite table goes away.

## Technical notes

- List/kitchen/receipt fixes are in `src/routes/_authenticated/list.tsx`, `kitchen.tsx`, `meals.tsx`, `scan.tsx`, with shared matching in `src/lib/food.ts`.
- Realtime scoping and a household switcher live in `src/lib/data.ts` / `src/components/app-shell.tsx`.
- Image downscale via canvas in `scan.tsx` before calling `extractReceipt`.
- Join-by-code becomes a `createServerFn` (`requireSupabaseAuth`) doing the code lookup and membership insert with the admin client; the `household_invites` public SELECT policy is replaced with a members-only one. That's one small migration.
