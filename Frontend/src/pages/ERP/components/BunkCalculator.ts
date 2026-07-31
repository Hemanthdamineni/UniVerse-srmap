interface BunkResult {
  safeToSkip: number;
  caution: number;
  currentAttendance: number;
  status: "safe" | "caution" | "required";
  requiredAttendance: number;
  classesNeededToAttend: number;
}

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

  // Determine status based on how many classes can be skipped - NEW LOGIC
  let status: "safe" | "caution" | "required";
  if (safeToSkip > 0) {
    // If you have any classes you can skip
    if (safeToSkip < 3) {  // Less than 3 classes can be skipped
      status = "safe";   // Your buffer is small and safe
    } else {
      status = "caution";// Your buffer is large, need extra vigilance
    }
  } else {
    // No classes can be skipped
    status = "required";
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