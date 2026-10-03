import { useCallback, useEffect, useRef, useState } from "react";
import dawn from "./assets/dawn.jpg";
import Ready from "./components/Ready";
import Setup from "./components/Setup";
import { Mark } from "./components/ui";
import {
  clearAll,
  clearStatus,
  getNick,
  isSetupDone,
  loadStatus,
  markSetupDone,
  saveStatus,
  setNick,
  STATUS_KEY,
  STORAGE_KEY,
  type SiteId,
  type Status,
} from "./lib";

type View = "s1" | "s2" | "ready";
const SITES: SiteId[] = ["czech", "craftlist", "minecraftservery"];

export default function App() {
  const [nick, setNickState] = useState(() => getNick());
  const [view, setView] = useState<View>(() => {
    const n = getNick();
    return n ? (isSetupDone() ? "ready" : "s2") : "s1";
  });
  const [status, setStatus] = useState<Status>(() => loadStatus());
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const pushToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* one shared clock: cooldowns tick down with no layout shift */
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setStatus((prev) => {
        let changed = false;
        const next: Status = { ...prev };
        for (const k of SITES) {
          const c = next[k];
          if (c && c.until <= t) {
            delete next[k];
            changed = true;
          }
        }
        if (changed) saveStatus(next);
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  /* the userscript reports cooldowns back with postMessage */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            __majncraft?: number;
            type?: string;
            site?: string;
            until?: number;
            from?: number;
            raw?: string;
          }
        | undefined;
      if (!data || data.__majncraft !== 1) return;
      if (data.type !== "cooldown") return;
      const site = data.site as SiteId | undefined;
      if (!site || !SITES.includes(site)) return;
      setStatus((prev) => {
        const next: Status = { ...prev };
        if (data.until && data.until > Date.now()) {
          next[site] = { until: data.until, from: data.from, raw: data.raw };
        } else {
          delete next[site];
        }
        saveStatus(next);
        return next;
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* keep several tabs in sync */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) setStatus(loadStatus());
      if (e.key === STORAGE_KEY) setNickState(getNick());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const commitNick = useCallback((n: string) => {
    setNick(n);
    setNickState(n);
  }, []);

  const anyCooldown = SITES.some((s) => {
    const c = status[s];
    return !!c && c.until > now;
  });

  const dateStr = new Date(now).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Mark className="h-[26px] w-[26px]" />
            <div className="leading-none">
              <div className="font-display text-[16px] font-semibold tracking-[-0.01em]">
                Majncraft
              </div>
              <div className="micro mt-[3px]">Vote helper</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="num hidden text-[11px] text-muted sm:block">
              {dateStr}
            </span>
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium",
                anyCooldown
                  ? "border-ochre/25 bg-ochre-soft text-[#8c4f11]"
                  : "border-moss/25 bg-moss-soft text-pine",
              ].join(" ")}
            >
              <span
                className={[
                  "h-[5px] w-[5px] rounded-full",
                  anyCooldown ? "bg-ochre" : "bg-moss",
                ].join(" ")}
              />
              {anyCooldown ? "On hold" : "All clear"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view === "ready" ? (
          <Ready
            nick={nick}
            status={status}
            now={now}
            onNick={commitNick}
            onToast={pushToast}
            onClearStatus={() => {
              clearStatus();
              setStatus(loadStatus());
              pushToast("Cooldowns cleared");
            }}
            onReset={() => {
              clearAll();
              setNickState("");
              setStatus({});
              setView("s1");
              pushToast("Reset complete");
            }}
            onRedoSetup={() => setView("s2")}
          />
        ) : (
          <Setup
            nick={nick}
            step={view === "s1" ? 1 : 2}
            onNick={commitNick}
            onStep={(s) => setView(s === 1 ? "s1" : "s2")}
            onFinish={() => {
              markSetupDone();
              setView("ready");
            }}
            onToast={pushToast}
          />
        )}
      </main>

      <footer className="grain relative isolate mt-16 overflow-hidden">
        <img
          src={dawn}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-pine-deep/92 via-pine-deep/86 to-pine-deep/96" />
        <div className="relative mx-auto max-w-[1240px] px-5 py-14 sm:px-8 sm:py-16">
          <p className="max-w-[20ch] font-display text-[clamp(26px,4vw,42px)] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
            Daily votes keep Majncraft on the list.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5">
            <span className="micro micro-light">
              Majncraft vote helper · unaffiliated fan tool
            </span>
            <span className="micro micro-light">
              czech-craft.eu · craftlist.cz · minecraftservery.eu
            </span>
          </div>
        </div>
      </footer>

      <div
        role="status"
        aria-live="polite"
        className={[
          "pointer-events-none fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-pine-deep px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_30px_rgba(12,42,29,0.28)] transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        ].join(" ")}
      >
        {toast ?? ""}
      </div>
    </div>
  );
}
