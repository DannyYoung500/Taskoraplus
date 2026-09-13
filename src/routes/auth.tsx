import { createFileRoute } from "@tanstack/react-router";
import { PremiumBootstrap } from "@/components/PremiumBootstrap";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "TASKORA" },
      { name: "description", content: "Opening TASKORA inside Telegram." },
      { name: "theme-color", content: "#0b1220" },
    ],
  }),
  component: () => <PremiumBootstrap redirectTo="/home" />,
});
