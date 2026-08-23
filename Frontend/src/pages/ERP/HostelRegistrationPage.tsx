import { useEffect, useState } from "react";
import type { PageBlueprint } from "../../config/erpBlueprints";
import { getErpBatch } from "../../lib/erp/index";
import { SectionCard } from "../../components/erp/ErpPrimitives";
import { Button } from "../../components/button";
import RegistrationErpPage from "./RegistrationErpPage";
import { Users, Search, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  blueprint: PageBlueprint;
}

interface BuddyInfo {
  name: string;
  regNo: string;
  roomNo: string;
  block: string;
  contact: string;
}

const DEFAULT_BUDDIES: BuddyInfo[] = [
  { name: "Aarav Sharma", regNo: "AP23110010123", roomNo: "101", block: "Block A", contact: "9876543210" },
  { name: "Kabir Verma", regNo: "AP23110010199", roomNo: "101", block: "Block A", contact: "8765432109" },
  { name: "Ishaan Sen", regNo: "AP23110010255", roomNo: "102", block: "Block B", contact: "7654321098" },
];

export default function HostelRegistrationPage({ blueprint }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buddy Finder State
  const [savedRoom, setSavedRoom] = useState<string>("");
  const [savedBlock, setSavedBlock] = useState<string>("");
  const [roomInput, setRoomInput] = useState("");
  const [blockInput, setBlockInput] = useState("Block A");
  const [nameInput, setNameInput] = useState("");
  const [contactInput, setContactInput] = useState("");
  const [allBuddies, setAllBuddies] = useState<BuddyInfo[]>([]);

  useEffect(() => {
    // Load saved details from localStorage
    const saved = localStorage.getItem("hostel_buddy_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedRoom(parsed.roomNo || "");
        setSavedBlock(parsed.block || "");
        setNameInput(parsed.name || "");
        setContactInput(parsed.contact || "");
      } catch (e) {
        console.error(e);
      }
    }

    const customBuddies = localStorage.getItem("hostel_buddies_pool");
    if (customBuddies) {
      try {
        setAllBuddies(JSON.parse(customBuddies));
      } catch {
        setAllBuddies(DEFAULT_BUDDIES);
      }
    } else {
      setAllBuddies(DEFAULT_BUDDIES);
      localStorage.setItem("hostel_buddies_pool", JSON.stringify(DEFAULT_BUDDIES));
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        await getErpBatch(blueprint.fetchKeys);
        if (!active) return;
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load hostel info");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [blueprint.fetchKeys]);

  const handleAddDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !nameInput.trim()) return;

    const newDetail: BuddyInfo = {
      name: nameInput.trim(),
      regNo: "AP23110010419",
      roomNo: roomInput.trim(),
      block: blockInput,
      contact: contactInput.trim() || "N/A",
    };

    const updatedPool = [...allBuddies.filter(b => b.regNo !== newDetail.regNo), newDetail];
    setAllBuddies(updatedPool);
    localStorage.setItem("hostel_buddies_pool", JSON.stringify(updatedPool));

    setSavedRoom(newDetail.roomNo);
    setSavedBlock(newDetail.block);
    localStorage.setItem("hostel_buddy_data", JSON.stringify(newDetail));
  };

  const handleRemoveDetails = () => {
    const updatedPool = allBuddies.filter(b => b.regNo !== "AP23110010419");
    setAllBuddies(updatedPool);
    localStorage.setItem("hostel_buddies_pool", JSON.stringify(updatedPool));

    setSavedRoom("");
    setSavedBlock("");
    localStorage.removeItem("hostel_buddy_data");
  };

  const matchingBuddies = allBuddies.filter(
    (b) => b.roomNo === savedRoom && b.block === savedBlock && b.regNo !== "AP23110010419"
  );

  return (
    <RegistrationErpPage
      blueprint={blueprint}
      extraContent={
        <SectionCard title="Hostel Buddy Finder">
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
            {/* Form panel */}
            <div className="rounded-xl border border-[var(--comp-border)] bg-[var(--comp-surface)] p-5 space-y-4">
              <h3 className="text-base font-semibold" style={{ color: "var(--comp-text-primary)" }}>
                {savedRoom ? "My Room Details" : "Join Buddy Finder"}
              </h3>

              {savedRoom ? (
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
                      <p className="font-semibold">{savedRoom}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--comp-text-muted)]">Hostel Block</span>
                      <p className="font-semibold">{savedBlock}</p>
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
                      >
                        <option value="Block A">Block A</option>
                        <option value="Block B">Block B</option>
                        <option value="Block C">Block C</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: "var(--comp-text-secondary)" }}>My Name</label>
                    <input
                      required
                      className="mt-1 w-full rounded-lg border border-[var(--comp-border)] bg-[var(--background)] p-2 text-sm outline-none focus:border-[var(--comp-accent)]"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="John Doe"
                    />
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
                  <Button type="submit" size="sm" className="w-full">
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

              {!savedRoom ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--comp-border)] text-center">
                  <Search className="h-10 w-10 text-[var(--comp-text-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--comp-text-primary)]">Log room details to find roomies</p>
                  <p className="text-xs text-[var(--comp-text-muted)] max-w-xs mt-1">Submit your assigned room number on the left to see other students who match your room and block.</p>
                </div>
              ) : matchingBuddies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--comp-border)] text-center">
                  <AlertCircle className="h-8 w-8 text-[var(--comp-text-muted)] mb-3" />
                  <p className="text-sm font-semibold text-[var(--comp-text-primary)]">No matches yet</p>
                  <p className="text-xs text-[var(--comp-text-muted)] max-w-xs mt-1">Sharing room {savedRoom} in {savedBlock}? Roommates will appear here once they log their details too.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchingBuddies.map((buddy, index) => (
                    <div
                      key={`${buddy.regNo}-${index}`}
                      className="rounded-xl border border-[var(--comp-border)] p-4 flex justify-between items-center bg-[color-mix(in_srgb,var(--comp-accent)_4%,transparent)]"
                    >
                      <div>
                        <p className="font-semibold text-sm text-[var(--comp-text-primary)]">{buddy.name}</p>
                        <p className="text-xs text-[var(--comp-text-muted)] mt-0.5">{buddy.regNo}</p>
                        <p className="text-xs font-semibold text-[var(--comp-accent)] mt-1">Room {buddy.roomNo} &middot; {buddy.block}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold uppercase tracking-wider block text-[var(--comp-text-muted)]">Contact Info</span>
                        <span className="text-sm font-medium mt-1 block">{buddy.contact}</span>
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
