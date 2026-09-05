CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION private.shares_household(_user_id UUID, _other_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members a
    JOIN public.household_members b ON a.household_id = b.household_id
    WHERE a.user_id = _user_id AND b.user_id = _other_user
  )
$$;

DROP POLICY "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.shares_household(auth.uid(), id));

DROP POLICY "households readable by members" ON public.households;
CREATE POLICY "households readable by members" ON public.households FOR SELECT TO authenticated
  USING (private.is_household_member(id, auth.uid()));
DROP POLICY "households update by members" ON public.households;
CREATE POLICY "households update by members" ON public.households FOR UPDATE TO authenticated
  USING (private.is_household_member(id, auth.uid())) WITH CHECK (private.is_household_member(id, auth.uid()));

DROP POLICY "members read own rows" ON public.household_members;
CREATE POLICY "members read own rows" ON public.household_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_household_member(household_id, auth.uid()));

DROP POLICY "list items by household" ON public.list_items;
CREATE POLICY "list items by household" ON public.list_items FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY "inventory by household" ON public.inventory_items;
CREATE POLICY "inventory by household" ON public.inventory_items FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY "staples by household" ON public.staples;
CREATE POLICY "staples by household" ON public.staples FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY "meal plan by household" ON public.meal_plan_entries;
CREATE POLICY "meal plan by household" ON public.meal_plan_entries FOR ALL TO authenticated
  USING (private.is_household_member(household_id, auth.uid()))
  WITH CHECK (private.is_household_member(household_id, auth.uid()));

DROP POLICY "recipes read" ON public.recipes;
CREATE POLICY "recipes read" ON public.recipes FOR SELECT TO authenticated
  USING (household_id IS NULL OR private.is_household_member(household_id, auth.uid()));
DROP POLICY "recipes insert" ON public.recipes;
CREATE POLICY "recipes insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (household_id IS NOT NULL AND private.is_household_member(household_id, auth.uid()));
DROP POLICY "recipes update" ON public.recipes;
CREATE POLICY "recipes update" ON public.recipes FOR UPDATE TO authenticated
  USING (household_id IS NOT NULL AND private.is_household_member(household_id, auth.uid()))
  WITH CHECK (household_id IS NOT NULL AND private.is_household_member(household_id, auth.uid()));
DROP POLICY "recipes delete" ON public.recipes;
CREATE POLICY "recipes delete" ON public.recipes FOR DELETE TO authenticated
  USING (household_id IS NOT NULL AND private.is_household_member(household_id, auth.uid()));

DROP POLICY "ingredients read" ON public.recipe_ingredients;
CREATE POLICY "ingredients read" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND (r.household_id IS NULL OR private.is_household_member(r.household_id, auth.uid()))));
DROP POLICY "ingredients write" ON public.recipe_ingredients;
CREATE POLICY "ingredients write" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND r.household_id IS NOT NULL AND private.is_household_member(r.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND r.household_id IS NOT NULL AND private.is_household_member(r.household_id, auth.uid())));

DROP FUNCTION IF EXISTS public.is_household_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.shares_household(UUID, UUID);