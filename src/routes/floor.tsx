import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FloorPlanCanvas } from "@/components/FloorPlanCanvas";

export const Route = createFileRoute("/floor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Floor plan · Seatcraft" },
      { name: "description", content: "Spatial floor plan for the event — drag tables into position, add stage/bar/entrance markers, and overlay a venue diagram." },
    ],
  }),
  component: FloorPage,
});

function FloorPage() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="w-full px-4 py-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl">Floor plan</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Arrange tables spatially to match the actual room. Uploads and positions sync live across devices.
            </p>
          </div>
        </div>
        <FloorPlanCanvas onOpenTable={() => navigate({ to: "/" })} />
      </div>
    </AppShell>
  );
}
