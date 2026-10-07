import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { extractReceipt, type ExtractedItem } from "@/lib/receipt.functions";
import { recordStaplePurchases, useListItems, useSession, type Household } from "@/lib/data";
import { CATEGORIES, CATEGORY_LABEL, LOCATIONS, LOCATION_LABEL, addDays, sameProduct } from "@/lib/food";

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

const STAGES = ["Preparing the photo…", "Reading the receipt…", "Working out where things live…"];

/** Extraction is a best guess — flag the rows most likely to need a human look. */
function needsCheck(item: ExtractedItem) {
  const name = item.name.trim();
  return name.length < 3 || item.category === "other" || !(item.shelf_life_days > 0);
}

function ScanBody({ household }: { household: Household }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ExtractedItem[] | null>(null);
  const [stage, setStage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // List items the user has un-ticked from "this matches your list".
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const extract = useServerFn(extractReceipt);
  const { userId } = useSession();
  const { data: listItems = [] } = useListItems(household.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const busy = stage !== null;

  const openList = useMemo(() => listItems.filter((i) => i.status === "open"), [listItems]);

  /** For each scanned row, the open list item it probably corresponds to (each list item used once). */
  const matches = useMemo(() => {
    const taken = new Set<string>();
    return (items ?? []).map((item) => {
      if (!item.name.trim()) return null;
      const hit = openList.find((li) => !taken.has(li.id) && sameProduct(li.name, item.name));
      if (hit) taken.add(hit.id);
      return hit ?? null;
    });
  }, [items, openList]);

  async function onFile(file: File) {
    setStage(0);
    try {
      const dataUrl = await toCompressedDataUrl(file);
      if (dataUrl.length > 11_000_000) {
        toast.error("That photo is too large — try one that's just the receipt.");
        return;
      }
      setStage(1);
      const timer = window.setTimeout(() => setStage(2), 4000);
      let result: Awaited<ReturnType<typeof extract>>;
      try {
        result = await extract({ data: { imageDataUrl: dataUrl } });
      } finally {
        window.clearTimeout(timer);
      }
      if (result.items.length === 0) {
        toast.error("No items found — try a clearer photo of the whole receipt.");
        return;
      }
      setDeclined(new Set());
      setItems(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that receipt.");
    } finally {
      setStage(null);
    }
  }

  function updateItem(index: number, patch: Partial<ExtractedItem>) {
    setItems((current) =>
      current ? current.map((item, i) => (i === index ? { ...item, ...patch } : item)) : current,
    );
  }

  const kept = (items ?? []).filter((i) => i.name.trim());
  const confirmedMatches = matches.filter(
    (m, i): m is NonNullable<typeof m> => !!m && !!items?.[i]?.name.trim() && !declined.has(m.id),
  );

  async function save() {
    if (kept.length === 0 || saving) return;
    setSaving(true);
    try {
      const rows = kept.map((item) => ({
        household_id: household.id,
        name: item.name.trim(),
        quantity: item.quantity?.trim() || null,
        category: item.category,
        location: item.location,
        expires_on: addDays(Math.max(1, Math.round(item.shelf_life_days || 7))),
        added_by: userId,
      }));
      const { error } = await supabase.from("inventory_items").insert(rows);
      if (error) throw error;

      // Only list items the user left ticked are removed — never a silent fuzzy match.
      if (confirmedMatches.length > 0) {
        const { error: tickError } = await supabase
          .from("list_items")
          .delete()
          .in(
            "id",
            confirmedMatches.map((m) => m.id),
          );
        if (tickError) throw tickError;
      }
      await recordStaplePurchases(
        household.id,
        kept.map((i) => i.name),
      );

      await qc.invalidateQueries();
      toast.success(
        `${kept.length} ${kept.length === 1 ? "grocery" : "groceries"} added to your kitchen` +
          (confirmedMatches.length > 0
            ? ` · ${confirmedMatches.length} shopping-list ${confirmedMatches.length === 1 ? "item" : "items"} checked off`
            : ""),
      );
      navigate({ to: "/kitchen" });
    } catch {
      toast.error("Couldn't save those items — nothing was lost, try again.");
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
        <div className="card-soft p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Camera className="size-8 text-primary" strokeWidth={1.4} aria-hidden />
            <h2 className="mt-4 text-xl">Photograph your receipt</h2>
          </div>
          <ul className="mx-auto mt-5 max-w-sm space-y-2 text-sm text-muted-foreground">
            <li>Lay it flat and get the whole receipt in frame, top to bottom.</li>
            <li>Use good light and avoid shadows or glare.</li>
            <li>You'll review everything before it goes into your kitchen.</li>
          </ul>
          {busy ? (
            <div className="mt-7 flex flex-col items-center gap-3" role="status" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              <p className="text-sm">{STAGES[stage ?? 0]}</p>
              <div className="flex gap-1.5" aria-hidden>
                {STAGES.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 w-10 rounded-full transition-colors",
                      i <= (stage ?? 0) ? "bg-primary" : "bg-secondary",
                    )}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-7 flex justify-center">
              <Button className="rounded-full px-7" onClick={() => fileInput.current?.click()}>
                Choose or take a photo
              </Button>
            </div>
          )}
        </div>
      )}

      {items && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl">Review {items.length} items</h2>
              <p className="text-sm text-muted-foreground">
                Nothing is saved until you confirm. Fix anything that looks off.
              </p>
            </div>
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
              {items.map((item, index) => {
                const match = matches[index];
                const check = needsCheck(item);
                return (
                  <li
                    key={index}
                    className="border-b border-border/60 px-4 py-4 last:border-0 sm:px-6"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          aria-label={`Name of item ${index + 1}`}
                          value={item.name}
                          onChange={(e) => updateItem(index, { name: e.target.value })}
                          className="h-10"
                        />
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <Input
                            aria-label={`Quantity of ${item.name}`}
                            placeholder="Amount"
                            value={item.quantity ?? ""}
                            onChange={(e) => updateItem(index, { quantity: e.target.value || null })}
                            className="h-9"
                          />
                          <select
                            aria-label={`Category of ${item.name}`}
                            value={item.category}
                            onChange={(e) => updateItem(index, { category: e.target.value })}
                            className="h-9 rounded-md border border-input bg-background px-2"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label={`Where ${item.name} is kept`}
                            value={item.location}
                            onChange={(e) => updateItem(index, { location: e.target.value })}
                            className="h-9 rounded-md border border-input bg-background px-2"
                          >
                            {LOCATIONS.map((l) => (
                              <option key={l} value={l}>
                                {LOCATION_LABEL[l]}
                              </option>
                            ))}
                          </select>
                          <label className="flex h-9 items-center gap-1.5 text-xs text-muted-foreground">
                            Keeps
                            <Input
                              type="number"
                              min={1}
                              inputMode="numeric"
                              aria-label={`Days ${item.name} keeps`}
                              value={Math.max(1, Math.round(item.shelf_life_days || 7))}
                              onChange={(e) =>
                                updateItem(index, { shelf_life_days: Number(e.target.value) || 1 })
                              }
                              className="h-9 w-16 px-2"
                            />
                            days
                          </label>
                        </div>
                        {check && (
                          <p className="flex items-center gap-1.5 text-xs text-clay">
                            <AlertCircle className="size-3.5" aria-hidden /> Worth a quick check —
                            we weren't sure about this one.
                          </p>
                        )}
                        {match && (
                          <label className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs">
                            <Checkbox
                              checked={!declined.has(match.id)}
                              onCheckedChange={(checked) =>
                                setDeclined((current) => {
                                  const next = new Set(current);
                                  if (checked) next.delete(match.id);
                                  else next.add(match.id);
                                  return next;
                                })
                              }
                            />
                            <span>
                              Matches “{match.name}” on your list — check it off
                            </span>
                          </label>
                        )}
                      </div>
                      <button
                        aria-label={`Remove ${item.name || `item ${index + 1}`}`}
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                        className="-mr-1 p-2 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="sticky bottom-24 sm:bottom-4">
            <Button
              className="h-12 w-full rounded-full shadow-[var(--shadow-lift)]"
              onClick={save}
              disabled={saving || kept.length === 0}
            >
              {saving
                ? "Putting things away…"
                : `Add ${kept.length} ${kept.length === 1 ? "grocery" : "groceries"} to the kitchen` +
                  (confirmedMatches.length > 0 ? ` · check off ${confirmedMatches.length}` : "")}
            </Button>
          </div>
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

