/**
 * Next.js Instrumentation Hook
 *
 * This file is loaded once when the Next.js server starts.
 * It is the correct place to initialise singleton server-side resources
 * like the CRON scheduler.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * IMPORTANT: This file must stay in `src/` (or project root).
 * The `experimental.instrumentationHook` option in next.config.ts is
 * automatically enabled in Next.js 14.2+.
 */

export async function register() {
  // Only run server-side at RUNTIME — not during `next build`.
  // During the build phase, NEXT_PHASE is set to "phase-production-build"
  // and we must not start the cron scheduler (no DB connections allowed).
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    // Dynamic import to prevent the scheduler from being bundled
    // into client or edge chunks
    const { startScheduler } = await import("./server/cron/scheduler");
    startScheduler();
  }
}
