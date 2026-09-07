interface BunkResult {
  safeToSkip: number;
  caution: number;
  currentAttendance: number;
  status: "safe" | "caution" | "required";
  requiredAttendance: number;
  classesNeededToAttend: number;
}

/** Spare classes below which the buffer is treated as thin rather than safe. */
const CAUTION_BUFFER = 3;

export function calculateBunkCapacity(
  classesConducted: number,
  present: number,
  targetPercentage: number = 75,
  odMlTaken: number = 0,
): BunkResult {
  // Calculate required attendance (minimum percentage of classes conducted)
  const requiredAttendance = Math.ceil(classesConducted * targetPercentage / 100);

  // Current adjusted attendance (includes OD/ML)
  const currentAdjusted = present + odMlTaken;

  // Classes that can be safely skipped while maintaining target
  const safeToSkip = Math.max(0, currentAdjusted - requiredAttendance);

  // Classes needed to reach target (when below target)
  const classesNeededToAttend = Math.max(0, requiredAttendance - currentAdjusted);

  // Classes that need caution (a smaller threshold of safe-to-skip)
  const caution = Math.max(0, safeToSkip - 5);

  // Current attendance percentage including OD/ML adjustments
  const currentAttendance = currentAdjusted > 0 ? (currentAdjusted / classesConducted) * 100 : 0;

  // Status reads the size of the buffer: a bigger buffer is safer. The previous
  // thresholds were inverted — a student who could skip ten classes was shown an
  // amber "Caution" while one clinging to a single spare class was shown green.
  let status: "safe" | "caution" | "required";
  if (safeToSkip <= 0) {
    // Already at or below the target — further absence keeps it there.
    status = "required";
  } else if (safeToSkip < CAUTION_BUFFER) {
    // A thin margin: one or two absences away from dropping below target.
    status = "caution";
  } else {
    status = "safe";
  }

  return {
    safeToSkip,
    caution,
    currentAttendance,
    status,
    requiredAttendance,
    classesNeededToAttend,
  };
}