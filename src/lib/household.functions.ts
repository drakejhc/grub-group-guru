import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ code: z.string().trim().min(4).max(16) });

/**
 * Joins the caller to a household by invite code. The lookup runs server-side so
 * invite codes are not readable by every signed-in account.
 */
export const joinHouseholdByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();

    const { data: invite } = await supabaseAdmin
      .from("household_invites")
      .select("household_id")
      .eq("code", code)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "not_found" as const };

    const { data: existing } = await supabaseAdmin
      .from("household_members")
      .select("id")
      .eq("household_id", invite.household_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin
        .from("household_members")
        .insert({ household_id: invite.household_id, user_id: context.userId });
      if (error) throw new Error("Couldn't join that household");
    }

    return { ok: true as const, householdId: invite.household_id };
  });
