import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage } from "../../../components/competition/ErrorMessage";
import { EmptyState } from "../../../components/competition/CompetitionEmptyState";
import { FileUploadZone } from "../../../components/competition/FileUploadZone";
import { SkeletonCard } from "../../../components/ui/Skeletons";
import { useEvent } from "../../../contexts/EventContext";
import { Input } from "../../../components/input";
import { Select } from "../../../components/select";
import {
  getCertificateTemplate,
  saveCertificateTemplate,
  uploadCertificateTemplateImage,
  type CertificateField,
  type CertificateTemplate,
} from "../../../lib/events/competitionsApi";
import { PageStack, runStep } from "./PageStack";

const availableCertificateFields = [
  ["participantName", "Participant Name"],
  ["eventName", "Event Name"],
  ["round", "Round/Category"],
  ["rank", "Rank/Position"],
  ["date", "Date"],
  ["custom", "Custom Text"],
] as const;

export function CertificateTemplatePage() {
  const { event } = useEvent();
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [imagePath, setImagePath] = useState("");
  const [fields, setFields] = useState<CertificateField[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [dragKey, setDragKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!event) return;
    getCertificateTemplate(event.id)
      .then((data) => {
        setTemplate(data);
        setImagePath(data?.templateImagePath ?? "");
        setFields(data?.fields ?? []);
      })
      .catch(() => undefined);
  }, [event]);

  function addField(key: string, label: string) {
    const id = key === "custom" ? `custom-${Date.now()}` : key;
    if (key !== "custom" && fields.some((item) => item.key === key)) return;
    const field: CertificateField = {
      key: id,
      label,
      x: 50,
      y: 50,
      fontSize: 24,
      fontWeight: "bold",
      color: "#0a272b",
      align: "center",
    };
    setFields((prev) => [...prev, field]);
    setSelectedKey(field.key);
  }

  function updateField(key: string, patch: Partial<CertificateField>) {
    setFields((prev) => prev.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  function handleMove(clientX: number, clientY: number) {
    if (!dragKey || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    updateField(dragKey, { x, y });
  }

  async function uploadImage() {
    if (!event || !file) return;
    await runStep(setBusy, setError, async () => {
      const result = await uploadCertificateTemplateImage(event.id, file);
      setImagePath(result.path);
    }, "Failed to upload template image.");
  }

  async function saveTemplate() {
    if (!event || !imagePath) return;
    await runStep(setBusy, setError, async () => {
      const saved = await saveCertificateTemplate(event.id, {
        id: template?.id,
        eventId: event.id,
        templateImagePath: imagePath,
        fields,
      });
      setTemplate(saved);
    }, "Failed to save template.");
  }

  const selected = fields.find((item) => item.key === selectedKey) ?? null;

  return (
    <PageStack>
      <Link to={`/events/${encodeURIComponent(event?.id ?? "")}/manage`} className="comp-btn-ghost w-fit">Back to dashboard</Link>
      <p className="comp-heading-xl m-0">Certificate Template - {event?.title ?? "Event"}</p>
      {error ? <ErrorMessage message={error} preservedInput /> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_320px]">
        <div className="dashboard-card rounded-xl p-4">
          <p className="comp-heading-md mt-0">Upload template</p>
          <FileUploadZone
            onFile={setFile}
            accept={[".png", ".jpg", ".jpeg"]}
            maxSizeMb={10}
            currentFile={file ? { name: file.name, size: file.size, uploadedAt: new Date().toISOString() } : undefined}
          />
          <button className="comp-btn-ghost mt-2" disabled={busy || !file} onClick={() => void uploadImage()}>Upload image</button>
          <div
            ref={canvasRef}
            onMouseMove={(event) => handleMove(event.clientX, event.clientY)}
            onMouseUp={() => setDragKey("")}
            onMouseLeave={() => setDragKey("")}
            style={{ position: "relative", minHeight: 420, marginTop: "var(--space-md)", border: "1px solid var(--comp-border)", borderRadius: 10, overflow: "hidden", background: "var(--comp-surface-hover)" }}
          >
            {imagePath ? <img src={imagePath} alt="Certificate template" style={{ width: "100%", display: "block" }} /> : <EmptyState title="Upload a PNG or JPG template" />}
            {fields.map((field) => (
              <button
                key={field.key}
                type="button"
                onMouseDown={() => { setDragKey(field.key); setSelectedKey(field.key); }}
                style={{
                  position: "absolute",
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  transform: field.align === "center" ? "translateX(-50%)" : field.align === "right" ? "translateX(-100%)" : undefined,
                  border: selectedKey === field.key ? "1px dashed var(--comp-accent)" : "1px dashed transparent",
                  background: "transparent",
                  color: field.color,
                  fontSize: field.fontSize,
                  fontWeight: field.fontWeight,
                  cursor: "move",
                  padding: 2,
                }}
              >
                {field.label}
              </button>
            ))}
          </div>
        </div>
        <aside className="dashboard-card flex flex-col gap-4 rounded-xl p-4">
          <p className="comp-heading-md m-0">Fields</p>
          {availableCertificateFields.map(([key, label]) => (
            <button key={key} className="comp-btn-ghost" onClick={() => addField(key, label)}>+ {label}</button>
          ))}
          {selected ? (
            <div className="grid gap-2">
              <label className="comp-label" htmlFor="field-label">Label</label>
              <Input id="field-label" value={selected.label} onChange={(e) => updateField(selected.key, { label: e.target.value })} />
              <label className="comp-label" htmlFor="field-size">Font size</label>
              <Input id="field-size" type="number" value={selected.fontSize} onChange={(e) => updateField(selected.key, { fontSize: Number(e.target.value) })} />
              <label><input type="checkbox" checked={selected.fontWeight === "bold"} onChange={(e) => updateField(selected.key, { fontWeight: e.target.checked ? "bold" : "normal" })} /> Bold</label>
              <input type="color" value={selected.color} onChange={(e) => updateField(selected.key, { color: e.target.value })} aria-label="Field color" />
              <Select value={selected.align} onChange={(e) => updateField(selected.key, { align: e.target.value as CertificateField["align"] })} aria-label="Field alignment">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
              <button className="comp-btn-ghost" onClick={() => setFields((prev) => prev.filter((item) => item.key !== selected.key))}>Remove field</button>
            </div>
          ) : null}
          <button className="comp-btn-primary" disabled={busy || !imagePath} onClick={() => void saveTemplate()}>
            {busy ? "Saving..." : "Save Template"}
          </button>
        </aside>
      </div>
    </PageStack>
  );
}