// Versioned so a future format change can bump the suffix without colliding
// with the old opaque IDs already in visitors' localStorage.
const VISITOR_KEY = "cc_activity_visitor_id_v1";
const SERVER_SESSION_KEY = "cc_activity_server_session_id_v1";

export type ClientActivityEvent = {
  event_name: string;
  event_category?: string;
  path?: string;
  referrer?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  client_occurred_at?: string;
};

let queue: ClientActivityEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function safeRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getActivityVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = safeRandomId();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return safeRandomId();
  }
}

export function getActivityServerSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SERVER_SESSION_KEY);
  } catch {
    return null;
  }
}

function setActivityServerSessionId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SERVER_SESSION_KEY, id);
  } catch {
    /* ignore */
  }
}

export function enqueueActivityEvent(event: ClientActivityEvent) {
  if (typeof window === "undefined") return;
  event.client_occurred_at = event.client_occurred_at ?? new Date().toISOString();
  event.path = event.path ?? window.location.pathname;
  event.referrer = event.referrer ?? (document.referrer || undefined);
  queue.push(event);
  scheduleFlush();
}

export function logClientActivity(
  event_name: string,
  event_category = "general",
  metadata?: Record<string, unknown>
) {
  enqueueActivityEvent({ event_name, event_category, metadata });
}

const MAX_SELECTION_STRING = 256;
const MAX_SELECTION_ARRAY_LEN = 50;

/** Sanitized metadata for `user_selection` events (stored in DB). */
export function logUserSelection(meta: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v == null) {
      safe[k] = v;
    } else if (typeof v === "boolean" || typeof v === "number") {
      safe[k] = v;
    } else if (typeof v === "string") {
      safe[k] = v.length > MAX_SELECTION_STRING ? v.slice(0, MAX_SELECTION_STRING) : v;
    } else if (Array.isArray(v)) {
      safe[k] = v
        .map((item) =>
          typeof item === "string" ? item.slice(0, MAX_SELECTION_STRING) : item
        )
        .slice(0, MAX_SELECTION_ARRAY_LEN);
    } else {
      const serialized =
        typeof v === "object" ? JSON.stringify(v) : String(v as string | symbol | bigint);
      safe[k] = serialized.slice(0, MAX_SELECTION_STRING);
    }
  }
  logClientActivity("user_selection", "interaction", safe);
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushActivityQueue();
  }, 400);
}

export async function flushActivityQueue(): Promise<void> {
  if (typeof window === "undefined" || queue.length === 0) return;
  const batch = queue;
  queue = [];

  const visitor_id = getActivityVisitorId();
  if (visitor_id === "ssr") return;

  const session_id = getActivityServerSessionId() ?? undefined;
  const payload = JSON.stringify({ visitor_id, session_id, events: batch });

  try {
    const res = await fetch("/api/activity/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "include",
    });
    if (res.ok) {
      const data = (await res.json()) as { session_id?: string };
      if (data.session_id) setActivityServerSessionId(data.session_id);
    }
  } catch {
    queue = batch.concat(queue);
  }
}

let flushOnLeaveInstalled = false;

export function installActivityFlushOnLeave() {
  if (typeof window === "undefined") return;
  // Module-level guard: the listeners are bound once per page load. A
  // component ref would reset on remount and re-bind duplicate listeners.
  if (flushOnLeaveInstalled) return;
  flushOnLeaveInstalled = true;
  const run = () => void flushActivityQueue();
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") run();
  });
  window.addEventListener("pagehide", run);
}
