import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import {
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CalendarCheckIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CompassIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  SearchIcon,
  SettingsIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import SearchIconPng from "@/assets/Icons/SearchIcon.png";
import { useAdminMode } from "../contexts/AdminModeContext"

import { COMMAND_PALETTE_EXTRA_GROUPS, getCommandPaletteGroupOrder, getRouteCatalog } from "../config/navigationRegistry"
import { logoutSession } from "../lib/core/session"
import { Button } from "./button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command"

type RouteCommand = {
  id: string
  label: string
  route: string
  group: string
  hint: string
  keywords: string
}

const GROUP_ICON_MAP: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboardIcon,
  Academics: GraduationCapIcon,
  "Exams/Results": ClipboardCheckIcon,
  Finance: WalletIcon,
  "Transport & Hostel": BusIcon,
  Registration: ClipboardListIcon,
  Events: CalendarCheckIcon,
  "Competition Platform": CompassIcon,
  Feedback: MessageSquareTextIcon,
  Resources: BookOpenIcon,
  "Learning Management": BookOpenIcon,
  "Academic Tracker": TrendingUpIcon,
  "Career Portal": BriefcaseIcon,
  "Career Services": BriefcaseIcon,
  Helpdesk: LifeBuoyIcon,
  "Quick access": BellIcon,
  "Quick Access": BellIcon,
  Account: LayoutGridIcon,
  "All pages": LayoutGridIcon,
  "All Pages": LayoutGridIcon,
  Session: LayoutGridIcon,
}

function routeHint(route: string) {
  const compact = route.replace(/^\//, "")
  return compact.length > 26 ? `${compact.slice(0, 23)}...` : compact
}

function getShortcutLabel() {
  if (typeof window === "undefined") return "Ctrl+K"
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? "⌘K" : "Ctrl+K"
}

export default function NavigationCommandPalette() {
  const admin = useAdminMode()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  const shortcut = React.useMemo(() => getShortcutLabel(), [])

  const routeCommands = React.useMemo(() => {
    const commandMap = new Map<string, RouteCommand>()

    for (const entry of getRouteCatalog({ isAdmin: admin.isAdmin })) {
      commandMap.set(entry.route, {
        id: `route-${entry.route}`,
        label: entry.label,
        route: entry.route,
        group: entry.group,
        hint: routeHint(entry.route),
        keywords: `${entry.label} ${entry.group} ${entry.route} ${entry.domain} ${entry.keywords ?? ""}`,
      })
    }

    return Array.from(commandMap.values())
  }, [admin.isAdmin])

  const groupOrder = React.useMemo(
    () => [...getCommandPaletteGroupOrder({ isAdmin: admin.isAdmin }), ...COMMAND_PALETTE_EXTRA_GROUPS],
    [admin.isAdmin]
  )

  const groupedCommands = React.useMemo(() => {
    const grouped = new Map<string, RouteCommand[]>()

    for (const command of routeCommands) {
      if (!grouped.has(command.group)) {
        grouped.set(command.group, [])
      }
      grouped.get(command.group)?.push(command)
    }

    return grouped
  }, [routeCommands])

  const closeAndNavigate = React.useCallback(
    (route: string) => {
      setOpen(false)
      if (location.pathname === route) return
      navigate(route)
    },
    [location.pathname, navigate]
  )

  const queryClient = useQueryClient()

  const handleLogout = React.useCallback(() => {
    void logoutSession().finally(() => {
      // Same rationale as Sidebar logout: no cross-user cache bleed.
      queryClient.clear()
      setOpen(false)
      navigate("/login")
    })
  }, [navigate, queryClient])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() !== "k") return
      event.preventDefault()
      setOpen((prev) => !prev)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  React.useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="pointer-events-auto h-9 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-primary)] shadow-[0_8px_22px_rgba(10,38,42,0.18)] transition hover:bg-[var(--comp-surface-hover)]"
      >
        <img src={SearchIconPng} alt="" aria-hidden="true" className="size-4" />
        <span className="hidden text-sm md:inline">Search pages</span>
        <span className="sr-only md:hidden">Search pages</span>
        <span className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-1.5 py-0.5 text-xs leading-none text-[var(--text-secondary)]">
          {shortcut}
        </span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command className="max-h-[72vh]">
          <CommandInput placeholder="Search by page, module, or route..." />
          <CommandList>
            <CommandEmpty>No matching pages found.</CommandEmpty>

            {groupOrder.map((group, groupIndex) => {
              const commands = groupedCommands.get(group)
              if (!commands?.length) return null

              const GroupIcon = GROUP_ICON_MAP[group] || LayoutGridIcon

              return (
                <React.Fragment key={group}>
                  {groupIndex > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading={group}>
                    {commands.map((command) => (
                      <CommandItem
                        key={command.id}
                        value={`${command.label} ${command.group} ${command.route} ${command.keywords}`}
                        onSelect={() => closeAndNavigate(command.route)}
                      >
                        <GroupIcon className="size-4" />
                        <span>{command.label}</span>
                        <CommandShortcut className="max-w-[180px] truncate">
                          {location.pathname === command.route ? "Current" : command.hint}
                        </CommandShortcut>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </React.Fragment>
              )
            })}

            <CommandSeparator />
            <CommandGroup heading="Session">
              <CommandItem value="logout sign out" onSelect={handleLogout}>
                <LogOutIcon className="size-4" />
                <span>Logout</span>
                <CommandShortcut>Exit</CommandShortcut>
              </CommandItem>
              <CommandItem value="settings preferences" onSelect={() => closeAndNavigate("/settings")}>
                <SettingsIcon className="size-4" />
                <span>Settings</span>
                <CommandShortcut>{location.pathname === "/settings" ? "Current" : "Open"}</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
