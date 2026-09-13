import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims?.sub) throw redirect({ to: "/auth" });
    return { user: { id: data.claims.sub } };
  },
  component: () => <Outlet />,
});
