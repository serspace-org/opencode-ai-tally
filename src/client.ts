import type { TallySpan } from "./event"

type ClientOptions = {
  key?: string
  endpoint?: string
  flushIntervalMs?: number
  maxQueueSize?: number
}

type BatchResponse = {
  status?: "accepted" | "partial" | "rejected" | "retry"
}

export class TallyClient {
  readonly #key: string | undefined
  readonly #endpoint: string
  readonly #flushIntervalMs: number
  readonly #maxQueueSize: number
  readonly #queue: TallySpan[] = []
  readonly #seen = new Set<string>()
  #timer: ReturnType<typeof setTimeout> | undefined
  #flushing = false

  constructor(options: ClientOptions) {
    this.#key = options.key
    this.#endpoint = (options.endpoint ?? "https://ingest.ai-tally.com").replace(/\/$/, "")
    this.#flushIntervalMs = options.flushIntervalMs ?? 1_000
    this.#maxQueueSize = options.maxQueueSize ?? 10_000
  }

  record(span: TallySpan) {
    if (!this.#key || this.#seen.has(span.span_id)) return
    this.#seen.add(span.span_id)
    this.#queue.push(span)
    if (this.#queue.length > this.#maxQueueSize) this.#queue.shift()
    this.#schedule()
  }

  async flush() {
    if (!this.#key || this.#flushing || this.#queue.length === 0) return
    this.#flushing = true
    const spans = this.#queue.splice(0, 100)
    const batchID = crypto.randomUUID()
    try {
      const response = await fetch(`${this.#endpoint}/v1/batches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenant_id: "",
          batch_id: batchID,
          sdk_version: "opencode-ai-tally-prototype/0.1.0",
          resource_spans: spans,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as BatchResponse
      if (!response.ok || result.status === "retry") {
        this.#queue.unshift(...spans)
        console.warn(`[ai-tally] batch ${batchID} was not accepted (${response.status})`)
      }
    } catch (error) {
      this.#queue.unshift(...spans)
      console.warn("[ai-tally] batch delivery failed; usage will be retried", error)
    } finally {
      this.#flushing = false
      if (this.#queue.length > 0) this.#schedule()
    }
  }

  async dispose() {
    if (this.#timer) clearTimeout(this.#timer)
    await this.flush()
  }

  #schedule() {
    if (this.#timer || this.#flushing) return
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      void this.flush()
    }, this.#flushIntervalMs)
  }
}
