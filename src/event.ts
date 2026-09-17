export type TallySpan = {
  trace_id: string
  span_id: string
  timestamp_ns: number
  ServiceName: string
  SpanName: string
  "gen_ai.system": string
  "gen_ai.operation.name": "chat"
  "gen_ai.request.model": string
  "gen_ai.response.model": string
  "gen_ai.usage.input_tokens"?: number
  "gen_ai.usage.output_tokens"?: number
  "gen_ai.usage.cached_input_tokens"?: number
  "gen_ai.feature_tag": string
  "gen_ai.session_id": string
  "gen_ai.cost.billing_mode": BillingMode
}

type BillingMode = "api" | "subscription"

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

// Providers whose calls are covered by a seat or plan the user already pays for, rather than
// billed per call against an API key.
//
// Read from the RAW providerID, deliberately before providerName() below folds `opencode` into
// `openai`. After that fold the two are indistinguishable, and that is exactly the confusion this
// field exists to remove: a subscription call relabelled as `openai` gets priced at OpenAI
// pay-as-you-go list rates, asserting a per-call cost the user never incurred.
const SUBSCRIPTION_PROVIDERS = new Set(["opencode", "claude-code"])

function billingMode(providerID: string): BillingMode {
  return SUBSCRIPTION_PROVIDERS.has(providerID) ? "subscription" : "api"
}

function providerName(providerID: string) {
  if (providerID.startsWith("openai") || providerID === "opencode") return "openai"
  if (providerID.startsWith("anthropic")) return "anthropic"
  if (providerID.startsWith("google") || providerID.startsWith("gemini")) return "google"
  return providerID
}

export function spanFromEvent(event: unknown, featureTag: string): TallySpan | undefined {
  if (!isRecord(event) || event.type !== "message.updated" || !isRecord(event.properties)) return
  const info = event.properties.info
  if (!isRecord(info) || info.role !== "assistant") return
  if (!isRecord(info.time) || !finiteNumber(info.time.completed)) return

  const sessionID = stringValue(event.properties.sessionID)
  const messageID = stringValue(info.id)
  const providerID = stringValue(info.providerID)
  const modelID = stringValue(info.modelID)
  if (!sessionID || !messageID || !providerID || !modelID || !isRecord(info.tokens)) return

  const span: TallySpan = {
    trace_id: sessionID,
    span_id: messageID,
    timestamp_ns: info.time.completed * 1_000_000,
    ServiceName: "opencode",
    SpanName: "chat",
    "gen_ai.system": providerName(providerID),
    "gen_ai.operation.name": "chat",
    "gen_ai.request.model": modelID,
    "gen_ai.response.model": modelID,
    "gen_ai.feature_tag": featureTag,
    "gen_ai.session_id": sessionID,
    "gen_ai.cost.billing_mode": billingMode(providerID),
  }

  const input = finiteNumber(info.tokens.input)
  const output = finiteNumber(info.tokens.output)
  const cachedInput = isRecord(info.tokens.cache) ? finiteNumber(info.tokens.cache.read) : undefined
  if (input !== undefined) span["gen_ai.usage.input_tokens"] = input
  if (output !== undefined) span["gen_ai.usage.output_tokens"] = output
  if (cachedInput !== undefined) span["gen_ai.usage.cached_input_tokens"] = cachedInput
  return span
}
