import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Loading data…" }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Could not load this data</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
