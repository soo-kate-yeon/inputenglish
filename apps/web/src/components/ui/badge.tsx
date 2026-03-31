import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-neutral-950 text-white hover:bg-neutral-800",
        secondary:
          "border-transparent bg-neutral-100 text-neutral-950 hover:bg-neutral-200",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-neutral-300 text-neutral-950",
        active:
          "border-transparent bg-neutral-950 text-white hover:bg-neutral-800",
        inactive:
          "border-transparent bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
        selected:
          "border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
