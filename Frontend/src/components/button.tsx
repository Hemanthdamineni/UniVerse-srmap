import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "../lib/utils"

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

const variantClasses = {
  default: "bg-[var(--comp-accent)] text-white shadow-xs hover:bg-[var(--comp-accent-hover)]",
  destructive:
    "bg-[var(--error)] text-white shadow-xs hover:bg-[color-mix(in_srgb,var(--error)_84%,black_16%)] focus-visible:ring-[color-mix(in_srgb,var(--error)_25%,transparent)]",
  outline:
    "border border-[var(--comp-border)] bg-[var(--comp-surface)] text-[var(--comp-text-primary)] shadow-xs hover:bg-[var(--comp-surface-hover)]",
  secondary: "bg-[var(--comp-surface-hover)] text-[var(--comp-text-primary)] shadow-xs hover:bg-[color-mix(in_srgb,var(--comp-surface-hover)_70%,var(--comp-accent)_8%)]",
  ghost: "text-[var(--comp-text-secondary)] hover:bg-[var(--comp-surface-hover)] hover:text-[var(--comp-text-primary)]",
  link: "text-[var(--comp-accent)] underline-offset-4 hover:underline",
} as const

const sizeClasses = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
  lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
  icon: "size-9",
} as const

type ButtonVariant = keyof typeof variantClasses
type ButtonSize = keyof typeof sizeClasses

function buttonVariants({
  variant,
  size,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(
    base,
    variantClasses[variant ?? "default"],
    sizeClasses[size ?? "default"],
    className
  )
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  {
    variant?: ButtonVariant
    size?: ButtonSize
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
