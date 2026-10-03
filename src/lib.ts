export type SiteId = "czech" | "craftlist";
export type Cooldown = { until: number; raw?: string };
export type Status = Partial<Record<SiteId, Cooldown>> & { updated?: number };

export const STORAGE_KEY = "majncraft_nickname";
export const STATUS_KEY = "majncraft_status";
export const SETUP_DONE_KEY = "majncraft_setup_done";

export const scriptText = `Lets ignore the tampermonkey script for voting for now`;

export function getNick(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setNick(n: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, n);
  } catch {
    /* storage unavailable */
  }
}

export function isSetupDone(): boolean {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markSetupDone(): void {
  try {
    localStorage.setItem(SETUP_DONE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export function buildUrls(nick: string) {
  const e = encodeURIComponent(nick);
  const manual = "&manual=1";
  return {
    chain: "https://czech-craft.eu/server/majncraft/vote/?user=" + e,
    czechManual:
      "https://czech-craft.eu/server/majncraft/vote/?user=" + e + manual,
    craftlistManual:
      "https://craftlist.cz/majncraft-cz?nickname=" + e + manual,
  };
}

export function loadStatus(): Status {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function saveStatus(s: Status): void {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify({ ...s, updated: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function clearStatus(): void {
  try {
    localStorage.removeItem(STATUS_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STATUS_KEY);
    localStorage.removeItem(SETUP_DONE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** 4h 12m — the human wait */
export function fmtCD(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + sec + "s";
  return sec + "s";
}

/** 04:12:33 — the departure board */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return p(h) + ":" + p(m) + ":" + p(sec);
}

export function relTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  return h + "h ago";
}

export async function copyText(text: string): Promise<boolean> {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallback();
    }
  }
  return fallback();
}
