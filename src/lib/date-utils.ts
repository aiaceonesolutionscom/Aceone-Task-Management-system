/**
 * Centralized Date & Time formatting utilities for Aceone Task Management.
 * Enforces strict 12-hour (hh:mm AM/PM) format across all components and pages.
 */

/**
 * Formats any Date, ISO string, timestamp, or HH:mm time string to strict 12-hour AM/PM format:
 * Example outputs: "04:38 PM", "09:15 AM", "12:00 PM"
 */
export function formatTime12(input: Date | string | number | null | undefined): string {
  if (!input) return "";

  // 1. Handle plain time strings like "18:00", "09:30", "18:00:00", "6:00 PM"
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (/^(AM|PM)$/i.test(trimmed)) return trimmed;
    if (/\b(AM|PM)\b/i.test(trimmed)) return trimmed; // Already formatted with AM/PM

    // Check if it's pure HH:mm or HH:mm:ss
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      if (isNaN(hours) || isNaN(minutes)) return trimmed;

      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hStr = hours < 10 ? `0${hours}` : `${hours}`;
      const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hStr}:${mStr} ${ampm}`;
    }
  }

  // 2. Handle Date, ISO string, or timestamp
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return typeof input === "string" ? input : "";

    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hStr}:${mStr} ${ampm}`;
  } catch {
    return "";
  }
}

/**
 * Formats a Date or string to "DD MMM YYYY, hh:mm AM/PM" or "MM/DD/YYYY, hh:mm AM/PM"
 * Example: "06 Oct 2026, 04:38 PM"
 */
export function formatDateTime12(
  input: Date | string | number | null | undefined,
  includeDate = true
): string {
  if (!input) return "";

  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return "";

    const timePart = formatTime12(d);
    if (!includeDate) return timePart;

    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();

    return `${day} ${month} ${year}, ${timePart}`;
  } catch {
    return "";
  }
}

/**
 * Formats a Date or string to "D MMM, hh:mm AM/PM" or "D MMM YYYY, hh:mm AM/PM"
 * Example: "6 Oct, 05:28 PM" or "6 Oct 2026, 05:28 PM"
 */
export function formatShortDateTime12(
  input: Date | string | number | null | undefined,
  includeYear = false
): string {
  if (!input) return "";

  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return "";

    const timePart = formatTime12(d);
    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    const year = d.getFullYear();

    if (includeYear) {
      return `${day} ${month} ${year}, ${timePart}`;
    }
    return `${day} ${month}, ${timePart}`;
  } catch {
    return "";
  }
}

/**
 * Formats task due time string (e.g. "18:00" -> "06:00 PM")
 */
export function formatDueTime(dueTime: string | null | undefined): string {
  if (!dueTime) return "";
  return formatTime12(dueTime);
}

