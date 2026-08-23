import { requestData } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";
import type { AcademicCalendar, CalendarTerm } from "./types";
import type { TermWindow } from "./calendarUtils";

export type AcademicCalendarResponse = AcademicCalendar & {
  termWindows: Record<CalendarTerm, TermWindow>;
};

export async function getAcademicCalendar(): Promise<AcademicCalendar> {
  if (isStaticPrototype()) {
    return STATIC_ACADEMIC_CALENDAR_FIXTURE;
  }
  return requestData<AcademicCalendar>("/api/academic-calendar");
}

/** Compact structural fixture for static prototype builds (no backend). */
export const STATIC_ACADEMIC_CALENDAR_FIXTURE: AcademicCalendar = {
  oddSemesterData: [
    { id: 5, details: "Commencement of Classes", date: "03.08.2026", day: "Monday" },
    { id: 10, details: "Midterm Examinations/ Assessments", date: "28.09.2026 - 01.10.2026", day: "Monday - Thursday" },
    { id: 18, details: "Last Day of Teaching", date: "30.11.2026", day: "Monday" },
    { id: 21, details: "Window for End-Term Examinations", date: "07.12.2026 - 21.12.2026", day: "Monday - Monday" },
    { id: 28, details: "Winter Break for Students", date: "22.12.2026 - 03.01.2027", day: "Tuesday - Sunday" },
  ],
  evenSemesterData: [
    { id: 4, details: "Commencement of Classes", date: "04.01.2027", day: "Monday" },
    { id: 8, details: "Mid-Term Examinations/Assessments", date: "01.03.2027 - 04.03.2027", day: "Monday - Thursday" },
    { id: 17, details: "Last Day of Teaching", date: "30.04.2027", day: "Friday" },
    { id: 19, details: "Window for End-Term Examinations", date: "03.05.2027 - 15.05.2027", day: "Monday - Saturday" },
  ],
  summerTermData: [
    { id: 2, details: "Commencement of Classes", date: "02.06.2027", day: "Wednesday" },
    { id: 3, details: "Window for Summer Term Examinations", date: "02.08.2027 - 04.08.2027", day: "Monday - Wednesday" },
  ],
  oddSemesterHolidays: [
    { id: 1, occasion: "Varalakshmi Vratam", date: "21.08.2026", day: "Friday" },
    { id: 2, occasion: "Eid Milad-Un-Nabi", date: "26.08.2026", day: "Tuesday" },
    { id: 5, occasion: "Mahatma Gandhi Jayanthi", date: "02.10.2026", day: "Friday" },
    { id: 8, occasion: "Christmas", date: "25.12.2026", day: "Friday" },
  ],
  evenSemesterHolidays: [
    { id: 2, occasion: "Pongal/Sankranthi", date: "15.01.2027", day: "Friday" },
    { id: 3, occasion: "Republic Day", date: "26.01.2027", day: "Tuesday" },
    { id: 5, occasion: "Holi", date: "22.03.2027", day: "Monday" },
  ],
  importantNotes: [
    "The academic calendar is applicable to All Semesters All Programs of UG, PG & PhD.",
    "Dates are subject to change as per the university's discretion and government notifications.",
  ],
};
