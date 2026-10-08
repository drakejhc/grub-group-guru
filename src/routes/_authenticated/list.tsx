import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, PartyPopper, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  addToList,
  listToast,
  recordStaplePurchases,
  useListItems,
  useMembers,
  useMutate,
  useSession,
  type Household,
  type ListItem,
} from "@/lib/data";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  LOCATION_LABEL,
  addDays,
  defaultStorage,
  guessCategory,
  type Category,
} from "@/lib/food";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/list")({
  head: () => ({
    meta: [
      { title: "Shared list — Larder" },
      { name: "description", content: "One shopping list the whole household adds to, grouped by aisle." },
      { property: "og:title", content: "Shared list — Larder" },
      { property: "og:description", content: "One shopping list the whole household adds to, grouped by aisle." },
    ],
  }),
  component: () => (
    <AppShell title="The list" subtitle="Anyone can add. Tick things off as you shop.">
      {(household) => <ListBody household={household} />}
    </AppShell>
  ),
});

function ListBody({ household }: { household: Household }) {
  const { data: items = [], isLoading, isError, refetch } = useListItems(household.id);
  const { data: members = [] } = useMembers(household.id);
  const { userId } = useSession();
  const [shopping, setShopping] = useState(false);
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const statusOf = (i: ListItem) => optimistic[i.id] ?? i.status;
  const open = items.filter((i) => statusOf(i) === "open");
  const purchased = items.filter((i) => statusOf(i) === "purchased");
  const total = open.length + purchased.length;

  const toggle = useMutate(async (item: ListItem) => {
    const next = statusOf(item) === "open" ? "purchased" : "open";
    setOptimistic((o) => ({ ...o, [item.id]: next }));
    const { error } = await supabase
      .from("list_items")
      .update({ status: next, purchased_at: next === "purchased" ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) {
      setOptimistic((o) => {
        const { [item.id]: _, ...rest } = o;
        return rest;
      });
      throw error;
    }
  }, ["list"]);

  const add = useMutate(async (name: string) => {
    if (!userId) return null;
    return listToast(await addToList(household.id, userId, [{ name, category: guessCategory(name) }]));
  }, ["list"]);

  const remove = useMutate(async (id: string) => {
    const { error } = await supabase.from("list_items").delete().eq("id", id);
    if (error) throw error;
  }, ["list"]);

  const restore = useMutate(async (item: ListItem) => {
    const { error } = await supabase.from("list_items").insert({
      household_id: item.household_id,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      note: item.note,
      requested_by: item.requested_by,
      status: item.status,
    });
    if (error) throw error;
  }, ["list"]);

  const putAway = useMutate(async (bought: ListItem[]) => {
    if (bought.length === 0) return;
    const rows = bought.map((item) => {
      const storage = defaultStorage(item.category as Category);
      return {
        household_id: household.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        location: storage.location,
        expires_on: addDays(storage.days),
        added_by: userId,
      };
    });
    const { error } = await supabase.from("inventory_items").insert(rows);
    if (error) throw error;
    const { error: clearError } = await supabase.from("list_items").delete().in("id", bought.map((p) => p.id));
    if (clearError) throw clearError;
    await recordStaplePurchases(household.id, bought.map((p) => p.name));
  }, ["list", "inventory", "staples"]);

  const nameOf = (id: string) =>
    id === userId ? "You" : members.find((m) => m.id === id)?.display_name ?? "Someone";

  const grouped = CATEGORIES.map((category) => ({
    category,
    items: open.filter((i) => (i.category as Category) === category || (!CATEGORIES.includes(i.category as Category) && category === "other")),
  })).filter((g) => g.items.length > 0);

  function doPutAway() {
    const bought = purchased;
    const places = Array.from(new Set(bought.map((b) => LOCATION_LABEL[defaultStorage(b.category as Category).location].toLowerCase())));
    putAway.mutate(bought, {
      onSuccess: () => {
        toast.success(`${bought.length} thing${bought.length > 1 ? "s" : ""} put away`, {
          description: `Into the ${places.join(", ")}. Dates are estimates — adjust them in the kitchen.`,
          action: { label: "View kitchen", onClick: () => window.location.assign("/kitchen") },
        });
        setShopping(false);
        setOptimistic({});
      },
      onError: () => toast.error("Couldn't put that away — nothing was changed. Try again."),
    });
  }

  if (isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-full" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  if (isError)
    return (
      <div className="card-soft p-6">
        <p>The list didn't load.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );

  const allDone = shopping && total > 0 && open.length === 0;

  return (
    <div className="space-y-4">
      {!shopping && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = draft.trim();
            if (!name) return;
            add.mutate(name, {
              onSuccess: (msg) => {
                if (msg) toast.success(String(msg));
                setDraft("");
              },
              onError: () => toast.error("Couldn't add that — try again"),
            });
          }}
        >
          <Input
            aria-label="Add to the list"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add something…"
            className="h-12 rounded-full px-5 text-base"
          />
          <Button type="submit" className="h-12 rounded-full px-5" disabled={!draft.trim() || add.isPending}>
            <Plus className="size-4 sm:mr-1" aria-hidden />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </form>
      )}

      {total > 0 && (
        <div className={cn("flex items-center gap-3", shopping && "card-soft sticky top-[4.25rem] z-20 p-4")}>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {shopping ? (
                <>
                  <span className="font-medium tabular-nums">{purchased.length} of {total}</span>{" "}
                  <span className="text-muted-foreground">in the basket</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {open.length} to buy{purchased.length > 0 && ` · ${purchased.length} in the basket`}
                </span>
              )}
            </p>
            {shopping && <Progress value={(purchased.length / total) * 100} className="mt-2 h-1.5" />}
          </div>
          <Button
            size="sm"
            variant={shopping ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setShopping((v) => !v)}
            aria-pressed={shopping}
          >
            <ShoppingBasket className="mr-1.5 size-4" aria-hidden />
            {shopping ? "Done shopping" : "Shopping mode"}
          </Button>
        </div>
      )}

      {total === 0 && (
        <div className="card-soft p-10 text-center">
          <ShoppingBasket className="mx-auto size-8 text-primary" strokeWidth={1.4} aria-hidden />
          <h2 className="mt-4 text-xl">Nothing to buy</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add things above, or pull missing ingredients in from a recipe.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-5 rounded-full">
            <Link to="/recipes">Browse recipes</Link>
          </Button>
        </div>
      )}

      {allDone && (
        <section className="card-soft p-8 text-center">
          <PartyPopper className="mx-auto size-8 text-primary" strokeWidth={1.4} aria-hidden />
          <h2 className="mt-3 text-2xl">Everything's in the basket</h2>
          <p className="mt-1 text-sm text-muted-foreground">Put it away and your kitchen updates itself.</p>
          <Button className="mt-5 h-12 rounded-full px-8" onClick={doPutAway} disabled={putAway.isPending}>
            {putAway.isPending ? "Putting away…" : `Put ${purchased.length} things away`}
          </Button>
        </section>
      )}

      {grouped.map((group) => (
        <section key={group.category} className="card-soft overflow-hidden">
          <h2 className="border-b border-border/70 px-5 py-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABEL[group.category]}
          </h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.id} className="flex items-center gap-1 border-b border-border/60 last:border-0">
                <button
                  onClick={() => toggle.mutate(item)}
                  aria-label={`Mark ${item.name} as bought`}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-4 px-5 text-left transition-colors hover:bg-secondary/60",
                    shopping ? "py-4" : "py-3",
                  )}
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full border-2 border-border",
                      shopping ? "size-9" : "size-7",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate", shopping && "text-lg")}>
                      {item.name}
                      {item.quantity && <span className="ml-2 text-muted-foreground">{item.quantity}</span>}
                    </span>
                    {!shopping && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {nameOf(item.requested_by)}
                        {item.note && ` · ${item.note}`}
                      </span>
                    )}
                    {shopping && item.note && (
                      <span className="block truncate text-sm text-muted-foreground">{item.note}</span>
                    )}
                  </span>
                </button>
                {!shopping && (
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      remove.mutate(item.id, {
                        onSuccess: () =>
                          toast(`${item.name} removed`, {
                            action: { label: "Undo", onClick: () => restore.mutate(item) },
                          }),
                      })
                    }
                    className="mr-2 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {purchased.length > 0 && !allDone && (
        <section className="card-soft p-5">
          <h2 className="text-lg">In the basket</h2>
          <ul className="mt-2">
            {purchased.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => toggle.mutate(item)}
                  aria-label={`Put ${item.name} back on the list`}
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-secondary/60"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" aria-hidden />
                  </span>
                  <span className="flex-1 truncate text-muted-foreground line-through">{item.name}</span>
                  <span className="text-xs text-muted-foreground">undo</span>
                </button>
              </li>
            ))}
          </ul>
          <Button className="mt-4 h-11 w-full rounded-full" onClick={doPutAway} disabled={putAway.isPending}>
            {putAway.isPending ? "Putting away…" : "Put the shopping away"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Moves these into your kitchen with an estimated date.
          </p>
        </section>
      )}
    </div>
  );
}
