import { useEffect, useState } from "react";
import { useSyncStore, reloadPlan } from "@/lib/plan-sync";
import { RefreshCw, WifiOff, AlertTriangle, Check, Loader2, CloudOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function formatTime(t?: number) {
  if (!t) return "—";
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  const lastSavedAt = useSyncStore((s) => s.lastSavedAt);
  const lastLoadedAt = useSyncStore((s) => s.lastLoadedAt);
  const offlineFallback = useSyncStore((s) => s.offlineFallback);
  const offlineSnapshotAt = useSyncStore((s) => s.offlineSnapshotAt);
  const conflict = useSyncStore((s) => s.conflict);
  const resolveConflict = useSyncStore((s) => s.resolveConflict);
  const [reloading, setReloading] = useState(false);

  async function onReload() {
    setReloading(true);
    try {
      await reloadPlan();
      toast.success("Plan refreshed from server");
    } catch {
      toast.error("Could not refresh — server unreachable");
    } finally {
      setReloading(false);
    }
  }

  const chip = (() => {
    switch (status) {
      case "loading":
        return { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Loading…", tone: "text-muted-foreground" };
      case "saving":
        return { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Saving…", tone: "text-muted-foreground" };
      case "saved":
        return { icon: <Check className="h-3 w-3" />, text: `Saved · ${formatTime(lastSavedAt ?? lastLoadedAt)}`, tone: "text-emerald-600" };
      case "offline":
        return { icon: <WifiOff className="h-3 w-3" />, text: "Offline — changes queued", tone: "text-amber-600" };
      case "conflict":
        return { icon: <AlertTriangle className="h-3 w-3" />, text: "Another device updated this plan", tone: "text-amber-700" };
      case "error":
        return { icon: <CloudOff className="h-3 w-3" />, text: "Save failed — retrying", tone: "text-destructive" };
      default:
        return { icon: null, text: "Idle", tone: "text-muted-foreground" };
    }
  })();

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 text-xs font-mono ${chip.tone}`}>
          {chip.icon}
          <span>{chip.text}</span>
        </span>
        <button
          onClick={onReload}
          disabled={reloading}
          className="h-7 px-2 rounded-md border border-input text-xs inline-flex items-center gap-1 hover:bg-accent disabled:opacity-50"
          title="Reload the latest plan from the shared server"
        >
          <RefreshCw className={`h-3 w-3 ${reloading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </div>

      {offlineFallback && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-100 text-xs px-4 py-2 flex items-center justify-center gap-2 border-b border-amber-300 dark:border-amber-800">
          <WifiOff className="h-3.5 w-3.5" />
          Offline — showing last synced plan
          {offlineSnapshotAt ? ` from ${new Date(offlineSnapshotAt).toLocaleString()}` : ""}. Changes won't save until reconnected.
          <button onClick={onReload} className="ml-2 underline font-medium">Retry</button>
        </div>
      )}

      <AlertDialog open={!!conflict} onOpenChange={(v) => { if (!v && conflict) resolveConflict("reload"); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Plan updated by another device</AlertDialogTitle>
            <AlertDialogDescription>
              Someone else saved a newer version of this plan since you loaded it
              {conflict?.remote.lastModified
                ? ` (${new Date(conflict.remote.lastModified).toLocaleString()})`
                : ""}
              . Reload their version to see it, or overwrite it with what's on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConflict("reload")}>Reload latest</AlertDialogCancel>
            <AlertDialogAction onClick={() => resolveConflict("overwrite")} className="bg-destructive hover:bg-destructive/90">
              Overwrite anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Mount hook — bootstraps sync exactly once on the client. */
export function usePlanSyncBootstrap() {
  useEffect(() => {
    void import("@/lib/plan-sync").then((m) => m.bootstrapPlanSync());
  }, []);
}
