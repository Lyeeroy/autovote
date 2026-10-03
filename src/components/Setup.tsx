import { useState, type ReactNode } from "react";
import { Mark, ScriptBlock } from "./ui";

type BrowserId = "chrome" | "firefox" | "edge" | "safari";

const BROWSERS: {
  id: BrowserId;
  label: string;
  href: string;
  cta: string;
  note: ReactNode;
}[] = [
  {
    id: "chrome",
    label: "Chrome",
    href: "https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo",
    cta: "Install Tampermonkey for Chrome",
    note: (
      <>
        On the Chrome Web Store page, click{" "}
        <strong className="font-semibold text-ink">“Add to Chrome”</strong>,
        then{" "}
        <strong className="font-semibold text-ink">“Add extension”</strong> in
        the confirmation popup.
      </>
    ),
  },
  {
    id: "firefox",
    label: "Firefox",
    href: "https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/",
    cta: "Install Tampermonkey for Firefox",
    note: (
      <>
        On the Firefox Add-ons page, click{" "}
        <strong className="font-semibold text-ink">“Add to Firefox”</strong>,
        then <strong className="font-semibold text-ink">“Add”</strong> in the
        confirmation dialog.
      </>
    ),
  },
  {
    id: "edge",
    label: "Edge",
    href: "https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd",
    cta: "Install Tampermonkey for Edge",
    note: (
      <>
        On the Edge Add-ons page, click{" "}
        <strong className="font-semibold text-ink">“Get”</strong>, then{" "}
        <strong className="font-semibold text-ink">“Add extension”</strong> in
        the popup.
      </>
    ),
  },
  {
    id: "safari",
    label: "Safari",
    href: "https://apps.apple.com/app/tampermonkey/id6738342400",
    cta: "Install Tampermonkey for Safari",
    note: (
      <>
        Safari users install Tampermonkey from the Mac App Store. After
        installing, open{" "}
        <strong className="font-semibold text-ink">
          Safari → Settings → Extensions
        </strong>{" "}
        and enable Tampermonkey.
      </>
    ),
  },
];

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span
        className={[
          "h-[6px] rounded-full transition-all",
          step === 1 ? "w-10 bg-ink" : "w-10 bg-moss",
        ].join(" ")}
      />
      <span
        className={[
          "h-[6px] rounded-full transition-all",
          step === 2 ? "w-10 bg-ink" : "w-10 bg-rule",
        ].join(" ")}
      />
    </div>
  );
}

type Props = {
  nick: string;
  step: 1 | 2;
  onNick: (n: string) => void;
  onStep: (s: 1 | 2) => void;
  onFinish: () => void;
  onToast: (m: string) => void;
};

export default function Setup({
  nick,
  step,
  onNick,
  onStep,
  onFinish,
  onToast,
}: Props) {
  const [draft, setDraft] = useState(nick);
  const [browser, setBrowser] = useState<BrowserId>("chrome");

  const submit = () => {
    const n = draft.trim();
    if (!n) {
      onToast("Enter a nickname first");
      return;
    }
    onNick(n);
    onStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (step === 1) {
    return (
      <div className="mx-auto max-w-[520px] px-5 pb-24 pt-14 sm:px-8">
        <Stepper step={1} />
        <div className="mt-12 text-center">
          <Mark className="mx-auto h-11 w-11" />
          <h1 className="mt-7 font-display text-[clamp(30px,5vw,42px)] font-semibold leading-[1.05] tracking-[-0.025em]">
            Your Minecraft
            <br />
            nickname
          </h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-[14.5px] leading-[1.7] text-muted">
            This gets saved in your browser and used to fill both vote forms
            automatically.
          </p>
        </div>

        <div className="mt-10 rounded-[18px] border border-rule bg-card p-6 shadow-[0_1px_0_rgba(23,32,27,0.04)] sm:p-7">
          <label
            htmlFor="nickname-setup"
            className="micro block"
          >
            Nickname
          </label>
          <input
            id="nickname-setup"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="e.g. Pivomir"
            autoComplete="off"
            spellCheck={false}
            className="mt-2.5 w-full rounded-lg border border-rule bg-warm px-3.5 py-3 text-[16px] transition-colors focus:border-moss focus:bg-card focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="micro">3–16 characters</span>
            <span className="num text-[11px] text-muted">
              {draft.trim().length} chars
            </span>
          </div>
          <button
            onClick={submit}
            className="mt-5 w-full rounded-lg bg-ink px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-pine"
          >
            Continue
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onFinish}
            className="text-[12.5px] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Skip setup
          </button>
        </div>
      </div>
    );
  }

  const active = BROWSERS.find((b) => b.id === browser) ?? BROWSERS[0];

  return (
      <div className="mx-auto max-w-[900px] px-5 pb-24 pt-12 sm:px-8">
      <Stepper step={2} />

      <div className="mt-11">
        <h1 className="font-display text-[clamp(30px,5vw,44px)] font-semibold leading-[1.03] tracking-[-0.025em]">
          Install <em className="font-light italic text-pine">Tampermonkey</em>
        </h1>
        <p className="mt-4 max-w-[52ch] text-[14.5px] leading-[1.7] text-muted">
          Tampermonkey is a browser extension that runs the voting script. It is
          free and takes about a minute to set up.
        </p>
      </div>

      {/* 01 — install the extension */}
      <section className="mt-10 border-t border-ink pt-5">
        <div className="flex items-start gap-5">
          <span className="num shrink-0 pt-[3px] text-[11px] text-ochre">01</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-semibold leading-tight">
              Install the extension
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-muted">
              Choose your browser below and click the link to open the extension
              store.
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {BROWSERS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrowser(b.id)}
                  className={[
                    "rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors",
                    browser === b.id
                      ? "border-ink bg-ink text-white"
                      : "border-rule bg-card text-muted hover:border-ink/25 hover:text-ink",
                  ].join(" ")}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[14px] border border-rule bg-card p-5">
              <a
                href={active.href}
                target="_blank"
                rel="opener"
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-medium text-white no-underline transition-colors hover:bg-pine"
              >
                {active.cta}
                <span className="text-white/60 text-[11px]">↗</span>
              </a>
              <p className="mt-3.5 text-[12.5px] leading-[1.7] text-muted">
                {active.note}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 02 — add the script */}
      <section className="mt-9 border-t border-rule pt-5">
        <div className="flex items-baseline gap-5">
          <span className="num shrink-0 text-[11px] text-ochre">02</span>
          <h2 className="font-display text-[20px] font-semibold leading-tight">
            Add the voting script
          </h2>
        </div>
        <p className="mt-3 max-w-[68ch] text-[13.5px] leading-[1.65] text-muted">
          Click the Tampermonkey icon in your browser toolbar, then choose{" "}
          <strong className="font-semibold text-ink">“Dashboard”</strong>. Click
          the <strong className="font-semibold text-ink">+</strong> tab to create
          a new script, and paste the code below into the editor.
        </p>
        {/* full measure — the script is long, it gets the whole column */}
        <div className="mt-5">
          <ScriptBlock onToast={onToast} />
        </div>
        <p className="mt-3 text-[12px] leading-[1.7] text-muted">
          After pasting, press{" "}
          <strong className="font-semibold text-ink">Ctrl+S</strong> (or{" "}
          <strong className="font-semibold text-ink">Cmd+S</strong> on Mac) to
          save the script.
        </p>
      </section>

      {/* 03 — done */}
      <section className="mt-9 border-t border-rule pt-5">
        <div className="flex items-start gap-5">
          <span className="num shrink-0 pt-[3px] text-[11px] text-moss">03</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-semibold leading-tight">
              You are all set
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-muted">
              The script will automatically fill both vote forms. You just need
              to solve the captcha on each site when it appears.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-11 flex flex-col gap-3 border-t border-ink pt-6 sm:flex-row">
        <button
          onClick={() => onStep(1)}
          className="flex-1 rounded-xl border border-rule bg-card px-4 py-3.5 text-[14px] font-medium text-muted transition-colors hover:border-ink/25 hover:text-ink"
        >
          ← Back
        </button>
        <button
          onClick={onFinish}
          className="flex-1 rounded-xl bg-ink px-4 py-3.5 text-[14px] font-medium text-white transition-colors hover:bg-pine"
        >
          Finish setup
        </button>
      </div>
      <div className="mt-5 text-center">
        <button
          onClick={onFinish}
          className="text-[12.5px] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
