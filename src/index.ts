import type { Plugin } from "@opencode-ai/plugin"
import { TallyClient } from "./client"
import { spanFromEvent } from "./event"
import { tallyLog } from "./log"

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

  if (debug) tallyLog("[ai-tally] plugin initialized")
  if (!process.env.TALLY_KEY) tallyLog("[ai-tally] TALLY_KEY is not set; usage reporting is disabled")

  return {
    event: async ({ event }) => {
      const span = spanFromEvent(event, featureTag)
      if (span) {
        if (debug) {
          tallyLog(
            "[ai-tally] queueing completed assistant usage",
            JSON.stringify({
              message_id: span.span_id,
              input_tokens: span["gen_ai.usage.input_tokens"] ?? null,
              output_tokens: span["gen_ai.usage.output_tokens"] ?? null,
              cached_input_tokens: span["gen_ai.usage.cached_input_tokens"] ?? null,
            }),
          )
        }
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
