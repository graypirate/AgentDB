# AgentDB

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.11. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Object Type Boundary

The original `Block`, `Obj`, and `ObjectBlock` types represented SQLite storage
data. They were renamed to `StoredBlock`, `StoredObject`, and `BlockPlacement`
so the API can use the generic names for its client-facing model. Flat
placements remain internal because they map directly to SQLite.
