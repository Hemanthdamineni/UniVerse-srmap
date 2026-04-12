export default function ValidityChip({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
      {value}
    </span>
  );
}
