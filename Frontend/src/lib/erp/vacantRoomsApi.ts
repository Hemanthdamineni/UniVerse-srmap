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

export async function getVacantRooms(day: string, slotIndex: number): Promise<VacantRoomsResult> {
  if (isStaticPrototype()) {
    return {
      ok: true,
      day: day.toLowerCase(),
      slotIndex,
      timeWindow: `${9 + slotIndex}:00–${9 + slotIndex}:50`,
      vacant: ["AB-301", "AB-305", "C205"],
      occupiedCount: 12,
      knownRooms: 15,
    };
  }
  return requestData<VacantRoomsResult>(
    `/api/vacant-rooms?day=${encodeURIComponent(day)}&slot=${slotIndex}`,
  );
}
