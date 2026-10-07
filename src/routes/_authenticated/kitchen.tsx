import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Pencil, ShoppingCart, Trash2 } from "lucide-react";
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

  const add = useMutate(
    async (name: string) => {
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
    },
    ["inventory"],
    { errorMessage: "Couldn't add that" },
  );

  const remove = useMutate(
    async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    ["inventory"],
    { errorMessage: "Couldn't remove that" },
  );

  const restore = useMutate(
    async (item: InventoryItem) => {
      const { error } = await supabase.from("inventory_items").insert({
        household_id: item.household_id,
        name: item.name,
        quantity: item.quantity,
        location: item.location,
        category: item.category,
        expires_on: item.expires_on,
        added_by: item.added_by,
      });
      if (error) throw error;
    },
    ["inventory"],
    { errorMessage: "Couldn't bring that back" },
  );

  const update = useMutate(
    async (patch: {
      id: string;
      name: string;
      quantity: string | null;
      location: StorageLocation;
      expires_on: string | null;
    }) => {
      const { id, ...fields } = patch;
      const { error } = await supabase.from("inventory_items").update(fields).eq("id", id);
      if (error) throw error;
    },
    ["inventory"],
    { errorMessage: "Couldn't save those changes" },
  );

  const toList = useMutate(
    async (item: InventoryItem) => {
      if (!userId) return null;
      return listToast(
        await addToList(household.id, userId, [{ name: item.name, category: item.category }]),
      );
    },
    ["list"],
    { errorMessage: "Couldn't add that to the list" },
  );

  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const visible = items.filter((i) => i.location === tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {LOCATIONS.map((loc) => (
          <button
            key={loc}
            aria-pressed={tab === loc}
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
          add.mutate(newItem.trim(), { onSuccess: () => setNewItem("") });
        }}
      >
        <Input
          id="kitchen-add"
          autoComplete="off"
          aria-label={`Add something to the ${LOCATION_LABEL[tab].toLowerCase()}`}
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
        <div className="card-soft p-8 text-center sm:p-10">
          <p className="font-display text-xl">
            Your {LOCATION_LABEL[tab].toLowerCase()} is empty.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add what's there, or scan a receipt and let it fill itself in.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" className="rounded-full">
              <Link to="/scan">
                <Camera className="mr-1.5 size-4" aria-hidden /> Scan a receipt
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => document.getElementById("kitchen-add")?.focus()}
            >
              Add an item
            </Button>
          </div>
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
                  className={cn(
                    "flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 sm:px-6",
                    urgent && "border-l-2 border-l-clay",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words">
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
                        onSuccess: (message) => message && toast.success(message),
                      })
                    }
                    aria-label={`Add ${item.name} to the shopping list`}
                    title="Need more — add to the list"
                    className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ShoppingCart className="size-4" aria-hidden />
                  </button>
                  <button
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setEditing(item)}
                    className="p-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
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
                    className="-mr-2 p-2 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <EditDialog
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => update.mutate(patch, { onSuccess: () => setEditing(null) })}
        saving={update.isPending}
      />
    </div>
  );
}

function EditDialog({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (patch: {
    id: string;
    name: string;
    quantity: string | null;
    location: StorageLocation;
    expires_on: string | null;
  }) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {item && <EditForm key={item.id} item={item} onSave={onSave} saving={saving} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  item,
  onSave,
  saving,
}: {
  item: InventoryItem;
  onSave: (patch: {
    id: string;
    name: string;
    quantity: string | null;
    location: StorageLocation;
    expires_on: string | null;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [location, setLocation] = useState(item.location as StorageLocation);
  const [expires, setExpires] = useState(item.expires_on ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({
          id: item.id,
          name: name.trim(),
          quantity: quantity.trim() || null,
          location,
          expires_on: expires || null,
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit {item.name}</DialogTitle>
        <DialogDescription>Fix the amount, where it lives, or how long it keeps.</DialogDescription>
      </DialogHeader>
      <Input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        aria-label="Quantity"
        placeholder="How much? (optional)"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <div className="flex gap-1.5" role="radiogroup" aria-label="Where it's kept">
        {LOCATIONS.map((l) => (
          <button
            type="button"
            key={l}
            role="radio"
            aria-checked={location === l}
            onClick={() => setLocation(l)}
            className={cn(
              "flex-1 rounded-full border border-border py-2 text-sm transition-colors",
              location === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            {LOCATION_LABEL[l]}
          </button>
        ))}
      </div>
      <label className="block text-xs text-muted-foreground">
        Use by
        <Input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          className="mt-1"
        />
      </label>
      <DialogFooter>
        <Button type="submit" className="rounded-full" disabled={!name.trim() || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
