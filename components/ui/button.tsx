import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Sized for older users: 56px minimum targets, large type, and a thick focus ring.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-3 rounded-lg font-display font-extrabold transition-[transform,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 text-center",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_4px_0_hsl(152_71%_15%)] hover:bg-primary/90",
        canary: "bg-accent text-accent-foreground shadow-[0_5px_0_hsl(47_67%_42%)] hover:brightness-105",
        destructive: "bg-destructive text-destructive-foreground shadow-[0_4px_0_hsl(357_80%_26%)] hover:bg-destructive/90",
        outline: "border-[3px] border-input bg-card text-foreground hover:bg-muted",
        "outline-danger": "border-[3px] border-destructive bg-card text-destructive hover:bg-danger-soft",
        secondary: "bg-secondary text-secondary-foreground border-2 border-primary/20 hover:bg-secondary/80",
        ghost: "hover:bg-muted",
        link: "text-primary underline underline-offset-4 hover:no-underline",
        "call-go": "rounded-full bg-[#34c759] text-white shadow-lg hover:brightness-110",
        "call-stop": "rounded-full bg-[#ff3b30] text-white shadow-lg hover:brightness-110",
        "call-muted": "rounded-full bg-white/15 text-white hover:bg-white/25",
      },
      size: {
        default: "min-h-14 px-6 py-3 text-lg [&_svg]:size-6",
        sm: "min-h-11 px-4 py-2 text-base [&_svg]:size-5",
        lg: "min-h-16 px-7 py-3 text-xl [&_svg]:size-7",
        xl: "min-h-[76px] w-full px-8 py-4 text-2xl [&_svg]:size-8",
        icon: "size-14 [&_svg]:size-6",
        round: "size-[76px] rounded-full [&_svg]:size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
