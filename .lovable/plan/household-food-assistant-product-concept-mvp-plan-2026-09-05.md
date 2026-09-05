# Household Food Assistant — Product Concept & MVP Plan

## The core insight

Grocery lists, pantry contents, and meal plans are the same data viewed three ways. Every existing app treats them as separate features and makes the human do the syncing: you cook, then remember to remove the item, then remember to add it to the list. The product's whole reason to exist is that **one loop keeps itself updated**:

```text
household adds requests  ->  shared list  ->  receipt scan after shopping
        ^                                              |
        |                                              v
   auto-restock  <-  what's running low  <-  home inventory  ->  meal plan / recipes
```

If that loop closes reliably, the app is useful even if nobody ever opens the recipe section.

## Who it is for

- **Primary: the household food manager** — usually one parent who shops, cooks, and carries all of it mentally. Their pain is not "I need recipes," it is the invisible coordination work: chasing requests, forgetting the one thing, re-buying what's already in the fridge, tossing spoiled produce, and answering "what's for dinner" every single day.
- **Secondary: everyone else in the house** (partner, teens, students). Their bar is very low: they will add a request in five seconds, but they will never maintain inventory. Any feature that requires them to be diligent will fail.
- **Not the target for v1:** solo optimisers, macro trackers, budget-first users. Those are later expansions.

Design consequence: the manager gets a rich app, everyone else gets an almost frictionless "add / say what you want" surface. Never ask a secondary member to do bookkeeping.

## Where existing apps leave gaps

- **AnyList / Bring / Out of Milk** — good shared lists, no idea what you already own; the list dies at checkout.
- **Paprika / Mealime / Whisk** — good recipes and generated lists, but planning is a solo activity and the pantry is manual data entry nobody sustains.
- **Samsung Family Hub / fridge cams / barcode pantry apps** — inventory exists but demands constant upkeep for little payoff.

The common failure is that **inventory upkeep costs more than it returns**. So the design rule is: inventory must be filled automatically (receipt scan) and must be allowed to be approximate. It is a strong hint, not an accounting ledger.

## What the product actually is

A **household food assistant** with one home screen that answers three questions: what do we need, what do we have, what are we eating. Everything else is supporting detail.

Four connected pillars:

1. **Shared list** — anyone adds anytime, no owner. Requests are attributed ("Maya wants") so the shopper knows who to ask. Store-aisle grouping, real-time sync, offline-tolerant in-store mode with big tap targets.
2. **Home inventory** — populated primarily by photographing the receipt after shopping. Items land in fridge / pantry / freezer with estimated freshness windows. Editable, forgiving, never blocking.
3. **Meals** — a light weekly plan plus recipes. Suggestions are ranked by what the household already has and what expires soonest, not by what looks good on a magazine page.
4. **The loop between them** — cooking a planned meal decrements inventory; depleted staples reappear on the list; expiring items surface as "use this up" meal ideas.

### The "this is actually useful" moments

- Photograph a receipt, and thirty seconds later the house's food is on screen without typing anything.
- Sunday: "You already have most of what four dinners need — here are three ideas, and here are the seven things to buy."
- Wednesday: "Chicken and spinach go off in two days — here's a dinner that uses both."
- Teenager texts nothing, taps twice; the item is on the list with their name on it before it's forgotten.

### Ideas worth considering beyond the original brief

- **Household staples with restock rhythm** — the app learns milk is bought roughly weekly and proposes it rather than waiting to be told. This is quietly the most valuable feature and needs almost no UI.
- **A meal-request lane** — family members request *dinners*, not just ingredients. This solves "what's for dinner" arguments and feeds the planner directly.
- **Waste saved as the scoreboard** — money and food rescued, not calories. It matches the actual motivation of a busy parent.
- **Shopper handoff mode** — whoever is at the store gets a live, focused view; the household sees items check off in real time and can add nothing after checkout starts.

Deliberately excluded from early versions: nutrition tracking, budgets, delivery/store integrations, barcode scanning, social recipe feeds.

## Information architecture

```text
Home (today)  — needs / expiring soon / tonight's meal / quick add
List          — shared, aisle-grouped, attributed, in-store mode
Kitchen       — fridge / pantry / freezer, expiring first, staples
Meals         — week plan, suggestions from inventory, recipe library
Household     — members, invites, stores, staples, preferences & allergies
```

Five tabs, mobile-first. Quick-add is reachable from anywhere in one tap.

## Key flows

1. **Add a request** — open, type or pick a recent item, done. Two taps, no categorisation asked.
2. **Shop** — in-store mode, aisle order, tap to check off, live to the household.
3. **Receipt capture** — photo, items extracted and matched to known products, a single confirmation screen with obvious edit affordances, then inventory updates and purchased items clear from the list.
4. **Plan the week** — see suggestions ranked by on-hand and expiring items, drag meals onto days, generate the missing-ingredients list in one action.
5. **Cook** — mark cooked; ingredients decrement; low staples flow back to the list.

## MVP vs later

**MVP** — household accounts with invites; shared real-time list with attribution and aisle grouping; in-store mode; receipt photo capture with AI extraction and a confirm step; inventory across three locations with freshness estimates and expiring-soon surfacing; simple week plan; recipe library with suggestions ranked by what's on hand; staples list with manual restock; today-focused home screen.

**Next** — learned restock rhythms; meal requests from family; waste-saved scoreboard; smarter product matching across stores; leftovers tracking; multi-store lists.

**Later** — voice add, budget insight, store/delivery integrations, barcode scan, shared household cookbook.

## Visual direction

Calm and premium, matching the reference in feel rather than detail: generous whitespace, soft neutral surfaces with a single warm accent, large readable type, gentle rounded cards, restrained motion. Information density stays low on Home and rises only inside List and Kitchen. Dark mode from the start.

## Technical approach

TanStack Start with a Lovable Cloud backend. Tables for households, memberships, list items, products, inventory items with location and expiry, recipes, meal plan entries, and staples — all guarded by row-level security scoped to household membership, with roles kept in a separate table. Real-time subscriptions drive the shared list. Receipt photos upload to storage; a server function sends the image to the AI gateway's vision model, returns structured line items, and the user confirms before anything is written. Recipe suggestion scoring runs server-side against current inventory. Auth is email plus optional Google sign-in, with invite links for household members.

## Open questions to settle before building

- Whether the first build should be the full five-tab MVP above, or a tighter first release around shared list plus receipt-to-inventory only, with meals added next.
- Whether recipes should start as a seeded starter library or be entirely user-added.
