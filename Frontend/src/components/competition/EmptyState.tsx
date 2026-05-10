import React from "react";
import { EmptyView } from "../ui/AsyncState";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <EmptyView
      title={title}
      description={description}
      icon={icon}
      actionLabel={action?.label}
      onAction={action?.onClick}
      className="border-none bg-transparent px-6 py-10"
    />
  );
}
