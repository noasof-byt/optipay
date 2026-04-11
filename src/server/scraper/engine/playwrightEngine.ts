/**
 * Playwright Browser Engine — Stealth Edition
 *
 * Anti-bot bypass strategy:
 *   Modern anti-bot systems (Cloudflare Bot Management, Imperva, DataDome)
 *   detect automation via a combination of signals:
 *
 *   1. navigator.webdriver = true        → patched: set to undefined
 *   2. Missing chrome.runtime / app      → patched: injected as real objects
 *   3. window.chrome absence             → patched: full chrome object added
 *   4. Consistent plugin list            → patched: realistic plugin array
 *   5. navigator.permissions.query leak  → patched: returns "granted" for notifications
 *   6. WebGL "SwiftShader" renderer      → patched: replaced with real GPU string
 *   7. sec-ch-ua mismatch                → fixed: UA + CH headers are consistent
 *   8. headless in User-Agent            → fixed: using non-headless Chrome UA
 *
 *   We use `playwright-extra` + `puppeteer-extra-plugin-stealth` which
 *   automates all of the above patches in a maintained, battle-tested way.
 */

import { chromium as chromiumExtra } from "playwright-extra";
import StealthPlugin                 from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext, Page } from "playwright";
import { logger } from "@/lib/logger";

// Apply the stealth plugin once at module load
// This patches ~15 browser fingerprint vectors automatically
(chromiumExtra as any).use(StealthPlugin());

// ── Configuration ─────────────────────────────────────────────────────────────

const MAX_PAGES           = 3;
const NAVIGATION_TIMEOUT  = 45_000;  // ZAP can be slow to load
const PAGE_TIMEOUT        = 25_000;

// Real Chrome 124 user-agents — must match the sec-ch-ua header below
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

// Matching sec-ch-ua Client Hints for each user-agent above
const SEC_CH_UA = [
  '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  '"Chromium";v="123", "Google Chrome";v="123", "Not-A.Brand";v="99"',
  '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
];

// ── Singleton state ───────────────────────────────────────────────────────────

let browser: Browser | null     = null;
let context: BrowserContext | null = null;
let activePages                 = 0;
let uaIndex                     = 0;

// ── Public API ────────────────────────────────────────────────────────────────

export async function acquirePage(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    await launchBrowser();
  }

  while (activePages >= MAX_PAGES) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const page = await context!.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  page.setDefaultTimeout(PAGE_TIMEOUT);
  activePages++;
  return page;
}

export async function releasePage(page: Page): Promise<void> {
  try { await page.close(); } catch { /* already closed */ }
  finally { activePages = Math.max(0, activePages - 1); }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    activePages = 0;
    logger.info("Playwright browser closed");
  }
}

// ── Internal browser setup ────────────────────────────────────────────────────

async function launchBrowser(): Promise<void> {
  const idx = uaIndex++ % USER_AGENTS.length;
  const ua  = USER_AGENTS[idx];
  const cua = SEC_CH_UA[idx];

  browser = await (chromiumExtra as any).launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--disable-infobars",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      "--ignore-certificate-errors",
      // Randomise screen resolution to avoid static fingerprint
      `--window-size=${1280 + Math.floor(Math.random() * 300)},${800 + Math.floor(Math.random() * 200)}`,
    ],
  });

  context = await browser!.newContext({
    locale:     "he-IL",
    timezoneId: "Asia/Jerusalem",
    userAgent:  ua,
    viewport: {
      width:  1280 + Math.floor(Math.random() * 300),
      height: 800  + Math.floor(Math.random() * 200),
    },
    extraHTTPHeaders: {
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua":          cua,
      "sec-ch-ua-mobile":   "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  // ── Deep stealth patches (run in every new page context) ──────────────────
  // The stealth plugin handles most of this, but we add a few extra patches
  // targeting Israeli CDN configurations specifically.
  await context.addInitScript(() => {
    // 1. Make navigator.webdriver completely absent (not just false)
    try {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
        configurable: true,
      });
    } catch {}

    // 2. Add a convincing window.chrome object that real Chrome has
    if (!(window as any).chrome) {
      (window as any).chrome = {
        app: {
          isInstalled:     false,
          InstallState:    { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
          RunningState:    { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
          getDetails:      () => {},
          getIsInstalled:  () => false,
          runningState:    () => "cannot_run",
        },
        runtime: {
          OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
          OnRestartRequiredReason: { APP_UPDATE: "app_update", GC_PRESSURE: "gc_pressure", OS_UPDATE: "os_update" },
          PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
          PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
          RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
          connect:              (() => {}) as any,
          sendMessage:          (() => {}) as any,
          id:                   undefined,
        },
        csi:          () => {},
        loadTimes:    () => ({}),
      };
    }

    // 3. Realistic plugin list (empty plugins = headless tell)
    Object.defineProperty(navigator, "plugins", {
      get: () => {
        const fakePlugin = (name: string, filename: string, desc: string) => ({
          name, filename, description: desc, length: 1,
        });
        return [
          fakePlugin("Chrome PDF Plugin", "internal-pdf-viewer", "Portable Document Format"),
          fakePlugin("Chrome PDF Viewer",  "mhjfbmdgcfjbbpaeojofohoefgiehjai", ""),
          fakePlugin("Native Client",      "internal-nacl-plugin",            ""),
        ];
      },
      configurable: true,
    });

    // 4. Override Notification.permission to avoid "denied" tell
    const origQuery = (window.navigator.permissions as any)?.query;
    if (origQuery) {
      (window.navigator.permissions as any).query = (params: { name: string }) =>
        params.name === "notifications"
          ? Promise.resolve({ state: Notification.permission, onchange: null })
          : origQuery.call(window.navigator.permissions, params);
    }

    // 5. Hide automation in languages list
    Object.defineProperty(navigator, "languages", {
      get: () => ["he-IL", "he", "en-US", "en"],
      configurable: true,
    });

    // 6. Fake hardware concurrency (headless often reports unusual values)
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => 8,
      configurable: true,
    });
  });

  logger.info("Playwright stealth browser launched", { ua });
}

// ── Navigation helpers ────────────────────────────────────────────────────────

export async function navigateTo(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT });
  } catch (err) {
    logger.warn("First navigation attempt failed, retrying with domcontentloaded", { url, err: String(err) });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT });
  }
}

export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, 400);
        totalHeight += 400;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
  await page.waitForTimeout(1_200);
}

export async function extractTexts(page: Page, selector: string): Promise<string[]> {
  return page.$$eval(selector, (els) =>
    els.map((el) => (el as HTMLElement).innerText?.trim() ?? "").filter((t) => t.length > 0)
  );
}

export async function clickNextPage(page: Page, nextSelector: string): Promise<boolean> {
  const nextBtn = await page.$(nextSelector);
  if (!nextBtn) return false;
  if ((await nextBtn.getAttribute("disabled")) !== null) return false;
  await nextBtn.click();
  await page.waitForLoadState("networkidle").catch(() => page.waitForTimeout(2_000));
  return true;
}
