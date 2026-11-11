import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  note?: string;
  icon: LucideIcon;
  tone?: "blue" | "amber" | "red" | "green";
}) {
  const iconTone = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    green: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/80">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
            {typeof value === "number" ? value.toLocaleString("en-GB") : value}
          </p>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
