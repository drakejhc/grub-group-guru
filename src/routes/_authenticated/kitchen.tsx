import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, ChevronRight, Plus, Refrigerator } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  addToList,
  listToast,
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
      { name: "description", content: "What's actually in your fridge, pantry and freezer, oldest first." },
      { property: "og:title", content: "Kitchen — Larder" },
      { property: "og:description", content: "What's actually in your fridge, pantry and freezer, oldest first." },
    ],
  }),
  component: () => (
    <AppShell title="The kitchen" subtitle="What's at home right now, soonest-to-use first.">
      {(household) => <KitchenBody household={household} />}
    </AppShell>
  ),
});

function KitchenBody({ household }: { household: Household }) {
  const { data: items = [], isLoading, isError, refetch } = useInventory(household.id);
  const { userId } = useSession();
  const [tab, setTab] = useState<StorageLocation>("fridge");
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const add = useMutate(async ({ name, quantity }: { name: string; quantity: string }) => {
    const category = guessCategory(name);
    const storage = defaultStorage(category);
    const { error } = await supabase.from("inventory_items").insert({
      household_id: household.id,
      name: name.trim(),
      quantity: quantity.trim() || null,
      category,
      location: tab,
      expires_on: addDays(tab === "freezer" ? Math.max(storage.days, 90) : storage.days),
      added_by: userId,
    });
    if (error) throw error;
  }, ["inventory"]);

  const visible = items.filter((i) => i.location === tab);
  const soon = visible.filter((i) => {
    const d = daysUntil(i.expires_on);
    return d !== null && d <= 3;
  });
  const later = visible.filter((i) => !soon.includes(i));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label="Storage" className="flex flex-1 gap-1 rounded-full bg-secondary p-1">
          {LOCATIONS.map((loc) => {
            const count = items.filter((i) => i.location === loc).length;
            return (
              <button
                key={loc}
                role="tab"
                aria-selected={tab === loc}
                onClick={() => setTab(loc)}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 text-sm transition-colors",
                  tab === loc ? "bg-card shadow-[var(--shadow-soft)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LOCATION_LABEL[loc]}
                <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
        <Button asChild size="sm" variant="outline" className="hidden rounded-full sm:inline-flex">
          <Link to="/scan">
            <Camera className="mr-1.5 size-4" aria-hidden /> Scan receipt
          </Link>
        </Button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newItem.trim()) return;
          add.mutate(
            { name: newItem, quantity: newQty },
            {
              onSuccess: () => {
                toast.success(`${newItem.trim()} added to the ${LOCATION_LABEL[tab].toLowerCase()}`);
                setNewItem("");
                setNewQty("");
              },
              onError: () => toast.error("Couldn't add that — try again"),
            },
          );
        }}
      >
        <Input
          aria-label="Item name"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={`Add to the ${LOCATION_LABEL[tab].toLowerCase()}…`}
          className="h-11 flex-[3] rounded-full px-4"
        />
        <Input
          aria-label="Quantity"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          placeholder="Qty"
          className="h-11 flex-1 rounded-full px-4"
        />
        <Button type="submit" className="h-11 rounded-full px-4" aria-label="Add item" disabled={!newItem.trim() || add.isPending}>
          <Plus className="size-4" aria-hidden />
        </Button>
      </form>

      {isLoading && <Skeleton className="h-48 rounded-3xl" />}
      {isError && (
        <div className="card-soft p-6">
          <p>Your kitchen didn't load.</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <div className="card-soft p-10 text-center">
          <Refrigerator className="mx-auto size-8 text-primary" strokeWidth={1.4} aria-hidden />
          <h2 className="mt-4 text-xl">Your {LOCATION_LABEL[tab].toLowerCase()} is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            A receipt photo is the fastest way to fill it in — or add things one by one above.
          </p>
          <Button asChild size="sm" className="mt-5 rounded-full">
            <Link to="/scan">
              <Camera className="mr-1.5 size-4" aria-hidden /> Scan a receipt
            </Link>
          </Button>
        </div>
      )}

      {soon.length > 0 && <ItemGroup title="Use soon" items={soon} onOpen={setEditing} />}
      {later.length > 0 && <ItemGroup title={soon.length ? "Everything else" : undefined} items={later} onOpen={setEditing} />}

      <EditItemDialog householdId={household.id} item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ItemGroup({
  title,
  items,
  onOpen,
}: {
  title?: string;
  items: InventoryItem[];
  onOpen: (i: InventoryItem) => void;
}) {
  return (
    <section className="card-soft overflow-hidden">
      {title && (
        <h2 className="border-b border-border/70 px-5 py-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
      )}
      <ul>
        {items.map((item) => {
          const d = daysUntil(item.expires_on);
          const urgent = d !== null && d <= 1;
          const soon = d !== null && d <= 3;
          return (
            <li key={item.id} className="border-b border-border/60 last:border-0">
              <button
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/60"
                aria-label={`Edit ${item.name}`}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-8 w-1 shrink-0 rounded-full",
                    urgent ? "bg-clay" : soon ? "bg-clay/40" : "bg-border",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {item.name}
                    {item.quantity && <span className="ml-2 text-muted-foreground">{item.quantity}</span>}
                  </span>
                  <span className={cn("block text-xs", urgent ? "font-medium text-clay" : soon ? "text-clay" : "text-muted-foreground")}>
                    {freshnessLabel(item.expires_on) ?? "no date set"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EditItemDialog({
  householdId,
  item,
  onClose,
}: {
  householdId: string;
  item: InventoryItem | null;
  onClose: () => void;
}) {
  const { userId } = useSession();
  const [form, setForm] = useState<{ id: string; quantity: string; location: string; expires: string } | null>(null);
  if (item && form?.id !== item.id) {
    setForm({ id: item.id, quantity: item.quantity ?? "", location: item.location, expires: item.expires_on ?? "" });
  }

  const save = useMutate(async () => {
    if (!item || !form) return;
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: form.quantity.trim() || null, location: form.location, expires_on: form.expires || null })
      .eq("id", item.id);
    if (error) throw error;
  }, ["inventory"]);

  const useUp = useMutate(async (target: InventoryItem) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", target.id);
    if (error) throw error;
  }, ["inventory"]);

  const restore = useMutate(async (target: InventoryItem) => {
    const { id: _id, created_at: _c, ...rest } = target;
    const { error } = await supabase.from("inventory_items").insert(rest);
    if (error) throw error;
  }, ["inventory"]);

  const toList = useMutate(async (target: InventoryItem) => {
    if (!userId) return null;
    return listToast(await addToList(householdId, userId, [{ name: target.name, category: target.category }]));
  }, ["list"]);

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {item && form && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">{item.name}</DialogTitle>
              <DialogDescription>{freshnessLabel(item.expires_on) ?? "No date set"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <label className="block text-sm">
                How much is left
                <Input
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="e.g. half, 2 left, 500g"
                  className="mt-1"
                />
              </label>
              <div>
                <p className="text-sm">Where it's kept</p>
                <div className="mt-1 flex gap-1.5">
                  {LOCATIONS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={form.location === l}
                      onClick={() => setForm({ ...form, location: l })}
                      className={cn(
                        "flex-1 rounded-full border border-border py-2 text-sm transition-colors",
                        form.location === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
                      )}
                    >
                      {LOCATION_LABEL[l]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                Use by
                <Input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} className="mt-1" />
              </label>
              <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    toList.mutate(item, {
                      onSuccess: (m) => m && toast.success(String(m)),
                      onError: () => toast.error("Couldn't add to the list"),
                    })
                  }
                >
                  Add to shopping list
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const target = item;
                    useUp.mutate(target, {
                      onSuccess: () => {
                        toast(`${target.name} used up`, {
                          action: { label: "Undo", onClick: () => restore.mutate(target) },
                        });
                        onClose();
                      },
                      onError: () => toast.error("Couldn't update that"),
                    });
                  }}
                >
                  Used it up
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" className="rounded-full" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="rounded-full"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(undefined as never, {
                    onSuccess: () => {
                      toast.success("Saved");
                      onClose();
                    },
                    onError: () => toast.error("Couldn't save — try again"),
                  })
                }
              >
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
