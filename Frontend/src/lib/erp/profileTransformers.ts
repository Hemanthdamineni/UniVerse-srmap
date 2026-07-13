import type { StudentProfile } from "./types";

const splitField = (field: string, separator: string = " / ") => {
  return field ? field.split(separator).map(item => item.trim()) : ["", ""];
};

const readField = (tableContent: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = tableContent[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

export function transformProfileData(rawData: unknown): StudentProfile {
  const tableContent = (rawData as Record<string, unknown>) || {};
  const dobGender = readField(tableContent, "D.O.B. / Gender", "DOB / Gender");
  const programSection = readField(tableContent, "Program / Section", "Programme / Section");
  const contactEmail = readField(
    tableContent,
    "Student Contact Number / Email",
    "Student Contact No / Email",
    "Contact Number / Email"
  );
  const parentNames = readField(
    tableContent,
    "Father Name / Mother Name",
    "Father / Mother Name"
  );

  const [compoundDob, compoundGender] = splitField(dobGender);
  const [compoundProgram, compoundSection] = splitField(programSection);
  const [compoundContact, compoundEmail] = splitField(contactEmail);
  const [compoundFatherName, compoundMotherName] = splitField(parentNames);

  return {
    studentName: readField(tableContent, "Student Name", "Name", "Register No.", "Register No") || "N/A",
    registerNo: readField(tableContent, "Register No.", "Register No", "Register Number", "Registration Number") || "N/A",
    dob: compoundDob || readField(tableContent, "D.O.B.", "DOB", "Date of Birth") || "N/A",
    gender: compoundGender || readField(tableContent, "Gender") || "N/A",
    academicYear: readField(tableContent, "Academic Year", "A.Y.") || "2025-2026",
    program: compoundProgram || readField(tableContent, "Program", "Programme") || "N/A",
    specialization: readField(tableContent, "Specialization", "Branch") || "N/A",
    section: compoundSection || readField(tableContent, "Section") || "N/A",
    currentSemester: readField(tableContent, "Semester", "Current Semester") || "N/A",
    fatherName: compoundFatherName || readField(tableContent, "Father Name") || "N/A",
    motherName: compoundMotherName || readField(tableContent, "Mother Name") || "N/A",
    contactNumber: (compoundContact || readField(tableContent, "Student Contact Number", "Contact Number", "Mobile Number")).replace(/\s*\((Verified|Unverified)\s*\)\s*/i, '').trim() || "N/A",
    email: compoundEmail || readField(tableContent, "Email", "Student Email") || "N/A",
  };
}
