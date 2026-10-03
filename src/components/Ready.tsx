import { useState } from "react";
import terrain from "../assets/terrain.jpg";
import {
  buildUrls,
  fmtCD,
  fmtClock,
  relTime,
  type SiteId,
  type Status,
} from "../lib";
import { Arrow, BannerGlyph, ListGlyph, ScriptBlock, StatusPill } from "./ui";

type Props = {
  nick: string;
  status: Status;
  now: number;
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
    body: "It is stored in this browser only. Both vote forms get filled from it, so you never type it again.",
  },
  {
    n: "02",
    title: "Start the chain",
    body: "One tab walks you from czech-craft to craftlist. The script submits what it can and hands you the captchas.",
  },
  {
    n: "03",
    title: "Watch the clock",
    body: "Both lists lock you out for a day after a vote. The panel on the left counts down to the exact unlock time.",
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

export default function Ready({
  nick,
  status,
  now,
  onNick,
  onToast,
  onClearStatus,
  onReset,
  onRedoSetup,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nick);

  const urls = buildUrls(nick);
  const hasNick = nick.trim().length > 0;

  const read = (id: SiteId) => {
    const c = status[id];
    return c && c.until > now ? c : null;
  };
  const cdCzech = read("czech");
  const cdCraft = read("craftlist");
  const anyCD = !!(cdCzech || cdCraft);
  const soonest = Math.min(
    cdCzech?.until ?? Infinity,
    cdCraft?.until ?? Infinity,
  );

  /* how far through the lock window are we */
  let pct = 100;
  if (anyCD) {
    const target = cdCzech && cdCzech.until === soonest ? cdCzech : (cdCraft ?? cdCzech!);
    const started = status.updated ?? target.until - 86400000;
    const total = Math.max(1, target.until - started);
    pct = Math.min(100, Math.max(0, ((now - started) / total) * 100));
  }

  const hero = !hasNick
    ? {
        title: (
          <>
            Set a nickname
            <br />
            to open the ticket.
          </>
        ),
        sub: "Nothing is sent anywhere — it is saved in this browser and used to fill both vote forms automatically.",
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
            cdCzech && cdCraft
              ? "Both lists are cooling down. The shorter one unlocks first — the clock on the left is exact."
              : cdCzech
                ? "The chain starts on czech-craft, which is on cooldown. You can still take the craftlist vote now."
                : "Craftlist is on cooldown. The czech-craft vote is still open if you want to take it manually.",
        }
      : {
          title: (
            <>
              Ready when you are,{" "}
              <em className="font-light italic text-pine">{nick}</em>.
            </>
          ),
          sub: "The chain opens czech-craft first, then hands you over to craftlist. Two captchas, one tab, about forty seconds.",
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
                  {anyCD ? "Next vote in" : "Both lists"}
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
                  ? cdCzech && cdCraft
                    ? "Both sites unlock at different times — the shorter one is shown."
                    : cdCzech
                      ? "czech-craft unlocks first, then the chain is complete again."
                      : "Only craftlist is holding. czech-craft is open now."
                  : "Nothing is locked. Both lists accept a vote right now."}
              </p>

              <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-moss transition-[width] duration-700 ease-out"
                  style={{ width: pct + "%" }}
                />
              </div>

              <div className="mt-5 flex flex-col gap-2.5 border-t border-white/15 pt-4">
                {sites.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3"
                  >
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
                    ? ((cdCzech ? 1 : 0) + (cdCraft ? 1 : 0)) +
                      " site" +
                      ((cdCzech ? 1 : 0) + (cdCraft ? 1 : 0) > 1 ? "s" : "") +
                      " locked"
                    : status.updated
                      ? "Updated " + relTime(now - status.updated)
                      : "Both sites are ready"}
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
          <span className="micro">Daily vote routine · 2 lists</span>
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
                  czech-craft → craftlist · both sites in one tab
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
    </div>
  );
}
