import type { LmsResource } from "../../lib/lms/index";
import ResourceCard from "./ResourceCard";
import { useNavigate } from "react-router-dom";
import { EmptyView } from "../ui/Feedback";
import { BookOpen } from "lucide-react";

export default function ResourceGrid({
  items,
  emptyTitle = "No saved resources yet",
  emptyDescription = "Start building your personal library by bookmarking notes, PYQs, guides, and more from across the platform.",
  emptyActionLabel,
  emptyActionTo,
  emptyActionDescription,
}: {
  items: LmsResource[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  emptyActionTo?: string;
  emptyActionDescription?: string;
}) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyView
          title={emptyTitle}
          description={emptyDescription}
          icon={<BookOpen size={48} strokeWidth={1.5} />}
          actionLabel={emptyActionLabel || "Browse Resources"}
          onAction={() => (emptyActionTo ? navigate(emptyActionTo) : navigate("/learn/discover"))}
          className="py-12"
        />
        {emptyActionDescription ? (
          <p className="text-center text-xs text-[var(--comp-text-muted)]">{emptyActionDescription}</p>
        ) : null}
      </div>
    );
  }

  return (
    // A single item in a three-column track leaves two visible holes and reads as
    // a loading failure. One item spans the row instead; two split it.
    <div
      className={
        items.length === 1
          ? "grid grid-cols-1 gap-4"
          : items.length === 2
          ? "grid grid-cols-1 gap-4 lg:grid-cols-2"
          : "grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
      }
    >
      {items.map((item) => (
        <ResourceCard key={item.id} resource={item} />
      ))}
    </div>
  );
}
