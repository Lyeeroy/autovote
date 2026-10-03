import { useCallback, useEffect, useRef, useState } from "react";
import dawn from "./assets/dawn.jpg";
import levelup from "./assets/levelup.mp3";
import Ready from "./components/Ready";
import Setup from "./components/Setup";
import { GithubGlyph, Mark } from "./components/ui";
import {
  clearAll,
  clearStatus,
  getNick,
  getSound,
  getVolume,
  isSetupDone,
  loadStatus,
  markSetupDone,
  saveSound,
  saveStatus,
  saveVolume,
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
  const [soundOn, setSoundOn] = useState(() => getSound());
  const [volume, setVolume] = useState(() => getVolume());
  const volumeRef = useRef(volume);
  const statusRef = useRef(status);
  const soundOnRef = useRef(soundOn);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const pushToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* the chime — played when a lock window runs out, and as a preview on switch-on */
  const playCue = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.volume = volumeRef.current;
    void el.play().catch(() => {
      pushToast("Browser blocked the sound — click the page once");
    });
  }, [pushToast]);

  const setSound = useCallback(
    (on: boolean) => {
      saveSound(on);
      setSoundOn(on);
      soundOnRef.current = on;
      if (on) playCue();
    },
    [playCue],
  );

  /* slider drag: keep it live in memory, stored once the knob is let go */
  const setVolumeLevel = useCallback((v: number) => {
    const level = Math.min(1, Math.max(0, v));
    volumeRef.current = level;
    setVolume(level);
  }, []);

  const previewCue = useCallback(() => {
    saveVolume(volumeRef.current);
    playCue();
  }, [playCue]);

  /* every status write goes through here, so the clock always reads fresh data */
  const commit = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /* one shared clock: cooldowns tick down with no layout shift */
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const next: Status = { ...statusRef.current };
      let changed = false;
      let justUnlocked = false;
      for (const k of SITES) {
        const c = next[k];
        if (c && c.until <= t) {
          delete next[k];
          changed = true;
          /* a single site coming off cooldown means one vote is ready again */
          justUnlocked = true;
        }
      }
      if (changed) {
        saveStatus(next);
        commit(next);
      }
      if (justUnlocked && soundOnRef.current) playCue();
    }, 1000);
    return () => window.clearInterval(id);
  }, [commit, playCue]);

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
      const next: Status = { ...statusRef.current };
      if (data.until && data.until > Date.now()) {
        next[site] = { until: data.until, from: data.from, raw: data.raw };
      } else {
        delete next[site];
      }
      saveStatus(next);
      commit(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [commit]);

  /* keep several tabs in sync */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STATUS_KEY) commit(loadStatus());
      if (e.key === STORAGE_KEY) setNickState(getNick());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

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
            <a
              href="https://github.com/Lyeeroy/autovote"
              target="_blank"
              rel="noopener noreferrer"
              title="Source on GitHub"
              aria-label="Source on GitHub"
              className="grid h-[26px] w-[26px] place-items-center rounded-full text-muted transition-colors hover:bg-warm hover:text-ink"
            >
              <GithubGlyph className="h-[15px] w-[15px]" />
            </a>
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
            soundOn={soundOn}
            onSound={setSound}
            volume={volume}
            onVolume={setVolumeLevel}
            onCue={previewCue}
            onNick={commitNick}
            onToast={pushToast}
            onClearStatus={() => {
              clearStatus();
              commit({});
              pushToast("Cooldowns cleared");
            }}
            onReset={() => {
              clearAll();
              setNickState("");
              commit({});
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

      <audio ref={audioRef} src={levelup} preload="auto" className="hidden" />

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
