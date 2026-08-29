import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch } from "../../lib/erp/index";
import { erpKeys } from "../../lib/erp/queryKeys";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import { Button } from "../../components/button";
import RegistrationErpPage from "./RegistrationErpPage";
import {
  listHostelBuddyBlocks,
  listHostelBuddyMatches,
  removeHostelBuddy,
  submitHostelBuddy,
  getMyHostelBuddy,
  type HostelBuddyBlock,
  type HostelBuddyEntry,
} from "../../lib/campus/campusApi";
import { Search, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

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
        <SectionCard title="Hostel Buddy Finder">
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
            {/* Form panel */}
            <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-5 space-y-4">
              <h3 className="text-base font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {me ? "My Room Details" : "Join Buddy Finder"}
              </h3>

              {error ? (
                <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 border border-[color-mix(in_srgb,var(--danger)_30%,transparent)]">
                  <p className="text-xs font-semibold text-[var(--danger)]">{error}</p>
                </div>
              ) : null}

              {me ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-3 border border-[color-mix(in_srgb,var(--success)_30%,transparent)] flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--success)] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--success)]">Your details are visible to other roommates.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Details
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleAddDetails} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold" style={{ color: "var(--comp-text-secondary)" }}>Room Code</label>
                      <input
                        required
                        className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] p-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        placeholder="e.g. 101"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold" style={{ color: "var(--comp-text-secondary)" }}>Block name</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] p-2 text-sm outline-none focus:border-[var(--comp-accent)]"
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
                    <label className="text-xs font-semibold" style={{ color: "var(--comp-text-secondary)" }}>Contact Info</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] p-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                      value={contactInput}
                      onChange={(e) => setContactInput(e.target.value)}
                      placeholder="Mobile or email"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full" disabled={!blockInput}>
                    <Plus className="h-4 w-4 mr-1" /> Log Room Details
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
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--comp-border)] text-center">
                  <Search className="h-10 w-10 text-[var(--comp-text-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Log room details to find roomies</p>
                  <p className="text-xs text-[var(--comp-text-muted)] max-w-xs mt-1">Submit your assigned room number on the left to see other students who match your room and block.</p>
                </div>
              ) : matchingBuddies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--comp-border)] text-center">
                  <AlertCircle className="h-8 w-8 text-[var(--comp-text-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--comp-text-primary)]">No matches yet</p>
                  <p className="text-xs text-[var(--comp-text-muted)] max-w-xs mt-1">Sharing room {me.roomNo} in {me.blockLabel}? Roommates will appear here once they log their details too.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchingBuddies.map((buddy) => (
                    <div
                      key={buddy.userId}
                      className="rounded-xl border border-[var(--comp-border)] p-4 flex justify-between items-center bg-[color-mix(in_srgb,var(--comp-accent)_4%,transparent)]"
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--comp-text-primary)]">{buddy.name}</p>
                        {buddy.department ? (
                          <p className="text-xs text-[var(--comp-text-muted)] mt-0.5">{buddy.department}</p>
                        ) : null}
                        <p className="text-xs font-semibold text-[var(--comp-accent)] mt-1">Room {buddy.roomNo} &middot; {buddy.blockLabel}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold uppercase tracking-wider block text-[var(--comp-text-muted)]">Contact Info</span>
                        <span className="text-sm font-medium mt-1 block">{buddy.contactInfo || "Not shared"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      }
    />
  );
}
