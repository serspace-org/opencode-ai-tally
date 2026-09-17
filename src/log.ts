import { appendFileSync } from "node:fs"

const logPath = process.env.TALLY_DEBUG_LOG ?? "/tmp/opencode-ai-tally.log"

function printable(value: unknown) {
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function tallyLog(...values: unknown[]) {
  try {
    appendFileSync(logPath, `${new Date().toISOString()} ${values.map(printable).join(" ")}\n`)
  } catch {
    // Diagnostics must never affect OpenCode or its UI.
  }
}
