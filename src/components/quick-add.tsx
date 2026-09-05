import { useState } from "react";
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
import { guessCategory } from "@/lib/food";
import { useMutate, useSession } from "@/lib/data";

export function QuickAdd({ householdId }: { householdId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const { userId } = useSession();

  const add = useMutate(async () => {
    if (!name.trim() || !userId) return;
    const { error } = await supabase.from("list_items").insert({
      household_id: householdId,
      name: name.trim(),
      quantity: quantity.trim() || null,
      category: guessCategory(name),
      requested_by: userId,
    });
    if (error) throw error;
  }, ["list"]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(undefined as never, {
      onSuccess: () => {
        toast.success(`${name.trim()} added to the list`);
        setName("");
        setQuantity("");
        setOpen(false);
      },
      onError: () => toast.error("Couldn't add that just now"),
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add something to the list"
        className="fixed bottom-20 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:scale-105 active:scale-95 sm:bottom-8"
      >
        <Plus className="size-6" strokeWidth={2} aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to the list</DialogTitle>
            <DialogDescription>
              Everyone in your household sees it straight away.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <Input
              autoFocus
              placeholder="Milk"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="How much? (optional)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Button type="submit" className="w-full rounded-full" disabled={!name.trim()}>
              Add it
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
