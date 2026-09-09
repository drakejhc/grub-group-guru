DROP POLICY IF EXISTS "invite code lookup" ON public.household_invites;

CREATE POLICY "members read invite" ON public.household_invites
  FOR SELECT TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));