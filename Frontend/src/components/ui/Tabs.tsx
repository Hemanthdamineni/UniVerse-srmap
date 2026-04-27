import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  className?: string;
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ className, tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className={cn("flex items-center w-full overflow-x-auto border-b border-[var(--comp-border)] no-scrollbar gap-6", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-11 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors md:min-h-9",
            activeTab === tab.id
              ? "border-[var(--comp-accent)] text-[var(--comp-accent)]"
              : "border-transparent text-[var(--comp-text-secondary)] hover:border-[var(--comp-text-muted)] hover:text-[var(--comp-text-primary)]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
