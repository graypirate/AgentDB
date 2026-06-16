# Database Schema

One SQLite database file represents one database. The database contains one
metadata row and separate tables for objects, blocks, and object-block placements.

Objects retain a required database parent.

Blocks are independent canonical content. The `object_blocks` table defines
which blocks appear in an object, along with their object-specific nesting and
ordering.

IDs are stable primary keys:

- `d_` for databases
- `o_` for objects
- `b_` for blocks

## Database

```sql
CREATE TABLE "database" (
    id TEXT PRIMARY KEY,
    name TEXT,
    schema_version TEXT NOT NULL
);
```

The table contains exactly one row. The name is optional.
New databases use schema version `0.1.0`. Initialization rejects databases whose
metadata declares another version; migrations are not currently supported.

## Objects

```sql
CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(properties))
);

CREATE INDEX objects_parent_id_idx
ON objects(parent_id);
```

`parent_id` must resolve to the database. Object content is compiled from
placements in `object_blocks`.

## Blocks

```sql
CREATE TABLE blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(properties))
);
```

Blocks have no intrinsic owner, parent, or position. They may exist without an
object and may be referenced by multiple objects.

## Object Blocks

```sql
CREATE TABLE object_blocks (
    object_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    parent_block_id TEXT,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (object_id, block_id),
    CHECK (parent_block_id IS NULL OR parent_block_id <> block_id),
    FOREIGN KEY (object_id)
        REFERENCES objects(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id)
        REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (object_id, parent_block_id)
        REFERENCES object_blocks(object_id, block_id) ON DELETE CASCADE
);
```

A block may appear once in a given object and may appear in any number of
different objects. `parent_block_id` is absent for top-level placements and
otherwise identifies a block placed in the same object.

Separate partial unique indexes enforce sibling positions for top-level and
nested placements. Deleting an object removes only its placements. Deleting a
block removes its placements and their placement descendants, without deleting
other canonical blocks.

## Lookup Behavior

Direct entity lookup uses primary-key indexes:

```sql
SELECT * FROM objects WHERE id = ?;
SELECT * FROM blocks WHERE id = ?;
```

Containment children use parent indexes:

```sql
SELECT * FROM objects WHERE parent_id = ?;
```

Complete object block trees join `object_blocks` to `blocks` and use a
recursive CTE to return object-specific placements in depth-first preorder.
