# OTNworld Grok plugins

Public Grok CLI plugin marketplace for OTNworld.

## Add the marketplace

```bash
grok plugin marketplace add BotOTNworld/grok-plugins
```

Public install source: `BotOTNworld/grok-plugins`. The org copy `OTNworld/grok-plugins` is private.

## Install a plugin

```bash
grok plugin install grok-build-worker --trust
```

`--trust` is required for the plugin’s MCP server and skills to activate. It runs a **local** stdio MCP that can spawn `grok` on this machine. Read [SECURITY.md](SECURITY.md) before trusting it.

Refresh / list:

```bash
grok plugin marketplace list
grok plugin marketplace update
grok plugin list
grok plugin details grok-build-worker
```

## Plugins

| Name | Version | Description |
|------|---------|-------------|
| `grok-build-worker` | 1.1.1 | Local stdio MCP for async one-shot build/review/plan jobs |

See [`plugins/grok-build-worker/README.md`](plugins/grok-build-worker/README.md) for MCP `npm ci` and skill notes.

## Layout

```text
.grok-plugin/marketplace.json
plugins/grok-build-worker/
  plugin.json
  .mcp.json
  README.md
  mcp/          # stdio server source (run npm ci here)
  skills/
```

## Cursor marketplace

Packaging the same plugin for the **Cursor** marketplace is a separate later path. This repository is the Grok CLI marketplace source (`grok plugin marketplace add`).

## Validate locally

```bash
grok plugin validate ./plugins/grok-build-worker
cd plugins/grok-build-worker/mcp && npm ci && npm test
```

## License

MIT — see [LICENSE](LICENSE).
