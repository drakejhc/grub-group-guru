import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  useInventory,
  useMutate,
  useSession,
  type Household,
  type InventoryItem,
} from "@/lib/data";
import {
  LOCATIONS,
  LOCATION_LABEL,
  addDays,
  daysUntil,
  defaultStorage,
  freshnessLabel,
  guessCategory,
  type StorageLocation,
} from "@/lib/food";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen — Larder" },
      {
        name: "description",
        content: "What's actually in your fridge, pantry and freezer, oldest first.",
      },
      { property: "og:title", content: "Kitchen — Larder" },
      {
        property: "og:description",
        content: "What's actually in your fridge, pantry and freezer, oldest first.",
      },
    ],
  }),
  component: () => (
    <AppShell title="The kitchen" subtitle="What's at home right now.">
      {(household) => <KitchenBody household={household} />}
    </AppShell>
  ),
});

function KitchenBody({ household }: { household: Household }) {
  const { data: items = [], isLoading } = useInventory(household.id);
  const { userId } = useSession();
  const [tab, setTab] = useState<StorageLocation>("fridge");
  const [newItem, setNewItem] = useState("");

  const add = useMutate(async (name: string) => {
    const category = guessCategory(name);
    const storage = defaultStorage(category);
    const { error } = await supabase.from("inventory_items").insert({
      household_id: household.id,
      name: name.trim(),
      category,
      location: tab,
      expires_on: addDays(storage.days),
      added_by: userId,
    });
    if (error) throw error;
  }, ["inventory"]);

  const remove = useMutate(async (id: string) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) throw error;
  }, ["inventory"]);

  const toList = useMutate(async (item: InventoryItem) => {
    if (!userId) return;
    const { error } = await supabase.from("list_items").insert({
      household_id: household.id,
      name: item.name,
      category: item.category,
      requested_by: userId,
    });
    if (error) throw error;
  }, ["list"]);

  const visible = items.filter((i) => i.location === tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            onClick={() => setTab(loc)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              tab === loc
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent",
            )}
          >
            {LOCATION_LABEL[loc]}
            <span className="ml-2 opacity-60">{items.filter((i) => i.location === loc).length}</span>
          </button>
        ))}
        <Button asChild size="sm" variant="ghost" className="ml-auto rounded-full">
          <Link to="/scan">
            <Camera className="mr-1.5 size-4" aria-hidden /> From a receipt
          </Link>
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newItem.trim()) return;
          add.mutate(newItem.trim(), {
            onSuccess: () => setNewItem(""),
            onError: () => toast.error("Couldn't add that"),
          });
        }}
      >
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={`Add something to the ${LOCATION_LABEL[tab].toLowerCase()}`}
        />
        <Button type="submit" variant="outline" className="rounded-full px-5">
          Add
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && visible.length === 0 && (
        <div className="card-soft p-10 text-center">
          <p className="text-muted-foreground">
            Nothing recorded in the {LOCATION_LABEL[tab].toLowerCase()} yet. A receipt photo is the
            fastest way to fill this in.
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <section className="card-soft overflow-hidden">
          <ul>
            {visible.map((item) => {
              const d = daysUntil(item.expires_on);
              const urgent = d !== null && d <= 2;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 border-b border-border/60 px-6 py-3.5 last:border-0"
                >
                  <div className="flex-1">
                    <p>
                      {item.name}
                      {item.quantity && (
                        <span className="ml-2 text-muted-foreground">{item.quantity}</span>
                      )}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        urgent ? "text-clay" : "text-muted-foreground",
                      )}
                    >
                      {freshnessLabel(item.expires_on) ?? "no date"}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      toList.mutate(item, {
                        onSuccess: () => toast.success(`${item.name} added to the list`),
                      })
                    }
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Need more
                  </button>
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove.mutate(item.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
