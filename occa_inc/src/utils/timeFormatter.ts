/**
 * Formats an ISO timestamp for the messaging UI: relative for anything recent
 * (just now / Xm / Xh), a weekday for the last week, and a short date beyond that.
 * Used by MessagesPage (chat list) and ConversationPage (message bubbles).
 */
export function formatChatTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Short clock time ("2:45 PM") for the timestamp shown under a single message bubble. */
export function formatMessageClockTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Groups consecutive messages by calendar day for date-divider rendering in the thread. */
export function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const today = new Date();
  const isSameDay = date.toDateString() === today.toDateString();
  if (isSameDay) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}
