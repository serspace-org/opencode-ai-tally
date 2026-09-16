# OpenCode AI Tally plugin prototype

Standalone prototype OpenCode server plugin that reports completed assistant
message usage to [AI Tally](https://ai-tally.com/docs). It does not modify
OpenCode core or place AI Tally in the provider request path.

## Install and configure

For a local test, use the file plugin form so OpenCode loads the TypeScript
source directly. Add this to the test project's `.opencode/opencode.jsonc`:

```jsonc
{
  "plugin": [
    ["/Users/jtorreggiani/Organizer/work/serspace/workbench/opencode-ai-tally/src/index.ts", {
      "featureTag": "opencode-session"
    }]
  ]
}
```

Replace the absolute path for another checkout. A published package can later
use the package-spec form instead.

Set `TALLY_KEY` in the OpenCode server environment. The plugin is disabled when
the key is absent. Optional plugin options are `featureTag`, `endpoint`, and
`flushIntervalMs`.

## Design

The plugin uses OpenCode's `event` hook and watches `message.updated`. Completed
assistant messages already contain provider, model, token counts, and session
ID. The plugin sends only this normalized metadata asynchronously to AI
Tally's `/v1/batches` endpoint.

It does not send prompts, completions, tool arguments, file paths, emails, or
raw account IDs. It uses a bounded in-memory queue, suppresses duplicate
message IDs, retries failed delivery, and never makes provider execution
depend on AI Tally.

## Prototype gaps

Validate against the exact OpenCode revision that loads this plugin:

* duplicate events and shutdown delivery
* V2 session coverage
* direct model calls such as agent configuration generation
* persistent deduplication and durable outbox requirements
* provider-specific billing metadata such as GitHub Copilot AIU
* model/provider price coverage in AI Tally
