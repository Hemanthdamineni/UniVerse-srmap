import { requestData, requestMultipart } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";

export { requestData, requestMultipart, isStaticPrototype };

function appendValue(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
}

export function buildMultipartForm(values: Record<string, unknown>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    appendValue(formData, key, value);
  }
  return formData;
}
