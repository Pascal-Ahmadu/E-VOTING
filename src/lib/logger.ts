type Level = "info" | "warn" | "error";

interface LogPayload {
  msg: string;
  [key: string]: unknown;
}

function emit(level: Level, payload: LogPayload): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...payload,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (msg: string, fields: Record<string, unknown> = {}): void =>
    emit("info", { msg, ...fields }),
  warn: (msg: string, fields: Record<string, unknown> = {}): void =>
    emit("warn", { msg, ...fields }),
  error: (msg: string, fields: Record<string, unknown> = {}): void =>
    emit("error", { msg, ...fields }),
};
