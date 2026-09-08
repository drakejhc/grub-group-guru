import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  recordStaplePurchases,
  useListItems,
  useMembers,
  useMutate,
  useSession,
  type Household,
  type ListItem,
} from "@/lib/data";

import { CATEGORIES, CATEGORY_LABEL, addDays, defaultStorage, type Category } from "@/lib/food";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/list")({
  head: () => ({
    meta: [
      { title: "Shared list — Larder" },
      {
        name: "description",
        content: "One shopping list the whole household adds to, grouped by aisle.",
      },
      { property: "og:title", content: "Shared list — Larder" },
      {
        property: "og:description",
        content: "One shopping list the whole household adds to, grouped by aisle.",
      },
    ],
  }),
  component: () => (
    <AppShell title="The list" subtitle="Anyone can add. Tick things off as you shop.">
      {(household) => <ListBody household={household} />}
    </AppShell>
  ),
});

function ListBody({ household }: { household: Household }) {
  const { data: items = [], isLoading } = useListItems(household.id);
  const { data: members = [] } = useMembers(household.id);
  const { userId } = useSession();
  const [shopping, setShopping] = useState(false);

  const open = items.filter((i) => i.status === "open");
  const purchased = items.filter((i) => i.status === "purchased");

  const toggle = useMutate(async (item: ListItem) => {
    const { error } = await supabase
      .from("list_items")
      .update({
        status: item.status === "open" ? "purchased" : "open",
        purchased_at: item.status === "open" ? new Date().toISOString() : null,
      })
      .eq("id", item.id);
    if (error) throw error;
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

  const putAway = useMutate(async () => {
    if (purchased.length === 0) return;
    const rows = purchased.map((item) => {
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
    const { error: clearError } = await supabase
      .from("list_items")
      .delete()
      .in(
        "id",
        purchased.map((p) => p.id),
      );
    if (clearError) throw clearError;
    await recordStaplePurchases(
      household.id,
      purchased.map((p) => p.name),
    );
  }, ["list", "inventory", "staples"]);


  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? "Someone";

  const grouped = CATEGORIES.map((category) => ({
    category,
    items: open.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the list…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {open.length} to buy{purchased.length > 0 && ` · ${purchased.length} in the basket`}
        </p>
        <Button
          size="sm"
          variant={shopping ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setShopping((v) => !v)}
        >
          <ShoppingBasket className="mr-1.5 size-4" aria-hidden />
          {shopping ? "In the shop" : "Shopping mode"}
        </Button>
      </div>

      {open.length === 0 && purchased.length === 0 && (
        <div className="card-soft p-10 text-center">
          <p className="text-muted-foreground">
            The list is empty. Tap the green button to add the first thing.
          </p>
        </div>
      )}

      {grouped.map((group) => (
        <section key={group.category} className="card-soft overflow-hidden">
          <h2 className="border-b border-border/70 px-6 py-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABEL[group.category]}
          </h2>
          <ul>
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 border-b border-border/60 px-6 last:border-0"
              >
                <button
                  aria-label={`Mark ${item.name} as bought`}
                  onClick={() => toggle.mutate(item)}
                  className={cn(
                    "my-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:border-primary",
                    shopping && "size-9",
                  )}
                >
                  <Check className="size-4 text-transparent" aria-hidden />
                </button>
                <div className={cn("flex-1 py-3", shopping && "py-4")}>
                  <p className={cn(shopping && "text-lg")}>
                    {item.name}
                    {item.quantity && (
                      <span className="ml-2 text-muted-foreground">{item.quantity}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{nameOf(item.requested_by)}</p>
                </div>
                <button
                  aria-label={`Remove ${item.name}`}
                  onClick={() => remove.mutate(item.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {purchased.length > 0 && (
        <section className="card-soft p-6">
          <h2 className="text-xl">In the basket</h2>
          <ul className="mt-3 space-y-2">
            {purchased.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <button
                  onClick={() => toggle.mutate(item)}
                  className="text-left text-muted-foreground line-through"
                >
                  {item.name}
                </button>
                <span className="text-xs text-muted-foreground">tap to undo</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-5 w-full rounded-full"
            onClick={() =>
              putAway.mutate(undefined as never, {
                onSuccess: () => toast.success("Shopping put away in your kitchen"),
                onError: () => toast.error("Couldn't put that away"),
              })
            }
          >
            Put the shopping away
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Moves these into your kitchen with an estimated date.
          </p>
        </section>
      )}
    </div>
  );
}
