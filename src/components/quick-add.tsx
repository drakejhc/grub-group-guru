import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  LOCATIONS,
  LOCATION_LABEL,
  addDays,
  defaultStorage,
  guessCategory,
  type StorageLocation,
} from "@/lib/food";
import { addToList, listToast, useMutate, useSession } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Floating add button: adds to the kitchen on the Kitchen page, otherwise to the shared list. */
export function QuickAdd({ householdId }: { householdId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode: "kitchen" | "list" = pathname.startsWith("/kitchen") ? "kitchen" : "list";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState<StorageLocation | null>(null);
  const [expires, setExpires] = useState("");
  const { userId } = useSession();

  const category = guessCategory(name);
  const storage = defaultStorage(category);
  const loc = location ?? storage.location;

  const add = useMutate(async () => {
    if (!name.trim() || !userId) return null;
    if (mode === "list") {
      return listToast(
        await addToList(householdId, userId, [
          { name: name.trim(), quantity: quantity.trim() || null, category },
        ]),
      );
    }
    const { error } = await supabase.from("inventory_items").insert({
      household_id: householdId,
      name: name.trim(),
      quantity: quantity.trim() || null,
      category,
      location: loc,
      expires_on: expires || addDays(storage.days),
      added_by: userId,
    });
    if (error) throw error;
    return `${name.trim()} added to the ${LOCATION_LABEL[loc].toLowerCase()}`;
  }, ["list", "inventory"], { errorMessage: "Couldn't add that just now — try again" });

  function reset() {
    setName("");
    setQuantity("");
    setLocation(null);
    setExpires("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(undefined as never, {
      onSuccess: (message) => {
        if (message) toast.success(String(message));
        reset();
        setOpen(false);
      },
    });
  }

  const label = mode === "kitchen" ? "Add to the kitchen" : "Add to the list";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={label}
        className="fixed bottom-24 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 sm:bottom-8 sm:right-8"
      >
        <Plus className="size-6" strokeWidth={2} aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {mode === "kitchen"
                ? "We'll guess where it lives and how long it keeps — change anything."
                : "Everyone in your household sees it straight away."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <Input
              autoFocus
              autoComplete="off"
              aria-label="Item"
              placeholder={mode === "kitchen" ? "Greek yoghurt" : "Milk"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
            />
            <Input
              aria-label="Quantity"
              placeholder="How much? (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {mode === "kitchen" && (
              <>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Where it's kept">
                  {LOCATIONS.map((l) => (
                    <button
                      type="button"
                      key={l}
                      role="radio"
                      aria-checked={loc === l}
                      onClick={() => setLocation(l)}
                      className={cn(
                        "flex-1 rounded-full border border-border py-2 text-sm transition-colors",
                        loc === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary",
                      )}
                    >
                      {LOCATION_LABEL[l]}
                    </button>
                  ))}
                </div>
                <label className="block text-xs text-muted-foreground">
                  Use by {expires ? "" : `(we'd guess ${addDays(storage.days)})`}
                  <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-1" />
                </label>
              </>
            )}
            <Button type="submit" className="h-11 w-full rounded-full" disabled={!name.trim() || add.isPending}>
              {add.isPending ? "Adding…" : "Add it"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
