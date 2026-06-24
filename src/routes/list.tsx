import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/list")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/guests" });
  },
  component: () => null,
});
