-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Member',
  accent TEXT NOT NULL DEFAULT 'sage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- HOUSEHOLDS
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.shares_household(_user_id UUID, _other_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members a
    JOIN public.household_members b ON a.household_id = b.household_id
    WHERE a.user_id = _user_id AND b.user_id = _other_user
  )
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_household(auth.uid(), id));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "households readable by members" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id, auth.uid()));
CREATE POLICY "households insert own" ON public.households FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "households update by members" ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id, auth.uid())) WITH CHECK (public.is_household_member(id, auth.uid()));

CREATE POLICY "members read own rows" ON public.household_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_household_member(household_id, auth.uid()));
CREATE POLICY "members join self" ON public.household_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "members leave self" ON public.household_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- LIST ITEMS
CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  note TEXT,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO authenticated;
GRANT ALL ON public.list_items TO service_role;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list items by household" ON public.list_items FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- INVENTORY
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  location TEXT NOT NULL DEFAULT 'pantry',
  category TEXT NOT NULL DEFAULT 'other',
  expires_on DATE,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory by household" ON public.inventory_items FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- STAPLES
CREATE TABLE public.staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  interval_days INT NOT NULL DEFAULT 7,
  last_purchased_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staples TO authenticated;
GRANT ALL ON public.staples TO service_role;
ALTER TABLE public.staples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staples by household" ON public.staples FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- RECIPES
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  minutes INT NOT NULL DEFAULT 30,
  servings INT NOT NULL DEFAULT 4,
  steps TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes read" ON public.recipes FOR SELECT TO authenticated
  USING (household_id IS NULL OR public.is_household_member(household_id, auth.uid()));
CREATE POLICY "recipes insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()));
CREATE POLICY "recipes update" ON public.recipes FOR UPDATE TO authenticated
  USING (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()))
  WITH CHECK (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()));
CREATE POLICY "recipes delete" ON public.recipes FOR DELETE TO authenticated
  USING (household_id IS NOT NULL AND public.is_household_member(household_id, auth.uid()));

CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  optional BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingredients read" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND (r.household_id IS NULL OR public.is_household_member(r.household_id, auth.uid()))));
CREATE POLICY "ingredients write" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND r.household_id IS NOT NULL AND public.is_household_member(r.household_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND r.household_id IS NOT NULL AND public.is_household_member(r.household_id, auth.uid())));

-- MEAL PLAN
CREATE TABLE public.meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  slot TEXT NOT NULL DEFAULT 'dinner',
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cooked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_entries TO authenticated;
GRANT ALL ON public.meal_plan_entries TO service_role;
ALTER TABLE public.meal_plan_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal plan by household" ON public.meal_plan_entries FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;

-- STARTER RECIPES (household_id NULL = available to everyone)
INSERT INTO public.recipes (id, household_id, title, description, minutes, servings, steps, tags) VALUES
('11111111-1111-4111-8111-000000000001', NULL, 'One-Pan Lemon Chicken & Potatoes', 'A hands-off tray bake that fills the kitchen with a good smell.', 45, 4, ARRAY['Heat the oven to 200C.','Toss potatoes and onion with oil, salt and half the lemon.','Nestle in the chicken, roast 35-40 minutes.','Scatter spinach over the hot tray and serve.'], ARRAY['dinner','one-pan']),
('11111111-1111-4111-8111-000000000002', NULL, 'Weeknight Tomato Pasta', 'Fifteen minutes, pantry ingredients, no complaints.', 15, 4, ARRAY['Boil the pasta.','Soften garlic in olive oil, add tinned tomatoes, simmer.','Toss with pasta and plenty of parmesan.'], ARRAY['dinner','quick','vegetarian']),
('11111111-1111-4111-8111-000000000003', NULL, 'Use-It-Up Fried Rice', 'Built for leftover rice and whatever vegetables are fading.', 20, 4, ARRAY['Fry onion and carrot until soft.','Add rice and soy sauce, press flat to crisp.','Push aside, scramble the eggs, fold everything together.'], ARRAY['dinner','leftovers','quick']),
('11111111-1111-4111-8111-000000000004', NULL, 'Creamy Mushroom Toast', 'A ten-minute dinner that feels like more effort than it is.', 10, 2, ARRAY['Fry mushrooms hard until browned.','Add garlic, cream and a squeeze of lemon.','Pile onto toasted bread.'], ARRAY['breakfast','quick','vegetarian']),
('11111111-1111-4111-8111-000000000005', NULL, 'Sheet-Pan Salmon & Greens', 'Bright, fast and forgiving about which greens you have.', 25, 4, ARRAY['Heat the oven to 210C.','Roast broccoli with oil for 10 minutes.','Add salmon and lemon, roast 12 minutes more.'], ARRAY['dinner','healthy']),
('11111111-1111-4111-8111-000000000006', NULL, 'Everyday Lentil Soup', 'Cheap, freezes well, tastes better the next day.', 40, 6, ARRAY['Soften onion, carrot and celery.','Add lentils, tomatoes and stock, simmer 30 minutes.','Season hard and finish with lemon.'], ARRAY['dinner','batch','vegetarian']),
('11111111-1111-4111-8111-000000000007', NULL, 'Crispy Chicken Tacos', 'The one the whole table agrees on.', 30, 4, ARRAY['Sear spiced chicken until crisp at the edges.','Warm the tortillas.','Build with onion, cheese and yoghurt.'], ARRAY['dinner','family']),
('11111111-1111-4111-8111-000000000008', NULL, 'Overnight Oats, Three Ways', 'Breakfast decided before you go to bed.', 5, 2, ARRAY['Stir oats, milk and yoghurt together.','Top with banana or berries.','Chill overnight.'], ARRAY['breakfast','quick']);

INSERT INTO public.recipe_ingredients (recipe_id, name, quantity, category) VALUES
('11111111-1111-4111-8111-000000000001','chicken thighs','8','meat'),
('11111111-1111-4111-8111-000000000001','potatoes','800g','produce'),
('11111111-1111-4111-8111-000000000001','onion','1','produce'),
('11111111-1111-4111-8111-000000000001','lemon','1','produce'),
('11111111-1111-4111-8111-000000000001','spinach','1 handful','produce'),
('11111111-1111-4111-8111-000000000001','olive oil','3 tbsp','pantry'),
('11111111-1111-4111-8111-000000000002','pasta','400g','pantry'),
('11111111-1111-4111-8111-000000000002','tinned tomatoes','2 tins','pantry'),
('11111111-1111-4111-8111-000000000002','garlic','3 cloves','produce'),
('11111111-1111-4111-8111-000000000002','parmesan','60g','dairy'),
('11111111-1111-4111-8111-000000000002','olive oil','2 tbsp','pantry'),
('11111111-1111-4111-8111-000000000003','rice','600g cooked','pantry'),
('11111111-1111-4111-8111-000000000003','eggs','3','dairy'),
('11111111-1111-4111-8111-000000000003','carrot','2','produce'),
('11111111-1111-4111-8111-000000000003','onion','1','produce'),
('11111111-1111-4111-8111-000000000003','soy sauce','3 tbsp','pantry'),
('11111111-1111-4111-8111-000000000004','mushrooms','300g','produce'),
('11111111-1111-4111-8111-000000000004','bread','4 slices','bakery'),
('11111111-1111-4111-8111-000000000004','cream','100ml','dairy'),
('11111111-1111-4111-8111-000000000004','garlic','2 cloves','produce'),
('11111111-1111-4111-8111-000000000005','salmon fillets','4','meat'),
('11111111-1111-4111-8111-000000000005','broccoli','1 head','produce'),
('11111111-1111-4111-8111-000000000005','lemon','1','produce'),
('11111111-1111-4111-8111-000000000005','olive oil','2 tbsp','pantry'),
('11111111-1111-4111-8111-000000000006','red lentils','300g','pantry'),
('11111111-1111-4111-8111-000000000006','carrot','2','produce'),
('11111111-1111-4111-8111-000000000006','celery','2 sticks','produce'),
('11111111-1111-4111-8111-000000000006','onion','1','produce'),
('11111111-1111-4111-8111-000000000006','tinned tomatoes','1 tin','pantry'),
('11111111-1111-4111-8111-000000000006','stock','1.5 l','pantry'),
('11111111-1111-4111-8111-000000000007','chicken breast','500g','meat'),
('11111111-1111-4111-8111-000000000007','tortillas','8','bakery'),
('11111111-1111-4111-8111-000000000007','cheddar','150g','dairy'),
('11111111-1111-4111-8111-000000000007','yoghurt','200g','dairy'),
('11111111-1111-4111-8111-000000000007','onion','1','produce'),
('11111111-1111-4111-8111-000000000008','oats','150g','pantry'),
('11111111-1111-4111-8111-000000000008','milk','300ml','dairy'),
('11111111-1111-4111-8111-000000000008','yoghurt','150g','dairy'),
('11111111-1111-4111-8111-000000000008','banana','2','produce');