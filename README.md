<p align="center" width="100%">
<img width="120" alt="AgentDB logo" src="./icon.png">
</p>

<h1 align="center">AgentDB</h1>

<p align="center">Highly flexible object-oriented relational storage, built for LLM agents.</p>

**AgentDB** organizes structured data and content in ordered trees that agents can access through a local command-line interface, or additional MCP package (preferred). Each workspace contains Objects and Blocks. Objects are named containers that define structure; Blocks hold content or records. Both can carry custom properties and contain other Objects or Blocks, allowing the same model to represent documents, datasets, tables, tasks, and other structured information.

## Requirements

AgentDB requires [Bun](https://bun.sh/) 1.3 or newer.

```bash
bun --version
```

## Installation

*You must install either command globally for normal use outside the source repository.*

1. Download or clone the latest release of **AgentDB**
2. Open terminal to the downloaded `AgentDB` folder
3. Install both Core and MCP packages globally:
```bash
bun add --global ./core ./mcp
```
4. Verify both are available:
```bash
agentdb --help
agentdb-mcp --help
```

Installation does not create a workspace or mutate your home directory. Create the first workspace by [initializing](#initialization); AgentDB then creates the managed storage directory at `~/.agentdb` when needed:

### Individual Installation

- **[Core Package + CLI](./core/README.md#global-installation)**
- **[MCP](./mcp/README.md#global-installation)**

## Initialization
Unless you are querying workspaces directly, the user **does not** have to initialize before using with an LLM client. On creation/initialization of the first workspace, the managed workspace storage directory is created at `~/.agentdb`.

See [CLI commands](./core/README.md#cli) for initialization.


## MCP Configuration

Add the MCP to your LLM client after [installation](#installation).

### Generic Client

Every stdio MCP client needs the same command and no arguments:

```json
{
  "mcpServers": {
    "agentdb": {
      "command": "agentdb-mcp",
      "args": []
    }
  }
}
```

Some clients use `mcp_servers` instead of `mcpServers`, but the launch contract
is unchanged. If a desktop client does not inherit your shell `PATH`, run
`command -v agentdb-mcp` and use the returned absolute path as `command`.

### Codex

```bash
codex mcp add agentdb -- agentdb-mcp
codex mcp list
```

### OpenClaw

```bash
openclaw mcp add agentdb --command agentdb-mcp
openclaw mcp doctor agentdb --probe
```

### Hermes

Add the server to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  agentdb:
    command: agentdb-mcp
    args: []
```

Restart Hermes so it discovers the server and registers its tools.

Upgrade or remove the optional adapter independently:

```bash
bun update --global agentdb-mcp
bun remove --global agentdb-mcp
```

## CLI Commands

The `agentdb` CLI ships with the Core package. See commands, behavior, examples, and workspace rules in the [Core documentation](./core/README.md#cli).
  
## Storage and API Boundary

While workspaces are stored in SQLite, clients **always** pass workspace names, **never** SQLite paths. Managed workspaces live at `~/.agentdb/<name>.sqlite`. **Do not** query or modify those files directly.

The public TypeScript API is exported by `agentdb`. MCP depends only on that public package contract. SQLite storage types and containment tables remain internal implementation details.

## Development Installation

This repository is a Bun workspace containing two packages:

- `core/` publishes `agentdb` and provides the `agentdb` CLI.
- `mcp/` publishes `agentdb-mcp` and depends on the local Core workspace.

### Isolated Package Development

Use workspace filters when you only want Bun to install or run one package:

```bash
bun install --filter agentdb
bun install --filter agentdb-mcp

bun --filter agentdb test
bun --filter agentdb-mcp test
```

Targeting `agentdb-mcp` also includes its local `agentdb` dependency. This is package-isolated installation within the workspace, not a separate dependency universe: both packages still use the repository's root lockfile and workspace links.

Running plain `bun install` from `core/` or `mcp/` is not an isolated install. Bun discovers the parent workspace and installs the entire workspace, just as if the command had been run from the repository root. Use `--filter` when you intend to target one development package.

For complete isolation from the workspace, test a packed package in a temporary directory. Normal development should use either the full workspace install or a workspace filter.
