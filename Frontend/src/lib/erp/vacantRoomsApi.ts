import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";

export interface VacantRoomsResult {
  ok: true;
  day: string;
  slotIndex: number;
  timeWindow: string;
  vacant: string[];
  occupiedCount: number;
  knownRooms: number;
}

export interface VacantSlotsMeta {
  slots: string[];
}

export const VACANT_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

// Mirrors the backend `SLOT_TIMES` in Backend/src/services/erp/vacantRoomStore.js.
// Keep these two lists in lockstep — the API returns one of these strings verbatim
// as `timeWindow`, and the Vacant Rooms page dropdown uses the same labels.
export const VACANT_SLOT_LABELS: readonly string[] = [
  "9:00 am – 9:50 am",
  "10:00 am – 10:50 am",
  "11:00 am – 11:50 am",
  "12:00 pm – 12:50 pm",
  "1:00 pm – 1:50 pm",
  "2:00 pm – 2:50 pm",
  "3:00 pm – 3:50 pm",
  "4:00 pm – 5:30 pm",
];

export const VACANT_SLOT_COUNT = VACANT_SLOT_LABELS.length;

export async function getVacantRooms(day: string, slotIndex: number): Promise<VacantRoomsResult> {
  if (isStaticPrototype()) {
    return {
      ok: true,
      day: day.toLowerCase(),
      slotIndex,
      timeWindow: VACANT_SLOT_LABELS[slotIndex] ?? "",
      vacant: ["AB-301", "AB-305", "C205"],
      occupiedCount: 12,
      knownRooms: 15,
    };
  }
  return requestData<VacantRoomsResult>(
    `/api/vacant-rooms?day=${encodeURIComponent(day)}&slot=${slotIndex}`,
  );
}
