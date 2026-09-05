import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Profile = { id: string; display_name: string; accent: string };

export type ListItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  category: string;
  note: string | null;
  requested_by: string;
  status: string;
  purchased_at: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  location: string;
  category: string;
  expires_on: string | null;
  added_by: string | null;
  created_at: string;
};

export type Staple = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  interval_days: number;
  last_purchased_on: string | null;
};

export type Recipe = {
  id: string;
  household_id: string | null;
  title: string;
  description: string | null;
  minutes: number;
  servings: number;
  steps: string[];
  tags: string[];
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  category: string;
  optional: boolean;
};

export type MealEntry = {
  id: string;
  household_id: string;
  plan_date: string;
  slot: string;
  recipe_id: string | null;
  title: string;
  cooked: boolean;
};

export type Household = { id: string; name: string; invite_code: string; created_by: string };

/* ---------------- session ---------------- */

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, ready };
}

/* ---------------- household ---------------- */

export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("household_members")
        .select("household_id, households(id, name, invite_code, created_by)")
        .order("joined_at", { ascending: true });
      if (error) throw error;
      const first = (memberships ?? [])[0] as unknown as
        | { households: Household | null }
        | undefined;
      return (first?.households ?? null) as Household | null;
    },
  });
}

export function useMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ["members", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("household_members")
        .select("user_id, role, joined_at")
        .eq("household_id", householdId!);
      if (error) throw error;
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as Array<Profile & { role: string }>;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, accent")
        .in("id", ids);
      return (rows ?? []).map((r) => {
        const p = (profiles ?? []).find((x) => x.id === r.user_id);
        return {
          id: r.user_id,
          display_name: p?.display_name ?? "Member",
          accent: p?.accent ?? "sage",
          role: r.role,
        };
      });
    },
  });
}

/* ---------------- list ---------------- */

export function useListItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ["list", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_items")
        .select("*")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ListItem[];
    },
  });
}

export function useInventory(householdId: string | undefined) {
  return useQuery({
    queryKey: ["inventory", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("household_id", householdId!)
        .order("expires_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
}

export function useStaples(householdId: string | undefined) {
  return useQuery({
    queryKey: ["staples", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staples")
        .select("*")
        .eq("household_id", householdId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Staple[];
    },
  });
}

export function useRecipes(householdId: string | undefined) {
  return useQuery({
    queryKey: ["recipes", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*, recipe_ingredients(*)")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Array<Recipe & { recipe_ingredients: RecipeIngredient[] }>;
    },
  });
}

export function useMealPlan(householdId: string | undefined, dates: string[]) {
  return useQuery({
    queryKey: ["meals", householdId, dates[0]],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan_entries")
        .select("*")
        .eq("household_id", householdId!)
        .gte("plan_date", dates[0]!)
        .lte("plan_date", dates[dates.length - 1]!)
        .order("plan_date");
      if (error) throw error;
      return (data ?? []) as MealEntry[];
    },
  });
}

/* ---------------- realtime ---------------- */

export function useHouseholdRealtime(householdId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`household-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "list_items" }, () => {
        qc.invalidateQueries({ queryKey: ["list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        qc.invalidateQueries({ queryKey: ["inventory"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);
}

/* ---------------- mutations ---------------- */

export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useMutate<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: string[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}
