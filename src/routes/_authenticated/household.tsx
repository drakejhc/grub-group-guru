import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMembers, useMutate, useSession, useStaples, type Household } from "@/lib/data";
import { daysUntil, guessCategory, stapleDue } from "@/lib/food";

export const Route = createFileRoute("/_authenticated/household")({
  head: () => ({
    meta: [
      { title: "Household — Larder" },
      {
        name: "description",
        content: "Invite the people you live with and set the staples you buy regularly.",
      },
      { property: "og:title", content: "Household — Larder" },
      {
        property: "og:description",
        content: "Invite the people you live with and set the staples you buy regularly.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Household" subtitle="Who's in it, and what you always buy.">
      {(household) => <HouseholdBody household={household} />}
    </AppShell>
  ),
});

function HouseholdBody({ household }: { household: Household }) {
  const { data: members = [] } = useMembers(household.id);
  const { data: staples = [] } = useStaples(household.id);
  const { userId } = useSession();
  const [newStaple, setNewStaple] = useState("");
  const [name, setName] = useState("");

  const addStaple = useMutate(async (value: string) => {
    const { error } = await supabase.from("staples").insert({
      household_id: household.id,
      name: value.trim(),
      category: guessCategory(value),
    });
    if (error) throw error;
  }, ["staples"]);

  const removeStaple = useMutate(async (id: string) => {
    const { error } = await supabase.from("staples").delete().eq("id", id);
    if (error) throw error;
  }, ["staples"]);

  const stapleToList = useMutate(async (staple: { name: string; category: string }) => {
    if (!userId) return;
    const { error } = await supabase.from("list_items").insert({
      household_id: household.id,
      name: staple.name,
      category: staple.category,
      requested_by: userId,
    });
    if (error) throw error;
  }, ["list"]);

  const rename = useMutate(async (value: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: value.trim() })
      .eq("id", userId!);
    if (error) throw error;
  }, ["members"]);

  return (
    <div className="space-y-4">
      <section className="card-soft p-7">
        <h2 className="text-xl">{household.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this code with the people you live with — they enter it when they sign up.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <code className="rounded-xl bg-secondary px-5 py-3 font-display text-2xl tracking-[0.2em]">
            {household.invite_code}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              void navigator.clipboard.writeText(household.invite_code);
              toast.success("Code copied");
            }}
          >
            <Copy className="mr-1.5 size-4" aria-hidden /> Copy
          </Button>
        </div>

        <ul className="mt-7 space-y-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                {member.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span>{member.display_name}</span>
              {member.role === "owner" && (
                <span className="text-xs text-muted-foreground">set this up</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card-soft p-7">
        <h2 className="text-xl">Your name</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is what the household sees next to the things you add.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            rename.mutate(name, {
              onSuccess: () => {
                toast.success("Name updated");
                setName("");
              },
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
          <Button type="submit" variant="outline" className="rounded-full px-5">
            Save
          </Button>
        </form>
      </section>

      <section className="card-soft p-7">
        <h2 className="text-xl">Staples</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Things you buy regularly. Larder reminds you when one is probably running low.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newStaple.trim()) return;
            addStaple.mutate(newStaple, { onSuccess: () => setNewStaple("") });
          }}
        >
          <Input
            value={newStaple}
            onChange={(e) => setNewStaple(e.target.value)}
            placeholder="Milk"
          />
          <Button type="submit" variant="outline" className="rounded-full px-5">
            Add
          </Button>
        </form>

        <ul className="mt-5 space-y-3">
          {staples.map((staple) => {
            const since = staple.last_purchased_on ? -(daysUntil(staple.last_purchased_on) ?? 0) : null;
            const due = stapleDue(staple);
            return (
              <li key={staple.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p>{staple.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {since === null
                      ? `usually every ${staple.interval_days} days — not bought yet`
                      : due
                        ? `last bought ${since} days ago — probably due`
                        : `bought ${since} days ago`}
                  </p>
                </div>

                <button
                  onClick={() =>
                    stapleToList.mutate(staple, {
                      onSuccess: () => toast.success(`${staple.name} added to the list`),
                    })
                  }
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Add to list
                </button>
                <button
                  aria-label={`Remove ${staple.name}`}
                  onClick={() => removeStaple.mutate(staple.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
