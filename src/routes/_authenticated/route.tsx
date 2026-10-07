import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { useEnsureProfile } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold, useHouseholdRealtime } from "@/lib/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the locally stored (auto-refreshed) session; getUser would add a network
    // round trip to every navigation. Row-level security is what actually protects the data.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

/** Lives across tab changes, so the realtime channel and profile check run once, not per page. */
function AuthenticatedLayout() {
  useEnsureProfile();
  const { data: household } = useHousehold();
  useHouseholdRealtime(household?.id);
  return <Outlet />;
}
