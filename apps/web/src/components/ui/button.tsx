import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-950 text-white shadow-sm hover:bg-neutral-800",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-50",
        secondary:
          "border border-neutral-200 bg-white text-neutral-950 shadow-sm hover:bg-neutral-50",
        ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
        link: "text-neutral-950 underline-offset-4 hover:underline",
        primary:
          "bg-neutral-950 text-white shadow-sm hover:bg-neutral-800 border-transparent",
        "secondary-brand":
          "bg-neutral-100 text-neutral-950 hover:bg-neutral-200 border-transparent",
        social:
          "bg-[#fee500] text-[#3c1e1e] hover:bg-[#fdd835] border-transparent",
        naver: "bg-[#03c75a] text-white hover:bg-[#02b351] border-transparent",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 rounded-full px-4",
        lg: "h-12 rounded-full px-8",
        icon: "h-10 w-10",
        social: "h-[56px] w-full text-[16px] font-medium rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
