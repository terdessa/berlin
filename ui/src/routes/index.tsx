import { createFileRoute } from "@tanstack/react-router";
import { SentinelDashboard } from "@/components/sentinel/SentinelDashboard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sentinel — Retail Security Ops Console" },
      {
        name: "description",
        content:
          "Sentinel is a calm, human-in-the-loop retail security console: local Gemini camera analysis, flagged-moment review, and earpiece audio enhancement.",
      },
    ],
  }),
});

function Index() {
  return <SentinelDashboard />;
}
