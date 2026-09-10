CREATE TABLE public.recipe_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, recipe_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_favourites TO authenticated;
GRANT ALL ON public.recipe_favourites TO service_role;

ALTER TABLE public.recipe_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favourites by household" ON public.recipe_favourites
  FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

CREATE TABLE public.household_pantry_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX household_pantry_flags_unique_name
  ON public.household_pantry_flags (household_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_pantry_flags TO authenticated;
GRANT ALL ON public.household_pantry_flags TO service_role;

ALTER TABLE public.household_pantry_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pantry flags by household" ON public.household_pantry_flags
  FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_favourites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_pantry_flags;