/**
 * Structured logger for server-side code.
 * Outputs JSON in production for log aggregators; readable coloured text in dev.
 */

type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: Level;
  msg: string;
  [key: string]: unknown;
}

const IS_PROD = process.env.NODE_ENV === "production";

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };

  if (IS_PROD) {
    // Structured JSON for log aggregators (e.g. Datadog, CloudWatch)
    const out = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      process.stderr.write(out + "\n");
    } else {
      process.stdout.write(out + "\n");
    }
    return;
  }

  // Dev: coloured, readable
  const colors: Record<Level, string> = {
    debug: "\x1b[34m", // blue
    info:  "\x1b[32m", // green
    warn:  "\x1b[33m", // yellow
    error: "\x1b[31m", // red
  };
  const reset = "\x1b[0m";
  const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
  const metaStr = meta && Object.keys(meta).length
    ? " " + JSON.stringify(meta)
    : "";
  console.log(`${entry.ts} ${prefix} ${msg}${metaStr}`);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => write("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => write("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};
