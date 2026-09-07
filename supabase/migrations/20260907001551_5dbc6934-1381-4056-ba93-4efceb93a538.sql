CREATE TABLE public.household_invites (
  code TEXT PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.household_invites TO authenticated;
GRANT ALL ON public.household_invites TO service_role;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite code lookup" ON public.household_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "members create invite" ON public.household_invites FOR INSERT TO authenticated
  WITH CHECK (private.is_household_member(household_id, auth.uid()));
CREATE POLICY "members remove invite" ON public.household_invites FOR DELETE TO authenticated
  USING (private.is_household_member(household_id, auth.uid()));

INSERT INTO public.household_invites (code, household_id)
SELECT invite_code, id FROM public.households
ON CONFLICT (code) DO NOTHING;