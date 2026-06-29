# AgentDB MCP

Local stdio MCP server for AgentDB. This package is a transport adapter and uses AgentDB exclusively through the public `agentdb` package API.

## Global Installation

This installs the `agentdb-mcp` executable and a compatible AgentDB Core library. [Install AgentDB Core globally](../core/README.md#global-installation) as well when you want its standalone CLI.

```bash
bun add --global agentdb-mcp
```

Verify:
```bash
command -v agentdb-mcp
```

Upgrade or remove the MCP package with Bun:
```bash
bun update --global agentdb-mcp
bun remove --global agentdb-mcp
```

AgentDB MCP uses stdio. The MCP client starts and owns the server process; do not run it as a background daemon.

## Configure a Client

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

The client launches the server over stdio. No daemon is required. For desktop
clients that do not inherit the shell `PATH`, use the absolute path returned by
`command -v agentdb-mcp`.

## Tools

- `agentdb_initialize_workspace`
- `agentdb_list_workspaces`
- `agentdb_read_workspace`
- `agentdb_list_workspace_entities`
- `agentdb_read_entity`
- `agentdb_list_entity_children`
- `agentdb_search_entities`
- `agentdb_create_object`
- `agentdb_create_block`
- `agentdb_write_entity`
- `agentdb_delete_entity`
- `agentdb_delete_workspace`

Each tool accepts one JSON object. The server does not accept CLI arguments,
stdin payloads, file payloads, SQLite paths, or hidden secondary inputs.
