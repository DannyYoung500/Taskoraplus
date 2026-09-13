import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use getSession + getUser (Auth API) instead of getClaims (local JWKS),
    // which was throwing unrecognized JWT kid ES256.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) throw redirect({ to: "/" });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw redirect({ to: "/" });
    }
    return { user: { id: data.user.id } };
  },
  component: () => <Outlet />,
});
