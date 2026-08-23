import type { PageBlueprint } from "../../config/erpBlueprints";
import { transformAttendance } from "./attendanceTransformers";
import { transformCourseRegistration, transformCurriculum, transformTimetable } from "./academicTransformers";
import { transformCurrentResults, transformExamMarkDetails, transformInternalMarks } from "./examTransformers";
import { transformProfileData } from "./profileTransformers";
import {
  transformBankDetails,
  transformFaqs,
  transformFeeDues,
  transformFeesPaid,
  transformRefundChange,
  transformRoomDetails,
  transformSapScholarships,
} from "./financeTransformers";
import { transformTransportRoutes } from "./transportTransformers";
import { schemas } from "./schemas";
import type { SchemaDefinition, TransformerFn, TransformerOutput } from "./types";

const registry: Record<string, TransformerFn> = {
  attendance: transformAttendance,
  "internal-marks": transformInternalMarks,
  profile: transformProfileData,
  timetable: transformTimetable,
  "course-registration": transformCourseRegistration,
  curriculum: transformCurriculum,
  "results-current": transformCurrentResults,
  "exam-mark-details": transformExamMarkDetails,
  "finance-dues": transformFeeDues,
  "finance-paid": transformFeesPaid,
  "bank-details": transformBankDetails,
  "room-details": transformRoomDetails,
  "sap-scholarships": transformSapScholarships,
  faqs: transformFaqs,
  "refund-change": transformRefundChange,
  "transport-routes": transformTransportRoutes,
};

// Derive key dynamically, removing hardcoded coupling
export function deriveTransformerKey(source: string | PageBlueprint): string {
  if (typeof source === "string") return source;
  if (source.transform && registry[source.transform]) return source.transform;
  const renderer = source.renderer;
  if (registry[renderer]) return renderer;
  return renderer; // generic/fallback mappings
}

/**
 * Validates untyped blob against a schema map. Allows partial data retention.
 */
function enforceSchema(
  data: unknown,
  schema: SchemaDefinition,
  path = "root"
): { validData: unknown; errors: string[]; warnings: string[] } {
  const result: Record<string, unknown> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (typeof data !== "object" || data === null) {
     return { validData: null, errors: [`${path} expected object but got ${typeof data}`], warnings };
  }

  const dataRecord = data as Record<string, unknown>;

  for (const [key, fieldDef] of Object.entries(schema)) {
     const value = dataRecord[key];
     const fieldPath = `${path}.${key}`;

     if (value === undefined || value === null) {
       if (fieldDef.required) {
         errors.push(`Missing required field: ${fieldPath}`);
       } else {
         warnings.push(`Missing optional field: ${fieldPath}`);
       }
       continue;
     }

     if (fieldDef.type === "array") {
       if (!Array.isArray(value)) {
         errors.push(`Expected array at ${fieldPath}`);
       } else {
         if (fieldDef.itemSchema) {
           const validItems: unknown[] = [];
           for (let i = 0; i < value.length; i++) {
             const { validData: itemData, errors: itemErrors, warnings: itemWarnings } = enforceSchema(value[i], fieldDef.itemSchema, `${fieldPath}[${i}]`);
             if (itemErrors.length > 0) {
               warnings.push(`Dropped invalid item at ${fieldPath}[${i}]: ${itemErrors.join(", ")}`);
               // We purposefully drop invalid row rendering cascades here!
             } else {
               validItems.push(itemData);
             }
             warnings.push(...itemWarnings);
           }
           result[key] = validItems;
         } else {
           result[key] = value;
         }
       }
       continue;
     }

     if (fieldDef.type === "object") {
       if (typeof value !== "object" || Array.isArray(value)) {
         errors.push(`Expected object at ${fieldPath}`);
       } else if (fieldDef.objectSchema) {
         const { validData: objData, errors: objErrors, warnings: objWarnings } = enforceSchema(value, fieldDef.objectSchema, fieldPath);
         errors.push(...objErrors);
         warnings.push(...objWarnings);
         result[key] = objData;
       } else {
         result[key] = value;
       }
       continue;
     }

     const actualType = typeof value;
     if (actualType !== fieldDef.type) {
       errors.push(`Type mismatch at ${fieldPath}: expected ${fieldDef.type}, got ${actualType}`);
       continue;
     }

     if (fieldDef.type === "number" && Number.isNaN(value as number)) {
       errors.push(`NaN detected at ${fieldPath}`);
       continue;
     }

     if (fieldDef.type === "string" && typeof value === "string" && value.includes("[object Object]")) {
       errors.push(`Object leakage detected at ${fieldPath}`);
       continue;
     }

     result[key] = value;
  }

  return { validData: result, errors, warnings };
}

/**
 * Main pipeline execution entry point.
 */
export function executePipeline(source: string | PageBlueprint, rawData: unknown): TransformerOutput {
  const pageType = deriveTransformerKey(source);
  const transformer = registry[pageType];
  
  if (!transformer) {
    return {
      type: pageType || "generic",
      data: null, // Avoid returning un-schema'd data blob to the UI layer
      isValid: false,
      errors: [`No transformer registered for ${pageType}`],
      warnings: ["Generic fallback executed"]
    };
  }

  try {
    const rawResult = transformer(rawData);
    if (!rawResult || typeof rawResult !== "object") {
      return { type: pageType, data: null, isValid: false, errors: ["Transformer returned invalid root object"], warnings: [] };
    }

    const schema = schemas[pageType];
    if (!schema) {
      return { type: pageType, data: rawResult, isValid: true, errors: [], warnings: ["Unchecked schema"] };
    }

    const { validData, errors, warnings } = enforceSchema(rawResult, schema);
    const validRecord =
      validData && typeof validData === "object" ? (validData as Record<string, unknown>) : null;
    
    // Partial Validation Rule: If validData contains any resolved properties, we can attempt to render.
    const hasDataKeys = Boolean(validRecord && Object.keys(validRecord).length > 0);
    
    return {
      type: pageType,
      data: hasDataKeys ? validRecord : null,
      isValid: hasDataKeys,
      errors,
      warnings
    };

  } catch (error: unknown) {
    console.error(`Pipeline transformation failed for ${pageType}:`, error);
    const message = error instanceof Error ? error.message : "Transformer runtime exception";
    return { 
      type: pageType, 
      data: null, 
      isValid: false, 
      errors: [message], 
      warnings: [] 
    };
  }
}
