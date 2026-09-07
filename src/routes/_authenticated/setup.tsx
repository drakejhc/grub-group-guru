import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useEnsureProfile } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Set up your household — Larder" },
      { name: "description", content: "Create a household or join one with a code." },
      { property: "og:title", content: "Set up your household — Larder" },
      { property: "og:description", content: "Create a household or join one with a code." },
    ],
  }),
  component: Setup,
});

const STARTER_STAPLES = [
  { name: "Milk", category: "dairy", interval_days: 5 },
  { name: "Bread", category: "bakery", interval_days: 4 },
  { name: "Eggs", category: "dairy", interval_days: 10 },
  { name: "Coffee", category: "drinks", interval_days: 21 },
  { name: "Washing-up liquid", category: "household", interval_days: 45 },
];

function Setup() {
  useEnsureProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId } = useSession();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createHousehold(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      const householdId = crypto.randomUUID();
      const { error } = await supabase
        .from("households")
        .insert({ id: householdId, name: name.trim() || "Our household", created_by: userId });
      if (error) throw error;
      const { error: memberError } = await supabase
        .from("household_members")
        .insert({ household_id: householdId, user_id: userId, role: "owner" });
      if (memberError) throw memberError;
      const { data: created } = await supabase
        .from("households")
        .select("invite_code")
        .eq("id", householdId)
        .maybeSingle();
      if (created?.invite_code) {
        await supabase
          .from("household_invites")
          .insert({ code: created.invite_code, household_id: householdId });
      }
      await supabase
        .from("staples")
        .insert(STARTER_STAPLES.map((s) => ({ ...s, household_id: householdId })));
      await qc.invalidateQueries();
      navigate({ to: "/today", replace: true });
    } catch {
      toast.error("Couldn't create the household");
    } finally {
      setBusy(false);
    }
  }

  async function joinHousehold(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("household_invites")
        .select("household_id")
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("No household with that code");
        return;
      }
      const { error: joinError } = await supabase
        .from("household_members")
        .insert({ household_id: data.household_id, user_id: userId });
      if (joinError) throw joinError;
      await qc.invalidateQueries();
      navigate({ to: "/today", replace: true });
    } catch {
      toast.error("Couldn't join that household");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <h1 className="text-3xl">Set up your household</h1>
      <p className="mt-2 text-muted-foreground">
        A household is the group of people who share a list, a kitchen and the week's meals.
      </p>

      <form onSubmit={createHousehold} className="card-soft mt-8 space-y-4 p-7">
        <h2 className="text-xl">Start a new one</h2>
        <div className="space-y-2">
          <Label htmlFor="hname">Household name</Label>
          <Input
            id="hname"
            placeholder="The Kellys"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={busy}>
          Create household
        </Button>
      </form>

      <form onSubmit={joinHousehold} className="card-soft mt-5 space-y-4 p-7">
        <h2 className="text-xl">Join with a code</h2>
        <p className="text-sm text-muted-foreground">
          Whoever set up your household can find the code on their Household page.
        </p>
        <Input
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="uppercase"
        />
        <Button
          type="submit"
          variant="outline"
          className="w-full rounded-full"
          disabled={busy || code.trim().length < 4}
        >
          Join household
        </Button>
      </form>
    </main>
  );
}
