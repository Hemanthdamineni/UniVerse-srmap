import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react";
import SearchIconPng from "@/assets/Icons/SearchIcon.png";

import { cn } from "../lib/core/utils"
import { Dialog, DialogContent, DialogTitle } from "./dialog"

function CommandDialog({ children, ...props }: DialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command Menu</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    data-slot="command"
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] text-[var(--text-primary)]",
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    data-slot="command-input-wrapper"
    className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2"
  >
    <img
      src={SearchIconPng}
      alt=""
      aria-hidden="true"
      className="size-4 shrink-0 text-[var(--text-secondary)]"
    />
    <CommandPrimitive.Input
      ref={ref}
      data-slot="command-input"
      className={cn(
        "h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    data-slot="command-list"
    className={cn("max-h-[64vh] overflow-y-auto overflow-x-hidden p-2", className)}
    {...props}
  />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    data-slot="command-empty"
    className="py-8 text-center text-sm text-[var(--text-secondary)]"
    {...props}
  />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    data-slot="command-group"
    className={cn(
      "overflow-hidden p-1 text-[var(--text-primary)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-[var(--text-secondary)]",
      className
    )}
    {...props}
  />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    data-slot="command-separator"
    className={cn("mx-2 my-2 h-px bg-[var(--border)]", className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    data-slot="command-item"
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 data-[selected=true]:bg-[var(--comp-accent)] data-[selected=true]:text-white",
      className
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-[11px] tracking-wide text-[var(--text-secondary)]", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
