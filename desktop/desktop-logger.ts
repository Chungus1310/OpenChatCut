import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

let initialized = false;
let logFilePath = '';
let crashFilePath = '';

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function formatArg(a: unknown): string {
  if (a instanceof Error) return a.stack ?? a.message;
  if (typeof a === 'object' && a !== null) {
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }
  return String(a);
}

function writeEntry(file: string, level: string, msg: string): void {
  if (!file) return;
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${msg}\n`;
  try {
    appendFileSync(file, line, 'utf8');
  } catch {
    // Best-effort write without throwing
  }
}

/**
 * Initializes persistent file logging into the application userData/logs directory.
 * Intercepts console logging and process exception hooks in the Electron main process.
 */
export function initDesktopLogger(customUserDataDir?: string): { logFile: string; crashFile: string } {
  if (initialized) return { logFile: logFilePath, crashFile: crashFilePath };

  let targetDir = customUserDataDir;
  if (!targetDir) {
    try {
      const userData = app.getPath('userData');
      if (basename(userData).toLowerCase() === 'electron') {
        const appData = process.env.APPDATA || process.env.HOME || '.';
        targetDir = join(appData, 'openchatcut');
      } else {
        targetDir = userData;
      }
    } catch {
      targetDir = join(process.env.APPDATA || process.env.HOME || '.', 'openchatcut');
    }
  }

  const logsDir = join(targetDir, 'logs');
  try {
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  } catch {
    // Best effort directory creation
  }

  logFilePath = join(logsDir, 'app.log');
  crashFilePath = join(logsDir, 'crash.log');
  initialized = true;

  // Log rotation if file exceeds size threshold
  try {
    if (existsSync(logFilePath) && statSync(logFilePath).size > MAX_LOG_SIZE_BYTES) {
      renameSync(logFilePath, join(logsDir, 'app.old.log'));
    }
  } catch {
    // Best-effort rotation
  }

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    origLog(...args);
    writeEntry(logFilePath, 'INFO', args.map(formatArg).join(' '));
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    writeEntry(logFilePath, 'WARN', args.map(formatArg).join(' '));
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    const text = args.map(formatArg).join(' ');
    writeEntry(logFilePath, 'ERROR', text);
    writeEntry(crashFilePath, 'ERROR', text);
  };

  process.on('uncaughtException', (err) => {
    const stack = err instanceof Error ? err.stack ?? err.message : String(err);
    writeEntry(logFilePath, 'UNCAUGHT_EXCEPTION', stack);
    writeEntry(crashFilePath, 'UNCAUGHT_EXCEPTION', stack);
  });

  process.on('unhandledRejection', (reason) => {
    const stack = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    writeEntry(logFilePath, 'UNHANDLED_REJECTION', stack);
    writeEntry(crashFilePath, 'UNHANDLED_REJECTION', stack);
  });

  const version = typeof app.getVersion === 'function' ? app.getVersion() : '0.2.15';
  writeEntry(
    logFilePath,
    'BOOT',
    `OpenChatCut main process initialized | PID: ${process.pid} | version: ${version} | OS: ${process.platform} ${process.arch}`,
  );

  return { logFile: logFilePath, crashFile: crashFilePath };
}

export function getDesktopLogPaths(): { logFile: string; crashFile: string } {
  return { logFile: logFilePath, crashFile: crashFilePath };
}
