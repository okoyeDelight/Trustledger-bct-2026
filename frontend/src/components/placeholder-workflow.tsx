import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderWorkflow({
  icon: Icon,
  title,
  description,
  missing,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  missing: string;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 rounded-lg bg-muted px-4 py-3 text-left text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Not enabled:</span>{" "}
          {missing}
        </div>
      </CardContent>
    </Card>
  );
}
