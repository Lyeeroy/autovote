import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import terrain from "../assets/terrain.jpg";
import {
  buildUrls,
  fmtCD,
  fmtClock,
  relTime,
  type Cooldown,
  type SiteId,
  type Status,
} from "../lib";
import {
  Arrow,
  BannerGlyph,
  ListGlyph,
  ScriptBlock,
  ServerGlyph,
  StatusPill,
  Switch,
  VolumeGlyph,
} from "./ui";

type Props = {
  nick: string;
  status: Status;
  now: number;
  soundOn: boolean;
  onSound: (on: boolean) => void;
  volume: number;
  onVolume: (v: number) => void;
  onCue: () => void;
  onNick: (n: string) => void;
  onToast: (m: string) => void;
  onClearStatus: () => void;
  onReset: () => void;
  onRedoSetup: () => void;
};

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Set the nickname once",
    body: "It is stored in this browser only. Vote forms get filled from it, so you never type it again.",
  },
  {
    n: "02",
    title: "Start the chain",
    body: "One tab walks you through czech-craft, craftlist, and minecraftservery. The script fills your nick, submits what it can, and hands you the captchas.",
  },
  {
    n: "03",
    title: "Watch the clock",
    body: "Lists lock you out after a vote. The panel on the left counts down to the exact unlock time.",
  },
];

const NOTES: { label: string; body: string }[] = [
  {
    label: "Captcha",
    body: "The script never solves captchas for you — that part stays manual on each site.",
  },
  {
    label: "@match caching",
    body: "Delete the old userscript before pasting a new one. Tampermonkey caches the @match rules of the previous version.",
  },
  {
    label: "Cooldown sync",
    body: "The userscript reports unlocks back to this page with postMessage, so the countdown updates without a refresh.",
  },
];

/** window length assumed when a site only tells us the unlock clock, not the lock start */
const NOMINAL_WINDOW = 2 * 60 * 60 * 1000;

export default function Ready({
  nick,
  status,
  now,
  soundOn,
  onSound,
  volume,
  onVolume,
  onCue,
  onNick,
  onToast,
  onClearStatus,
  onReset,
  onRedoSetup,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nick);
  const [volOpen, setVolOpen] = useState(false);
  const [volPos, setVolPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const volBtnRef = useRef<HTMLButtonElement | null>(null);
  const volPanelRef = useRef<HTMLDivElement | null>(null);

  /* the panel lives in a portal, so it is placed from the button's box */
  const placeVolume = useCallback(() => {
    const btn = volBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = volPanelRef.current?.offsetWidth || 158;
    const h = volPanelRef.current?.offsetHeight || 96;
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    setVolPos({ top, left: Math.max(8, r.right - w) });
  }, []);

  const toggleVolume = () => {
    setVolOpen((v) => {
      if (!v) placeVolume();
      return !v;
    });
  };

  /* keep it glued to the button while the page scrolls, dismiss like a dropdown */
  useEffect(() => {
    if (!volOpen) return;
    placeVolume();
    const onMove = () => placeVolume();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !volBtnRef.current?.contains(t) &&
        !volPanelRef.current?.contains(t)
      ) {
        setVolOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVolOpen(false);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [volOpen, placeVolume]);

  const urls = buildUrls(nick);
  const hasNick = nick.trim().length > 0;

  const read = (id: SiteId) => {
    const c = status[id];
    return c && c.until > now ? c : null;
  };
  const cdCzech = read("czech");
  const cdCraft = read("craftlist");
  const cdServer = read("minecraftservery");
  const activeCDs = [cdCzech, cdCraft, cdServer].filter(
    (c): c is NonNullable<typeof c> => !!c,
  );
  const anyCD = activeCDs.length > 0;
  const soonest = anyCD ? Math.min(...activeCDs.map((c) => c.until)) : Infinity;

  /* one loader per site — how far through its own lock window we are */
  const loaderPct = (c: Cooldown | null) => {
    if (!c) return 100;
    const started = c.from ?? c.until - NOMINAL_WINDOW;
    const total = Math.max(1, c.until - started);
    return Math.min(100, Math.max(0, ((now - started) / total) * 100));
  };

  const hero = !hasNick
    ? {
        title: (
          <>
            Set a nickname
            <br />
            to open the ticket.
          </>
        ),
        sub: "Nothing is sent anywhere — it is saved in this browser and used to fill vote forms automatically.",
      }
    : anyCD
      ? {
          title: (
            <>
              Come back in{" "}
              <em className="font-light italic text-pine">
                {fmtCD(soonest - now)}
              </em>
              .
            </>
          ),
          sub:
            activeCDs.length === 3
              ? "All lists are cooling down. The shorter one unlocks first — the clock on the left is exact."
              : `${activeCDs.length} ${activeCDs.length === 1 ? "list is" : "lists are"} cooling down. Other votes are still open if you want to take them manually.`,
        }
      : {
          title: (
            <>
              Ready when you are,{" "}
              <em className="font-light italic text-pine">{nick}</em>.
            </>
          ),
          sub: "All vote lists are open. Click below to start the chain or vote manually on any list.",
        };

  const sites = [
    {
      id: "czech" as SiteId,
      name: "czech-craft.eu",
      sub: "Czech server list · first stop of the chain",
      href: urls.czechManual,
      Glyph: BannerGlyph,
      cd: cdCzech,
    },
    {
      id: "craftlist" as SiteId,
      name: "craftlist.cz",
      sub: "Server list · second stop, or vote on its own",
      href: urls.craftlistManual,
      Glyph: ListGlyph,
      cd: cdCraft,
    },
    {
      id: "minecraftservery" as SiteId,
      name: "minecraftservery.eu",
      sub: "Server list · votes reset every 2 hours",
      href: urls.minecraftserveryManual,
      Glyph: ServerGlyph,
      cd: cdServer,
    },
  ];

  const saveDraft = () => {
    const n = draft.trim();
    if (!n) {
      onToast("Enter a nickname first");
      return;
    }
    onNick(n);
    setEditing(false);
    onToast("Nickname saved");
  };

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[336px_minmax(0,1fr)] lg:gap-12 lg:pt-14">
      {/* ─────────────── LEFT RAIL ─────────────── */}
      <aside>
        <div className="flex flex-col gap-5 lg:sticky lg:top-[92px]">
          {/* the departure board */}
          <div className="grain relative isolate overflow-hidden rounded-[18px] bg-pine-deep text-white">
            <img
              src={terrain}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-pine-deep/93 via-pine-deep/88 to-pine-deep/97" />
            <div className="relative px-6 pb-5 pt-6">
              <div className="flex items-center justify-between gap-3">
                <span className="micro micro-light">
                  {anyCD ? "Next vote in" : "All lists"}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={[
                      "h-[6px] w-[6px] rounded-full",
                      anyCD ? "bg-ochre" : "bg-moss",
                    ].join(" ")}
                  />
                  <span className="micro micro-light">
                    {anyCD ? "on hold" : "open"}
                  </span>
                </span>
              </div>

              <div className="mt-5">
                {anyCD ? (
                  <div className="num text-[clamp(34px,7vw,44px)] font-medium leading-none tracking-[-0.02em]">
                    {fmtClock(soonest - now)}
                  </div>
                ) : (
                  <div className="font-display text-[clamp(42px,8vw,54px)] font-semibold italic leading-[0.9] tracking-[-0.03em]">
                    Ready
                  </div>
                )}
              </div>

              <p className="mt-3 min-h-[36px] text-[12.5px] leading-[1.5] text-white/78">
                {anyCD
                  ? activeCDs.length === sites.length
                    ? "All sites unlock at different times — the clock shows the shortest wait, every bar tracks its own site."
                    : `${activeCDs.length} ${activeCDs.length === 1 ? "site is" : "sites are"} on hold. Other sites are open now.`
                  : "Nothing is locked. All lists accept a vote right now."}
              </p>

              <div className="mt-5 flex flex-col gap-3.5 border-t border-white/15 pt-4">
                {sites.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-white/80">
                        <span
                          className={[
                            "h-[5px] w-[5px] shrink-0 rounded-full",
                            s.cd ? "bg-ochre" : "bg-moss",
                          ].join(" ")}
                        />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span
                        className={[
                          "num shrink-0 text-[12px]",
                          s.cd ? "text-white/85" : "text-white/45",
                        ].join(" ")}
                      >
                        {s.cd ? fmtClock(s.cd.until - now) : "ready"}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={
                        s.cd
                          ? s.name + " lock elapsed"
                          : s.name + " open for voting"
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(loaderPct(s.cd))}
                      className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/15"
                    >
                      <div
                        className={[
                          "h-full rounded-full transition-[width] duration-700 ease-out",
                          s.cd ? "bg-ochre" : "bg-moss",
                        ].join(" ")}
                        style={{ width: loaderPct(s.cd) + "%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* utility ledger */}
          <div className="overflow-hidden rounded-[18px] border border-rule bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="min-w-0">
                <div className="micro">Nickname</div>
                {editing ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveDraft();
                      if (e.key === "Escape") {
                        setDraft(nick);
                        setEditing(false);
                      }
                    }}
                    placeholder="Your Minecraft nick"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1.5 w-full rounded-md border border-rule bg-warm px-2.5 py-1.5 text-[14px] focus:border-moss focus:bg-card focus:outline-none"
                  />
                ) : (
                  <div className="mt-1 truncate font-display text-[16px] font-semibold tracking-[-0.01em]">
                    {hasNick ? nick : "Not set"}
                  </div>
                )}
              </div>
              {editing ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={saveDraft}
                    className="rounded-md bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-pine"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setDraft(nick);
                      setEditing(false);
                    }}
                    className="rounded-md border border-rule px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDraft(nick);
                    setEditing(true);
                  }}
                  className="shrink-0 text-[12px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="min-w-0">
                <div className="micro">Voting script</div>
                <div className="mt-1 truncate text-[13px] text-muted">
                  userscript · for Tampermonkey
                </div>
              </div>
              <button
                onClick={onRedoSetup}
                className="shrink-0 text-[12px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                View
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="min-w-0">
                <div className="micro">Cooldowns</div>
                <div className="mt-1 truncate text-[13px] text-muted">
                  {anyCD
                    ? activeCDs.length +
                      " site" +
                      (activeCDs.length > 1 ? "s" : "") +
                      " locked"
                    : status.updated
                      ? "Updated " + relTime(now - status.updated)
                      : "All sites are ready"}
                </div>
              </div>
              <button
                onClick={onClearStatus}
                disabled={!anyCD}
                className="shrink-0 text-[12px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:no-underline"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
              <div className="min-w-0">
                <div className="micro">Unlock sound</div>
                <div className="mt-1 truncate text-[13px] text-muted">
                  {!soundOn
                    ? "Off — only the visual clock"
                    : volume === 0
                      ? "Volume at zero — silent"
                      : "Chime when a cooldown ends"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  ref={volBtnRef}
                  type="button"
                  onClick={toggleVolume}
                  aria-expanded={volOpen}
                  aria-label={
                    volOpen ? "Hide volume slider" : "Show volume slider"
                  }
                  className="grid h-[22px] w-[22px] place-items-center rounded-md text-muted transition-colors hover:bg-warm hover:text-ink"
                >
                  <VolumeGlyph
                    muted={!soundOn || volume === 0}
                    className="h-[15px] w-[15px]"
                  />
                </button>
                <Switch
                  checked={soundOn}
                  onChange={onSound}
                  label="Play a sound when a cooldown ends"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="micro">Stored data</div>
                <div className="mt-1 truncate text-[13px] text-muted">
                  Remove nickname &amp; cooldowns
                </div>
              </div>
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      "Remove the saved nickname? You will need to set it up again.",
                    )
                  )
                    return;
                  onReset();
                }}
                className="shrink-0 text-[12px] font-medium text-[#a8442f] underline-offset-4 transition-colors hover:underline"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ─────────────── RIGHT COLUMN ─────────────── */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="micro">Daily vote routine · 3 lists</span>
          <span className="num text-[11px] text-muted">
            ticket · majncraft / vote
          </span>
        </div>

        <h1 className="mt-5 font-display text-[clamp(38px,6.4vw,68px)] font-semibold leading-[0.96] tracking-[-0.032em]">
          {hero.title}
        </h1>
        <p className="mt-6 max-w-[56ch] text-[15px] leading-[1.7] text-muted">
          {hero.sub}
        </p>

        {/* the one primary action */}
        {hasNick ? (
          <a
            href={urls.chain}
            target="_blank"
            rel="opener"
            className="group mt-9 block overflow-hidden rounded-[18px] bg-pine text-white no-underline transition-colors duration-200 hover:bg-[#1a5238]"
          >
            <div className="flex items-center gap-5 px-6 py-6 sm:px-8 sm:py-7">
              <span className="num hidden shrink-0 text-[11px] text-white/45 sm:block">
                01
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[clamp(19px,2.6vw,25px)] font-semibold leading-tight tracking-[-0.02em]">
                  Start auto chain voting
                </span>
                <span className="mt-1.5 block text-[13px] text-white/65">
                  czech-craft → craftlist → minecraftservery · all sites in one
                  tab
                </span>
              </span>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25">
                <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </div>
          </a>
        ) : (
          <button
            onClick={() => {
              setDraft(nick);
              setEditing(true);
            }}
            className="mt-9 block w-full overflow-hidden rounded-[18px] border border-dashed border-rule bg-card px-6 py-7 text-left transition-colors hover:border-moss sm:px-8"
          >
            <span className="block font-display text-[21px] font-semibold leading-tight">
              Add your nickname to enable the chain
            </span>
            <span className="mt-1.5 block text-[13px] text-muted">
              It is stored locally in this browser — click to set it now.
            </span>
          </button>
        )}

        {/* manual ledger */}
        <div className="mt-14">
          <div className="flex items-end justify-between gap-4 border-b border-ink pb-2.5">
            <h2 className="micro">Vote manually</h2>
            <span className="micro">Next unlock</span>
          </div>

          <div>
            {sites.map((s) => (
              <a
                key={s.id}
                href={hasNick ? s.href : "#"}
                target="_blank"
                rel="opener"
                onClick={(e) => {
                  if (!hasNick) {
                    e.preventDefault();
                    setDraft(nick);
                    setEditing(true);
                    onToast("Enter a nickname first");
                  }
                }}
                className="group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-4 border-b border-rule px-2 py-6 no-underline text-ink transition-colors duration-200 hover:bg-warm sm:gap-6 sm:px-4"
              >
                <span className="grid h-[42px] w-[42px] place-items-center rounded-[11px] border border-rule bg-warm text-pine transition-colors group-hover:border-moss/40 group-hover:bg-moss-soft">
                  <s.Glyph className="h-[19px] w-[19px]" />
                </span>

                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-display text-[19px] font-semibold leading-none tracking-[-0.015em]">
                      {s.name}
                    </span>
                    <StatusPill
                      ready={!s.cd}
                      label={s.cd ? fmtCD(s.cd.until - now) : "Ready"}
                    />
                  </span>
                  <span className="mt-2 block text-[13px] leading-[1.5] text-muted">
                    {s.cd
                      ? "Locked until " + (s.cd.raw || "the next reset")
                      : s.sub}
                  </span>
                </span>

                <span className="flex items-center gap-4">
                  <span className="num hidden text-[12px] text-muted sm:block">
                    {s.cd ? fmtClock(s.cd.until - now) : "open now"}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-rule text-muted transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-white">
                    <Arrow className="h-[15px] w-[15px] transition-transform duration-200 group-hover:translate-x-[3px]" />
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* how it works */}
        <div className="mt-16">
          <h2 className="micro">How this ticket works</h2>
          <div className="mt-4">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 border-t border-rule py-6 sm:gap-7"
              >
                <span className="num pt-[3px] text-[11px] text-ochre">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-[19px] font-semibold leading-tight tracking-[-0.015em]">
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-[58ch] text-[13.5px] leading-[1.7] text-muted">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* technical appendix — the script gets the full measure */}
        <div className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ink pb-2.5">
            <h2 className="micro">Technical appendix · voting script</h2>
            <span className="micro">Full source</span>
          </div>
          <p className="mt-5 max-w-[62ch] text-[13.5px] leading-[1.7] text-muted">
            Paste this into a new Tampermonkey script and save it. The page
            listens for cooldown reports from it and updates the clock on the
            left automatically.
          </p>
          <div className="mt-6">
            <ScriptBlock onToast={onToast} />
          </div>
          <div className="mt-8 grid gap-x-9 sm:grid-cols-3">
            {NOTES.map((n) => (
              <div key={n.label} className="border-t border-rule py-4">
                <div className="micro">{n.label}</div>
                <p className="mt-2 text-[13px] leading-[1.65] text-muted">
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* the volume popover lives on <body> — the ledger card clips its overflow */}
      {volOpen &&
        volPos &&
        createPortal(
          <div
            ref={volPanelRef}
            style={{ top: volPos.top, left: volPos.left }}
            className="fixed z-50 w-[158px] rounded-xl border border-rule bg-card p-3 shadow-[0_14px_34px_rgba(12,42,29,0.2)]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="micro">Volume</span>
              <span className="num text-[11px] text-muted">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(volume * 100)}
              disabled={!soundOn}
              aria-label="Unlock sound volume"
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              onPointerUp={onCue}
              onKeyUp={onCue}
              onTouchEnd={onCue}
              className="mt-2 h-4 w-full cursor-pointer accent-moss disabled:cursor-not-allowed disabled:opacity-40"
            />
            <p className="mt-1.5 text-[11px] leading-[1.5] text-muted">
              {soundOn ? "" : ""}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
