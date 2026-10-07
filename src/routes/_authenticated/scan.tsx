import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { extractReceipt, type ExtractedItem } from "@/lib/receipt.functions";
import { recordStaplePurchases, useSession, type Household } from "@/lib/data";
import { LOCATIONS, LOCATION_LABEL, addDays, matchesAny, type StorageLocation } from "@/lib/food";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan a receipt — Larder" },
      {
        name: "description",
        content: "Photograph your grocery receipt and your kitchen fills itself in.",
      },
      { property: "og:title", content: "Scan a receipt — Larder" },
      {
        property: "og:description",
        content: "Photograph your grocery receipt and your kitchen fills itself in.",
      },
    ],
  }),
  component: () => (
    <AppShell
      title="Scan a receipt"
      subtitle="Take a photo on the way out of the shop — everything lands in your kitchen."
    >
      {(household) => <ScanBody household={household} />}
    </AppShell>
  ),
});

function ScanBody({ household }: { household: Household }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ExtractedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const extract = useServerFn(extractReceipt);
  const { userId } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function onFile(file: File) {
    setBusy(true);
    try {
      const dataUrl = await toCompressedDataUrl(file);
      if (dataUrl.length > 11_000_000) {
        toast.error("That photo is too large — try one that's just the receipt.");
        return;
      }
      const result = await extract({ data: { imageDataUrl: dataUrl } });
      if (result.items.length === 0) {
        toast.error("No items found — try a clearer photo of the whole receipt.");
      }
      setItems(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that receipt.");
    } finally {
      setBusy(false);
    }
  }


  function updateItem(index: number, patch: Partial<ExtractedItem>) {
    setItems((current) =>
      current ? current.map((item, i) => (i === index ? { ...item, ...patch } : item)) : current,
    );
  }

  async function save() {
    const kept = items?.filter((i) => i.name.trim()) ?? [];
    if (kept.length === 0 || saving) return;
    setSaving(true);
    try {
      const rows = kept.map((item) => ({
        household_id: household.id,
        name: item.name.trim(),
        quantity: item.quantity ?? null,
        category: item.category,
        location: item.location,
        expires_on: addDays(Math.max(1, Math.round(item.shelf_life_days || 7))),
        added_by: userId,
      }));
      const { error } = await supabase.from("inventory_items").insert(rows);
      if (error) throw error;

      const names = kept.map((i) => i.name);
      const { data: openItems } = await supabase
        .from("list_items")
        .select("id, name")
        .eq("household_id", household.id)
        .eq("status", "open");
      const matched = (openItems ?? []).filter((li) => matchesAny(li.name, names));
      if (matched.length > 0) {
        const { error: tickError } = await supabase
          .from("list_items")
          .delete()
          .in(
            "id",
            matched.map((m) => m.id),
          );
        if (tickError) throw tickError;
      }
      await recordStaplePurchases(household.id, names);


      await qc.invalidateQueries();
      toast.success(
        matched.length > 0
          ? `${kept.length} items put away, ${matched.length} ticked off the list`
          : `${kept.length} items put away`,
      );
      navigate({ to: "/kitchen" });
    } catch {
      toast.error("Couldn't save those items");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />

      {!items && (
        <div className="card-soft flex flex-col items-center p-12 text-center">
          <Camera className="size-8 text-primary" strokeWidth={1.4} aria-hidden />
          <p className="mt-5 max-w-sm text-sm text-muted-foreground">
            Lay the receipt flat, get the whole thing in frame, and we'll work out what you bought
            and where it lives at home.
          </p>
          <Button
            className="mt-7 rounded-full px-7"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Reading the receipt…
              </>
            ) : (
              "Choose or take a photo"
            )}
          </Button>
        </div>
      )}

      {items && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {items.length} items found. Fix any names or places that are wrong, or remove them.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => setItems(null)}
            >
              Start over
            </Button>
          </div>

          <section className="card-soft overflow-hidden">
            <ul>
              {items.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 border-b border-border/60 px-6 py-3.5 last:border-0"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input
                      aria-label={`Name of ${item.name}`}
                      value={item.name}
                      onChange={(e) => updateItem(index, { name: e.target.value })}
                      className="h-9"
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <select
                        aria-label={`Where ${item.name} is kept`}
                        value={item.location}
                        onChange={(e) => updateItem(index, { location: e.target.value })}
                        className="rounded-md border border-border bg-background px-2 py-1"
                      >
                        {LOCATIONS.map((l) => (
                          <option key={l} value={l}>
                            {LOCATION_LABEL[l]}
                          </option>
                        ))}
                      </select>
                      <span>keeps ~{Math.max(1, Math.round(item.shelf_life_days || 7))} days</span>
                    </div>
                  </div>
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() => setItems(items.filter((_, i) => i !== index))}
                    className="-mr-2 p-2 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <Button
            className={cn("w-full rounded-full")}
            onClick={save}
            disabled={saving || items.length === 0}
          >
            {saving ? "Putting things away…" : "Put it all in the kitchen"}
          </Button>
        </>
      )}
    </div>
  );
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

/** Shrink a phone photo before sending it — full-size images are slow and can be rejected. */
async function toCompressedDataUrl(file: File, maxSide = 1600): Promise<string> {
  const original = await toDataUrl(file);
  if (typeof document === "undefined") return original;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("bad image"));
      img.src = original;
    });
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    if (scale === 1 && original.length < 3_000_000) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL("image/jpeg", 0.82);
    return out.length < original.length ? out : original;
  } catch {
    return original;
  }
}

