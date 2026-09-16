# OpenCode AI Tally plugin prototype

Standalone prototype OpenCode server plugin that reports completed assistant
message usage to [AI Tally](https://ai-tally.com/docs). It does not modify
OpenCode core or place AI Tally in the provider request path.

## Install and configure

This repository targets OpenCode plugin loading. Install it in the OpenCode
runtime using the plugin mechanism supported by the target OpenCode release,
then configure the plugin entry point as follows:

```jsonc
{
  "plugin": [
    ["@serspace/opencode-ai-tally", { "featureTag": "opencode-session" }]
  ]
}
```

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
