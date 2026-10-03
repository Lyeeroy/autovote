import { useState } from "react";
import { copyText, scriptText } from "../lib";

/** Isometric grass block — three faces, still reads at 16px. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2.6 29.4 10 16 17.4 2.6 10Z" fill="#2E7D5B" />
      <path d="M2.6 10 16 17.4V29.4L2.6 22Z" fill="#0C2A1D" />
      <path d="M29.4 10 16 17.4V29.4L29.4 22Z" fill="#14432E" />
    </svg>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function BannerGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.5 21V3.6" />
      <path d="M5.5 4.4h13l-2.6 4.1 2.6 4.1h-13" />
    </svg>
  );
}

export function ListGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 6h11M9 12h11M9 18h11M4.6 6h.01M4.6 12h.01M4.6 18h.01" />
    </svg>
  );
}

export function ServerGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
      <line x1="7" y1="17" x2="7.01" y2="17" />
    </svg>
  );
}

export function StatusPill({
  ready,
  label,
}: {
  ready: boolean;
  label: string;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-medium",
        ready
          ? "border-moss/25 bg-moss-soft text-pine"
          : "border-ochre/25 bg-ochre-soft text-[#8c4f11]",
      ].join(" ")}
    >
      <span
        className={[
          "h-[5px] w-[5px] rounded-full",
          ready ? "bg-moss" : "bg-ochre",
        ].join(" ")}
      />
      {label}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200",
        checked ? "border-moss bg-moss" : "border-rule bg-warm",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-card shadow-[0_1px_2px_rgba(23,32,27,0.3)] transition-[left] duration-200",
          checked ? "left-[18px]" : "left-[2px]",
        ].join(" ")}
      />
    </button>
  );
}

export function ScriptBlock({ onToast }: { onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [wrap, setWrap] = useState(false);
  const lines = scriptText.split("\n");
  const size =
    scriptText.length > 1024
      ? (scriptText.length / 1024).toFixed(1) + " kB"
      : scriptText.length + " B";

  const handle = async () => {
    setBusy(true);
    const ok = await copyText(scriptText);
    onToast(ok ? "Copied to clipboard" : "Copy failed");
    window.setTimeout(() => setBusy(false), 900);
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule bg-warm">
      {/* toolbar — stays put while 600 lines scroll underneath */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule bg-card px-4 py-2.5">
        <span className="flex items-baseline gap-2.5">
          <span className="micro">Voting script</span>
          <span className="num text-[10px] text-muted/80">
            {lines.length} lines · {size}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            className={[
              "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
              wrap
                ? "border-ink/25 bg-moss-soft text-pine"
                : "border-rule bg-card text-muted hover:border-ink/25 hover:text-ink",
            ].join(" ")}
          >
            Wrap
          </button>
          <button
            onClick={handle}
            className="rounded-md border border-rule bg-card px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-ink/25 hover:text-ink"
          >
            {busy ? "Copied" : "Copy"}
          </button>
        </span>
      </div>

      <pre className="m-0 max-h-[560px] min-h-[220px] overflow-auto bg-warm">
        <code
          className={[
            "block font-mono text-[11.5px] leading-[1.85]",
            wrap ? "w-full" : "w-max min-w-full",
          ].join(" ")}
        >
          {lines.map((line, i) => (
            <span key={i} className="flex">
              <span className="num sticky left-0 z-10 w-[52px] shrink-0 select-none border-r border-rule-soft bg-[#f1ece4] pr-3 text-right text-[10px] leading-[1.85] text-muted/70">
                {i + 1}
              </span>
              <span
                className={[
                  "px-4 text-[#3b4239]",
                  wrap
                    ? "whitespace-pre-wrap break-words"
                    : "whitespace-pre",
                ].join(" ")}
              >
                {line}
              </span>
            </span>
          ))}
        </code>
      </pre>

      <div className="flex items-center justify-between gap-3 border-t border-rule bg-card px-4 py-2">
        <span className="micro">
          Tampermonkey → Dashboard → + → paste → Ctrl+S
        </span>
        <span className="num text-[10px] text-muted/80">UTF-8</span>
      </div>
    </div>
  );
}
