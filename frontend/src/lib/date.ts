export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.trim().replace(
    /^(\d{4}-\d{2}-\d{2})\s*(?=\d{2}:\d{2})/,
    "$1T",
  );
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseApiDate(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "Timestamp unavailable";
}

export function formatChartTime(value: string): string {
  const date = parseApiDate(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "Invalid time";
}
