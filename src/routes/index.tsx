import { createFileRoute } from "@tanstack/react-router";
import { PremiumBootstrap } from "@/components/PremiumBootstrap";

/**
 * Mini App root: open immediately with premium loading (no website landing / no Continue button).
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TASKORA" },
      { name: "description", content: "Verified Tasks. Real Rewards." },
      { name: "theme-color", content: "#0b1220" },
    ],
  }),
  component: () => <PremiumBootstrap redirectTo="/home" />,
});
