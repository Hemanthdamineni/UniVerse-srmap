import { storeSessionAuth, getSessionId } from "../session";
import { isStaticPrototype } from "./staticPrototypeEnv";
import { STATIC_PROTOTYPE_PROFILE } from "./staticPrototypeProfileData";

/**
 * Call once before rendering so `getSessionId()` and dashboard session checks work.
 */
export function bootstrapStaticPrototypeSession() {
  if (!isStaticPrototype() || typeof window === "undefined") return;
  if (getSessionId()) return;

  storeSessionAuth({
    sessionId: "static-prototype-session",
    profileData: { ...STATIC_PROTOTYPE_PROFILE },
  });
}
