import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  pending: "bg-status-pending/15 text-status-pending",
  processing: "bg-status-processing/15 text-status-processing",
  completed: "bg-status-completed/15 text-status-completed",
  failed: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
