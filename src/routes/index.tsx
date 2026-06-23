import { createFileRoute } from "@tanstack/react-router";
import { usePlanStore } from "@/lib/plan-store";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => {
    const tables = usePlanStore((s) => s.tables);
    return <div className="p-8">Tables: {tables.length}</div>;
  },
});
