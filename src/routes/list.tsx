import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/list")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/guests", search: { tab: "seating" } as any });
  },
  component: () => null,
});
