import type { Plugin } from "@opencode-ai/plugin"
import { TallyClient } from "./client"
import { spanFromEvent } from "./event"

type Options = {
  featureTag?: unknown
  endpoint?: unknown
  flushIntervalMs?: unknown
}

function optionString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function optionNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

const debug = process.env.TALLY_DEBUG === "1"

const server: Plugin = async (_input, options = {}) => {
  const config = options as Options
  const client = new TallyClient({
    key: process.env.TALLY_KEY,
    endpoint: optionString(config.endpoint),
    flushIntervalMs: optionNumber(config.flushIntervalMs),
    debug,
  })
  const featureTag = optionString(config.featureTag) ?? "opencode-session"

  if (debug) console.info("[ai-tally] plugin initialized")
  if (!process.env.TALLY_KEY) console.info("[ai-tally] TALLY_KEY is not set; usage reporting is disabled")

  return {
    event: async ({ event }) => {
      if (debug && typeof event === "object" && event !== null && "type" in event) {
        console.info("[ai-tally] observed event", event.type)
      }
      const span = spanFromEvent(event, featureTag)
      if (span) {
        if (debug) console.info("[ai-tally] queueing completed assistant usage")
        client.record(span)
      }
    },
    dispose: async () => client.dispose(),
  }
}

export default {
  id: "serspace-opencode-ai-tally",
  server,
}
