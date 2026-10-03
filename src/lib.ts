export type SiteId = "czech" | "craftlist";
export type Cooldown = { until: number; raw?: string };
export type Status = Partial<Record<SiteId, Cooldown>> & { updated?: number };

export const STORAGE_KEY = "majncraft_nickname";
export const STATUS_KEY = "majncraft_status";
export const SETUP_DONE_KEY = "majncraft_setup_done";

export const scriptText = `// ==UserScript==
// @name         Majncraft Vote Automator
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Accurately parses durations vs clock times on Craftlist & Czech-Craft.
// @author       You
// @match        https://czech-craft.eu/*
// @match        https://craftlist.cz/*
// @match        https://*.craftlist.cz/*
// @match        https://www.google.com/recaptcha/api2/anchor*
// @match        https://www.recaptcha.net/recaptcha/api2/anchor*
// @match        https://recaptcha.net/recaptcha/api2/anchor*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var host = window.location.hostname;
    console.log('[Majncraft] === BOOT v3.3 ===', host, window.location.href);

    var bootTime = Date.now();
    var MIN_ACTION_DELAY = 1000;
    function canAct() { return (Date.now() - bootTime) >= MIN_ACTION_DELAY; }

    /* ---- reCAPTCHA anchor iframe ---- */
    if (host.indexOf('google.com') !== -1 || host.indexOf('recaptcha.net') !== -1) {
        function pressKey(el, key, code, keyCode) {
            ['keydown','keypress','keyup'].forEach(function (t) {
                el.dispatchEvent(new KeyboardEvent(t, {
                    bubbles:true,cancelable:true,view:window,
                    key:key,code:code,keyCode:keyCode,which:keyCode
                }));
            });
        }
        var tries = 0;
        var rt = setInterval(function () {
            var cb = document.querySelector('#recaptcha-anchor') ||
                     document.querySelector('.recaptcha-checkbox') ||
                     document.querySelector('[role="checkbox"]');
            if (cb && cb.getAttribute('aria-checked') !== 'true') {
                try { cb.focus(); } catch (e) {}
                pressKey(cb, 'Enter', 'Enter', 13);
                pressKey(cb, ' ', 'Space', 32);
                try { cb.click(); } catch (e) {}
            }
            if (++tries > 40) clearInterval(rt);
        }, 300);
        return;
    }

    var IS_CZECH = host.indexOf('czech-craft.eu') !== -1;
    var IS_CRAFTLIST = host.indexOf('craftlist.cz') !== -1;
    if (!IS_CZECH && !IS_CRAFTLIST) return;
    var SITE = IS_CZECH ? 'czech' : 'craftlist';
    console.log('[Majncraft] site =', SITE);

    var params = new URLSearchParams(window.location.search);
    var isManual = params.get('manual') === '1';

    /* ---- tab closure helper ---- */
    var closed = false;
    function tryClose() {
        if (closed) return;
        closed = true;
        try { window.close(); } catch (e) {}
        setTimeout(function () {
            if (window.closed) return;
            try { window.open('', '_self', ''); window.close(); } catch (e) {}
        }, 400);
    }
    function tryCloseAfter(ms) {
        setTimeout(tryClose, ms || 1200);
    }

    /* ---- report to opener ---- */
    function report(payload) {
        payload.__majncraft = 1;
        var n = 0;
        (function attempt() {
            n++;
            var ok = false;
            try { ok = !!(window.opener && !window.opener.closed); } catch (e) {}
            if (!ok) { if (n < 8) setTimeout(attempt, 500); return; }
            try {
                window.opener.postMessage(payload, '*');
                console.log('[Majncraft] reported:', JSON.stringify(payload));
            } catch (e) { if (n < 8) setTimeout(attempt, 500); }
        })();
    }

    /* ---- nickname ---- */
    var urlNick = params.get('user') || params.get('nickname');
    if (urlNick) { try { sessionStorage.setItem('mjNick', urlNick); } catch (e) {} }
    var nickname = urlNick;
    if (!nickname) { try { nickname = sessionStorage.getItem('mjNick'); } catch (e) {} }

    /* ---- time helpers ---- */
    function formatClock(ts) {
        var d = new Date(ts);
        var h = d.getHours();
        var m = d.getMinutes();
        return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
    }

    function clockToFutureTime(clockStr) {
        var p = clockStr.split(':').map(Number);
        var d = new Date();
        d.setHours(p[0], p[1], p[2] || 0, 0);
        if (d.getTime() <= Date.now() - 15 * 60 * 1000) {
            d.setDate(d.getDate() + 1);
        }
        return d.getTime();
    }

    /* ---- Cooldown detector ---- */
    function detectCD() {
        /* 1. Craftlist Live Countdown Timer spans (#voteHours, #voteMinutes, #voteSeconds) */
        var hEl = document.getElementById('voteHours');
        var mEl = document.getElementById('voteMinutes');
        var sEl = document.getElementById('voteSeconds');
        if (hEl && mEl && sEl) {
            var hrs = parseInt(hEl.textContent.trim(), 10);
            var mins = parseInt(mEl.textContent.trim(), 10);
            var secs = parseInt(sEl.textContent.trim(), 10);
            if (!isNaN(hrs) && !isNaN(mins)) {
                var totalMs = (hrs * 3600 + mins * 60 + (isNaN(secs) ? 0 : secs)) * 1000;
                if (totalMs > 0) {
                    var targetUntil = Date.now() + totalMs;
                    var rawClock = formatClock(targetUntil);
                    console.log('[Majncraft] CD via voteHours spans: ' + hrs + 'h ' + mins + 'm (target ' + rawClock + ')');
                    return { until: targetUntil, raw: rawClock };
                }
            }
        }

        /* 2. Ban / Restriction Alert */
        var banEl = document.querySelector('.alert.alert-danger, .alert-custom');
        if (banEl) {
            var banTxt = banEl.textContent || '';
            var mBan = banTxt.match(/(?:vyprší|ban|znemožněno)[^\d\n]{1,50}?(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
            if (mBan) {
                var dObj = new Date(
                    parseInt(mBan[3], 10),
                    parseInt(mBan[2], 10) - 1,
                    parseInt(mBan[1], 10),
                    parseInt(mBan[4], 10),
                    parseInt(mBan[5], 10),
                    parseInt(mBan[6] || '0', 10)
                );
                if (dObj.getTime() > Date.now()) {
                    var bRaw = mBan[1] + '.' + mBan[2] + '.' + mBan[3] + ' ' + mBan[4] + ':' + mBan[5];
                    console.log('[Majncraft] CD via Ban Alert:', bRaw);
                    return { until: dObj.getTime(), raw: bRaw };
                }
            }
        }

        /* 3. Text parser */
        function checkText(txt) {
            if (!txt) return null;

            // 3a. DURATION: "za HH:MM:SS" or "za HH:MM"
            var mDurClock = txt.match(/(?:za|zbývá|zbývající\s+čas)[^\d\n]{0,30}?(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
            if (mDurClock) {
                var dH = parseInt(mDurClock[1], 10);
                var dM = parseInt(mDurClock[2], 10);
                var dS = mDurClock[3] ? parseInt(mDurClock[3], 10) : 0;
                var durMs = (dH * 3600 + dM * 60 + dS) * 1000;
                if (durMs > 0) {
                    var u = Date.now() + durMs;
                    return { until: u, raw: formatClock(u) };
                }
            }

            // 3b. DURATION: "za X hodin a Y minut" / "za X minut"
            var mRelWords = txt.match(/(?:za|zbývá|zbývající\s+čas)[^\d\n]{0,30}?(?:(\d+)\s*(?:hodin[yu]?|hod|h|hours?))?\s*(?:a\s*)?(?:(\d+)\s*(?:minut[y]?|min|m|minutes?))?\s*(?:a\s*)?(?:(\d+)\s*(?:sekund[y]?|sek|s|seconds?))?/i);
            if (mRelWords && (mRelWords[1] || mRelWords[2] || mRelWords[3])) {
                var wh = parseInt(mRelWords[1] || '0', 10);
                var wm = parseInt(mRelWords[2] || '0', 10);
                var ws = parseInt(mRelWords[3] || '0', 10);
                var wMs = (wh * 3600 + wm * 60 + ws) * 1000;
                if (wMs > 0) {
                    var wUntil = Date.now() + wMs;
                    return { until: wUntil, raw: formatClock(wUntil) };
                }
            }

            // 3c. CLOCK TIME: "v HH:MM" or "ve HH:MM" (explicit future target time)
            var mClockTarget = txt.match(/(?:znovu|další\s+hlas|nejdříve|až|bude\s+možné|odeslat|poslat|hlasovat)[^\d\n]{1,40}?(?:v|ve)\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
            if (mClockTarget) {
                var clkTarget = clockToFutureTime(mClockTarget[1]);
                if (clkTarget > Date.now()) return { raw: mClockTarget[1], until: clkTarget };
            }

            // 3d. czech-craft format: "nejdříve v HH:MM(:SS)"
            var mCC = txt.match(/nejdříve\s+v\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
            if (mCC) return { raw: mCC[1], until: clockToFutureTime(mCC[1]) };

            // 3e. Past vote time: "Již jsi hlasoval v 14:30" (add 2h cooldown)
            var mPast = txt.match(/(?:již|už)\s+(?:j?si|jste|byl|hráč)\s+hlasoval[^\d\n]{1,30}?(?:v|ve)\s*(\d{1,2}:\d{2}(?::\d{2})?)/i);
            if (mPast) {
                var p = mPast[1].split(':').map(Number);
                var votedAt = new Date();
                votedAt.setHours(p[0], p[1], p[2] || 0, 0);
                var futureNext = votedAt.getTime() + 2 * 60 * 60 * 1000;
                if (futureNext > Date.now()) return { raw: formatClock(futureNext), until: futureNext };
            }
            return null;
        }

        var msgSelectors = [
            '#frm-voteForm-_submit_message',
            '#test123_message',
            '#frm-voteForm-nickName_message',
            '#_message',
            '#_message_1',
            '.alert',
            '.modal-body',
            '.modal-content'
        ];

        for (var i = 0; i < msgSelectors.length; i++) {
            var els = document.querySelectorAll(msgSelectors[i]);
            for (var j = 0; j < els.length; j++) {
                var res = checkText(els[j].textContent || '');
                if (res) return res;
            }
        }

        var fullBody = (document.body ? (document.body.innerText + '\n' + document.body.textContent) : '');
        return checkText(fullBody);
    }

    /* ---- helpers ---- */
    function waitFor(sel, cb, ms, max) {
        ms = ms || 400; max = max || 60;
        var n = 0;
        var t = setInterval(function () {
            var el = document.querySelector(sel);
            if (el) { clearInterval(t); cb(el); return; }
            if (++n >= max) { clearInterval(t); }
        }, ms);
    }
    function setVal(el, v) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    function recaptchaDone() {
        var ta = document.getElementById('g-recaptcha-response');
        return ta && ta.value && ta.value.trim() !== '';
    }
    function focusCaptcha() {
        var f = document.querySelector('iframe[title="reCAPTCHA"], iframe[src*="recaptcha/api2/anchor"]');
        if (f) try { f.focus(); } catch (e) {}
    }

    /* ---- actions ---- */
    var acted = false;

    function chainNow() {
        if (acted) return;
        if (!canAct()) { setTimeout(chainNow, 300); return; }
        acted = true;
        var url = 'https://craftlist.cz/majncraft-cz?nickname=' + encodeURIComponent(nickname || '');
        console.log('[Majncraft] NAVIGATING to craftlist:', url);
        window.location.href = url;
    }

    function onCooldown(cd) {
        if (acted) return;
        if (typeof cdTimer !== 'undefined') clearInterval(cdTimer);
        console.log('[Majncraft] cooldown on', SITE, '→', cd.raw);
        report({ type: 'cooldown', site: SITE, until: cd.until, raw: cd.raw });
        if (isManual) { acted = true; return; }
        if (IS_CZECH) {
            chainNow();
        } else {
            acted = true;
            tryCloseAfter(1500);
        }
    }

    /* ---- main execution ---- */
    var submittedKey = 'majncraft_submitted_' + SITE;
    var justSubmitted = false;
    try {
        justSubmitted = sessionStorage.getItem(submittedKey) === '1';
        if (justSubmitted) sessionStorage.removeItem(submittedKey);
    } catch (e) {}

    if (!nickname) { console.log('[Majncraft] NO NICKNAME — aborting'); return; }

    /* 1. Page reloaded after submit */
    if (justSubmitted) {
        var postCd = detectCD();
        var until = postCd ? postCd.until : (Date.now() + 2 * 60 * 60 * 1000);
        var rawTime = postCd ? postCd.raw : formatClock(until);
        report({ type: 'cooldown', site: SITE, until: until, raw: rawTime });
        if (isManual) { acted = true; return; }
        if (IS_CZECH) {
            chainNow();
        } else {
            acted = true;
            tryCloseAfter(1500);
        }
        return;
    }

    /* 2. GATEKEEPER: Check CD first on page load. If on CD, exit immediately */
    var cd = detectCD();
    if (cd) {
        console.log('[Majncraft] CD found immediately on page load — aborting form actions');
        onCooldown(cd);
        return;
    }

    /* 3. CD polling — background watcher */
    var cdPoll = 0;
    var cdPollMax = 40;
    var cdTimer = setInterval(function () {
        var c = detectCD();
        if (c) { clearInterval(cdTimer); onCooldown(c); return; }
        if (++cdPoll >= cdPollMax) clearInterval(cdTimer);
    }, 500);

    /* 4. Not on CD: proceed with form */
    if (IS_CZECH) {
        waitFor('#username', function (el) { setVal(el, nickname); });
        waitFor('#privacy', function (el) {
            if (!el.checked) {
                el.checked = true;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    } else {
        var modalBtn = document.querySelector('[data-target*="vote"], [data-toggle="modal"][href*="vote"], a[href="#voteModal"], .btn-vote:not(.disabled)');
        if (modalBtn) { try { modalBtn.click(); } catch (e) {} }

        waitFor('#frm-voteForm-nickName', function (el) {
            setVal(el, nickname);
            try {
                if (window.$) window.$(el).val(nickname).trigger('input').trigger('change').trigger('blur');
            } catch (e) {}
        });
        waitFor('#test123', function (el) {
            setVal(el, nickname);
            try {
                if (window.$) window.$(el).val(nickname).trigger('input').trigger('change').trigger('blur');
            } catch (e) {}
        });

        setTimeout(function () {
            try { if (typeof check === 'function') { check(); } } catch (e) {}
        }, 800);
    }

    /* 5. Focus reCAPTCHA */
    waitFor('iframe[title="reCAPTCHA"]', function () {
        focusCaptcha();
        setTimeout(focusCaptcha, 800);
        setTimeout(focusCaptcha, 1600);
    });

    /* 6. Wait for captcha -> submit -> record cooldown */
    var capTimer = setInterval(function () {
        if (!recaptchaDone()) { focusCaptcha(); return; }
        clearInterval(capTimer);

        if (IS_CZECH) {
            waitFor('button.button', function (btn) {
                try { sessionStorage.setItem(submittedKey, '1'); } catch (e) {}
                btn.click();
                setTimeout(function () {
                    if (acted) return;
                    chainNow();
                }, 4000);
            });
        } else {
            var btns = document.querySelectorAll('button.ajax.btn.btn-primary');
            for (var i = 0; i < btns.length; i++) {
                if (btns[i].textContent.indexOf('Hlasovat za server') !== -1) {
                    try { sessionStorage.setItem(submittedKey, '1'); } catch (e) {}
                    btns[i].click();
                    break;
                }
            }

            var postTries = 0;
            var pollPostVote = setInterval(function () {
                var c = detectCD();
                if (c) {
                    clearInterval(pollPostVote);
                    if (typeof cdTimer !== 'undefined') clearInterval(cdTimer);
                    onCooldown(c);
                    return;
                }
                if (++postTries > 15) {
                    clearInterval(pollPostVote);
                    if (typeof cdTimer !== 'undefined') clearInterval(cdTimer);
                    if (acted) return;
                    var defaultUntil = Date.now() + 2 * 60 * 60 * 1000;
                    var defaultRaw = formatClock(defaultUntil);
                    report({ type: 'cooldown', site: 'craftlist', until: defaultUntil, raw: defaultRaw });
                    acted = true;
                    if (!isManual) tryCloseAfter(1500);
                }
            }, 400);
        }
    }, 800);

    /* 7. Watchdog */
    setTimeout(function () {
        if (acted) return;
        var lastCD = detectCD();
        if (lastCD) { onCooldown(lastCD); return; }
        if (isManual) return;
        if (IS_CZECH) chainNow();
        else tryCloseAfter(1000);
    }, 90000);

})();`;

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
