# 06 — Data Pipeline & Transformers

## 6.1 Overview

The data pipeline is the frontend's defense layer between raw ERP responses and rendered UI. It ensures:
1. **No `[object Object]` leakage** — All values normalized to primitives
2. **Typed domain models** — Each page type has a strongly-typed output interface
3. **Schema validation** — Output is validated against explicit field definitions
4. **Graceful degradation** — Invalid rows are dropped, valid partial data is rendered

```
Raw ERP Batch Response
  │
  ▼
normalizeRawValue()           ← Global: converts any value to safe string
  │
  ▼
Page-specific Transformer     ← Maps raw data to typed domain model
  │
  ▼
enforceSchema()               ← Validates against explicit schema definition
  │
  ▼
TransformerOutput { type, data, isValid, errors, warnings }
  │
  ▼
Renderer receives clean, validated model
```

---

## 6.2 Global Normalizer

```typescript
function normalizeRawValue(value: unknown, fallback = ""): string
```

| Input | Output | Reason |
|-------|--------|--------|
| `null`, `undefined` | `fallback` | Null safety |
| `"Hello World"` | `"Hello World"` | Pass-through |
| `42` | `"42"` | Number → string |
| `true` | `"true"` | Boolean → string |
| `{ a: 1 }` | `fallback` | **Object blocked** — prevents `[object Object]` |
| `[1, 2, 3]` | `fallback` | **Array blocked** |
| String with `$(document).ready(...)` | Cleaned | JS artifact removal |
| String with `<script>...</script>` | Cleaned | Script tag removal |

---

## 6.3 Transformer Registry

| Key | Transformer | Output Type | Used By |
|-----|------------|-------------|---------|
| `attendance` | `transformAttendance` | `AttendanceModel` | AttendanceDetailsPage |
| `timetable` | `transformTimetable` | `TimetableModel` | TimetablePage |
| `curriculum` | `transformCurriculum` | `CurriculumModel` | CurriculumPage |
| `profile` | `transformProfileData` | `StudentProfile` | ProfilePage, Dashboard |
| `internal-marks` | `transformInternalMarks` | `InternalMarksModel` | Dashboard (marks card) |

Pages without a registered transformer fall through to the generic pipeline (data passed as-is without transformation).

---

## 6.4 Attendance Transformer

### Input Path
```
rawData.Academic["Attendance Details"].tables[0]  → target table (≥3 rows)
```

### Row Classification
Each row is classified by **structural shape**, not string content:
```typescript
function classifyAttendanceRow(row): "record" | "note" | "skip"
```
- **record**: `Subject Code` matches `/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/i` (e.g., `CSE 304`)
- **note**: Has `Subject Code` but doesn't match course pattern
- **skip**: Empty or dash-only `Subject Code`

### Output Type
```typescript
interface AttendanceRecord {
  subjectCode: string;
  subjectDescription: string;
  classesConducted: number;
  attendanceEntered: number;
  odMlTaken: number;
  present: number;
  odMlApprovedPct: number;
  attendancePct: number;
}

interface AttendanceModel {
  records: AttendanceRecord[];
  notes: string[];
}
```

### Column Mapping
| ERP Header | Model Field | Fallback Keys |
|------------|-------------|---------------|
| `Subject Code` | `subjectCode` | — |
| `Subject Description` | `subjectDescription` | — |
| `ClassesConducted` | `classesConducted` | `col3` |
| `Attendance\nEntered\n(Slots)` | `attendanceEntered` | `col4` |
| `OD/ML\nTaken` | `odMlTaken` | `col5` |
| `Present % P /\n(P+A+OD)` | `present` | `col6` |
| `OD ML %\nApproved` | `odMlApprovedPct` | `col7` |
| `Attendance\n%` | `attendancePct` | `col9` |

---

## 6.5 Timetable Transformer

### Input Path
```
rawData.Academic["Time Table"].tables[0]  → schedule grid (5+ rows)
rawData.Academic["Time Table"].tables[1]  → subject legend
```

### Output Type
```typescript
interface TimetableSlot { time: string; classDetails: string; }
interface TimetableDay  { day: string; slots: TimetableSlot[]; }
interface TimetableSubject { code: string; name: string; ltpc: string; faculty: string; }
interface TimetableModel {
  timeSlots: string[];    // ["09:00 To 09:50", "10:00 To 10:50", ...]
  days: TimetableDay[];   // Monday through Friday/Saturday
  subjects: TimetableSubject[];
}
```

### Schedule Grid Parsing
- Row 1 = time slot headers (keys: `"1"`, `"2"`, etc.)
- Rows 2+ = day rows (col1 = day name, numeric keys = class content)
- Empty cells (`-`) are rendered as blank slots

### Subject Legend Parsing
The ERP export has column headers shifted by one position:
```
"Subjects Description" → actually contains subject code
"L-T-P-C"              → actually contains subject name
"Faculty Name"         → actually contains L-T-P-C
"Class Room Name"      → actually contains faculty name
```

---

## 6.6 Curriculum Transformer

### Input Path
```
rawData.Academic["Student Wise Subjects"].tables[0]
```

### Output Type
```typescript
interface CurriculumSubject {
  semester: string;
  code: string;
  description: string;
  credit: string;
  group: string;
}
interface CurriculumModel { subjects: CurriculumSubject[]; }
```

---

## 6.7 Profile Transformer

### Input
Direct `profileData` (usually `TableContent` from session or ERP profile page).

### Compound Field Parsing
ERP profile stores multiple values in single fields separated by `/`:
```
"D.O.B. / Gender"                    → dob + gender
"Program / Section"                  → program + section  
"Student Contact Number / Email"     → contactNumber + email
"Father Name / Mother Name"          → fatherName + motherName
```

### Output Type
```typescript
interface StudentProfile {
  studentName: string;
  registerNo: string;
  dob: string;
  gender: string;
  academicYear: string;
  program: string;
  specialization: string;
  section: string;
  currentSemester: string;
  fatherName: string;
  motherName: string;
  contactNumber: string;  // "(Verified)" suffix stripped
  email: string;
}
```

---

## 6.8 Internal Marks Transformer

### Input Path (multiple fallback locations)
```
rawData.Examination["Internal Mark Details"].tables[0]
rawData.Academic["Internal Mark Details"].tables[0]
rawData.Academic[any key matching /internal|mark/i].tables[0]
```

### Row Filtering
Skips rows where:
- Subject Code is empty or matches header text (`"Subject Code"`, `"Name"`)
- Description matches aggregate labels (`"Mark Secured(Conducted)"`, `"CLA"`, `"Mid Semester"`)

### Output Type
```typescript
interface InternalMarkSubject {
  code: string;
  description: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: "excellent" | "good" | "needs-improvement";
  detailTableIndex: number;
}
interface InternalMarksModel {
  subjects: InternalMarkSubject[];
  averagePercentage: number;    // Average across subjects with maxMarks > 0
}
```

### Status Classification
| Percentage | Status |
|------------|--------|
| ≥ 80% | `excellent` |
| ≥ 60% | `good` |
| < 60% | `needs-improvement` |

---

## 6.9 Schema Validation Engine

### Schema Definition
```typescript
type FieldType = "string" | "number" | "boolean" | "array" | "object";
interface SchemaField {
  type: FieldType;
  required: boolean;
  itemSchema?: SchemaDefinition;     // For array items
  objectSchema?: SchemaDefinition;   // For nested objects
}
type SchemaDefinition = Record<string, SchemaField>;
```

### Validation Rules
| Check | Behavior |
|-------|----------|
| Missing required field | Error added, field omitted from output |
| Missing optional field | Warning added |
| Wrong type | Error added, field omitted |
| Array with invalid items | Invalid items **dropped**, valid items kept (graceful degradation) |
| `NaN` number | Error, field omitted |
| String containing `[object Object]` | Error, field omitted (explicit object leakage detection) |
| Nested object | Recursively validated |

### Partial Validation Rule
If `enforceSchema()` returns at least one resolved property, the data is considered renderable — even if some fields failed validation. This allows partial data rendering.

---

## 6.10 Pipeline Execution

### `executePipeline(source, rawData): TransformerOutput`

```typescript
interface TransformerOutput<T = any> {
  type: string;              // Transformer key (e.g., "attendance")
  data: Partial<T> | null;   // Validated model data
  isValid: boolean;           // true if any data survived validation
  errors: string[];           // Validation/runtime errors
  warnings: string[];         // Non-fatal issues
}
```

### Execution Flow
```
1. deriveTransformerKey(source)
   └─ If PageBlueprint: use blueprint.renderer
   └─ If string: use directly

2. Lookup transformer in registry[key]
   └─ Not found → return { data: null, isValid: false, errors: ["No transformer registered"] }

3. Execute transformer(rawData)
   └─ Exception → return { data: null, isValid: false, errors: [error.message] }
   └─ Invalid return → return { data: null, isValid: false, errors: ["Invalid root object"] }

4. Lookup schema in schemas[key]
   └─ No schema → return raw result (unchecked) with warning

5. enforceSchema(result, schema)
   └─ Validate all fields recursively
   └─ Drop invalid array items
   └─ Return { validData, errors, warnings }

6. Return TransformerOutput
   └─ data = validData (if any keys present) or null
   └─ isValid = Object.keys(validData).length > 0
```

---

## 6.11 Blueprint ↔ Transformer ↔ Route Mapping

```
PAGE_BLUEPRINTS["/academic/attendance-details"]
  │
  ├── route: "/academic/attendance-details"
  ├── fetchKeys: ["academic/attendance-details", "academic/od-ml-details", ...]
  ├── renderer: "attendance"
  │       │
  │       └── deriveTransformerKey() → "attendance"
  │               │
  │               └── registry["attendance"] → transformAttendance()
  │                       │
  │                       └── schemas["attendance"] → attendanceSchema
  │
  └── Component: <AttendanceDetailsPage>
```

This means to add a new page type you need to:
1. Add a blueprint in `erpBlueprints.ts`
2. Add scrape targets in `scrapeTargets.js`
3. Add a transformer in `erpTransformers.ts`
4. Add a schema in `erpTransformers.ts`
5. Add a React component (or use `BlueprintPage` for generic rendering)
