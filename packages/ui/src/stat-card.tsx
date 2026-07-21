import type { ComponentType, SVGProps } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from "./lib/cn";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon?: Icon;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {title}
        </CardTitle>
        {Icon ? <Icon className="size-4 text-[var(--color-muted-foreground)]" /> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {description ? (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
