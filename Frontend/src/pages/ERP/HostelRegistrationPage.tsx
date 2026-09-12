import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import { SectionCard, StatusBanner } from "../../components/erp/ErpPrimitives";
import { EmptyState } from "../../components/ui/Feedback";
import { Button } from "../../components/button";
import RegistrationErpPage from "./RegistrationErpPage";
import RoomAssignmentSection from "./components/RoomAssignmentSection";
import HostelBlocksSection from "./components/HostelBlocksSection";
import {
  listHostelBuddyBlocks,
  listHostelBuddyMatches,
  removeHostelBuddy,
  submitHostelBuddy,
  getMyHostelBuddy,
  type HostelBuddyBlock,
  type HostelBuddyEntry,
} from "../../lib/campus/campusApi";
import { Search, Plus, Trash2, UserSearch } from "lucide-react";

const BUDDY_INPUT_CLASS =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--comp-border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--comp-accent)]";

interface Props {
  blueprint: PageBlueprint;
}

const BUDDY_QUERY_KEYS = {
  blocks: ["hostel-buddy", "blocks"] as const,
  me: ["hostel-buddy", "me"] as const,
  matches: ["hostel-buddy", "matches"] as const,
};

export default function HostelRegistrationPage({ blueprint }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [roomInput, setRoomInput] = useState("");
  const [blockInput, setBlockInput] = useState("");
  const [contactInput, setContactInput] = useState("");

  const queryClient = useQueryClient();

  const blocksQuery = useQuery<HostelBuddyBlock[]>({
    queryKey: BUDDY_QUERY_KEYS.blocks,
    queryFn: listHostelBuddyBlocks,
    staleTime: 5 * 60_000,
  });

  const meQuery = useQuery<HostelBuddyEntry | null>({
    queryKey: BUDDY_QUERY_KEYS.me,
    queryFn: getMyHostelBuddy,
    staleTime: 60_000,
  });

  const matchesQuery = useQuery<{ items: HostelBuddyEntry[]; governance?: unknown }>({
    queryKey: BUDDY_QUERY_KEYS.matches,
    queryFn: listHostelBuddyMatches,
    enabled: Boolean(meQuery.data),
    staleTime: 60_000,
  });

  // Initialise the block select once the blocks load.
  useEffect(() => {
    if (!blockInput && blocksQuery.data && blocksQuery.data.length > 0) {
      setBlockInput(blocksQuery.data[0].id);
    }
  }, [blocksQuery.data, blockInput]);

  // The ERP batch call gates loading/error only; buddy data is API-first.
  const batchQuery = useQuery({
    queryKey: erpKeys.batch(blueprint.fetchKeys),
    queryFn: () => getErpBatch(blueprint.fetchKeys),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!batchQuery.error) return;
    setError(batchQuery.error instanceof Error ? batchQuery.error.message : "Failed to load hostel info");
  }, [batchQuery.error]);

  const loading = batchQuery.isPending || blocksQuery.isPending;

  const me = meQuery.data ?? null;
  const savedRoom = me?.roomNo || "";
  const savedBlock = me?.blockLabel || "";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: BUDDY_QUERY_KEYS.me });
    queryClient.invalidateQueries({ queryKey: BUDDY_QUERY_KEYS.matches });
  };

  const handleAddDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !blockInput) return;
    setError(null);
    try {
      await submitHostelBuddy({
        roomNo: roomInput.trim(),
        blockId: blockInput,
        contactInfo: contactInput.trim(),
      });
      setRoomInput("");
      setContactInput("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details");
    }
  };

  const handleRemoveDetails = async () => {
    setError(null);
    try {
      await removeHostelBuddy();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove details");
    }
  };

  const matchingBuddies = useMemo(() => {
    return matchesQuery.data?.items ?? [];
  }, [matchesQuery.data]);

  return (
    <RegistrationErpPage
      blueprint={blueprint}
      extraContent={
        <>
          <RoomAssignmentSection />
          <HostelBlocksSection />
          <SectionCard title="Hostel Buddy Finder">
            <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
              {/* Form panel */}
              <div className="space-y-4 rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-5">
                <h3 className="text-base font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  {me ? "My Room Details" : "Join Buddy Finder"}
                </h3>

                {error ? <StatusBanner message={{ id: "buddy-error", tone: "error", text: error }} /> : null}

                {me ? (
                  <div className="space-y-4">
                    <StatusBanner
                      message={{ id: "buddy-visible", tone: "success", text: "Your details are visible to other roommates." }}
                    />
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-xs text-[var(--comp-text-muted)]">Room No.</span>
                        <p className="font-semibold">{me.roomNo}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--comp-text-muted)]">Hostel Block</span>
                        <p className="font-semibold">{me.blockLabel}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleRemoveDetails}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove Details
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAddDetails} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>Room Code</label>
                        <input
                          required
                          className={BUDDY_INPUT_CLASS}
                          value={roomInput}
                          onChange={(e) => setRoomInput(e.target.value)}
                          placeholder="e.g. 101"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>Block name</label>
                        <select
                          className={BUDDY_INPUT_CLASS}
                          value={blockInput}
                          onChange={(e) => setBlockInput(e.target.value)}
                          disabled={blocksQuery.isLoading}
                        >
                          {(blocksQuery.data || []).map((block) => (
                            <option key={block.id} value={block.id}>{block.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium" style={{ color: "var(--comp-text-secondary)" }}>Contact Info</label>
                      <input
                        className={BUDDY_INPUT_CLASS}
                        value={contactInput}
                        onChange={(e) => setContactInput(e.target.value)}
                        placeholder="Mobile or email"
                      />
                    </div>
                    <Button type="submit" size="sm" className="w-full" disabled={!blockInput}>
                      <Plus className="mr-1 h-4 w-4" /> Log Room Details
                    </Button>
                  </form>
                )}
              </div>

              {/* Matched roommates list */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                  Room Matches
                </h3>

                {!me ? (
                  <EmptyState
                    title="Log room details to find roomies"
                    description="Submit your assigned room number on the left to see other students who match your room and block."
                    icon={<Search size={48} strokeWidth={1.5} />}
                  />
                ) : matchingBuddies.length === 0 ? (
                  <EmptyState
                    title="No matches yet"
                    description={`Sharing room ${me.roomNo} in ${me.blockLabel}? Roommates will appear here once they log their details too.`}
                    icon={<UserSearch size={48} strokeWidth={1.5} />}
                  />
                ) : (
                  <div className="space-y-3">
                    {matchingBuddies.map((buddy) => (
                      <div
                        key={buddy.userId}
                        className="flex items-center justify-between rounded-xl border border-[var(--comp-border)] p-4"
                        style={{ background: "color-mix(in srgb, var(--comp-accent) 4%, transparent)" }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--comp-text-primary)]">{buddy.name}</p>
                          {buddy.department ? (
                            <p className="mt-0.5 text-xs text-[var(--comp-text-muted)]">{buddy.department}</p>
                          ) : null}
                          <p className="mt-1 text-xs font-semibold text-[var(--comp-accent)]">Room {buddy.roomNo} &middot; {buddy.blockLabel}</p>
                        </div>
                        <div className="text-right">
                          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--comp-text-muted)]">Contact Info</span>
                          <span className="mt-1 block text-sm font-medium">{buddy.contactInfo || "Not shared"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </>
      }
    />
  );
}
