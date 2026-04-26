import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/enhance")({
  beforeLoad: () => {
    throw redirect({ to: "/metrics" });
  },
});
