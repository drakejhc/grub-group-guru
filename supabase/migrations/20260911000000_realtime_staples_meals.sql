-- The app subscribes to staples and meal_plan_entries changes, but only list_items,
-- inventory_items, recipe_favourites and household_pantry_flags were in the realtime
-- publication, so other household members never saw meal or staple updates live.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staples', 'meal_plan_entries'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
