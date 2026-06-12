CREATE TABLE IF NOT EXISTS "database" (
    id TEXT PRIMARY KEY,
    name TEXT,
    schema_version INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS database_singleton_insert
BEFORE INSERT ON "database"
WHEN (SELECT COUNT(*) FROM "database") >= 1
BEGIN
    SELECT RAISE(ABORT, 'database metadata already exists');
END;

CREATE TABLE IF NOT EXISTS silos (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(properties))
);

CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(properties))
);

CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    properties TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(properties))
);

CREATE TABLE IF NOT EXISTS object_blocks (
    object_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    parent_block_id TEXT,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (object_id, block_id),
    CHECK (parent_block_id IS NULL OR parent_block_id <> block_id),
    FOREIGN KEY (object_id)
        REFERENCES objects(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (block_id)
        REFERENCES blocks(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (object_id, parent_block_id)
        REFERENCES object_blocks(object_id, block_id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS silos_parent_id_idx
ON silos(parent_id);

CREATE INDEX IF NOT EXISTS objects_parent_id_idx
ON objects(parent_id);

CREATE INDEX IF NOT EXISTS object_blocks_block_id_idx
ON object_blocks(block_id);

CREATE UNIQUE INDEX IF NOT EXISTS object_blocks_root_position_uq
ON object_blocks(object_id, position)
WHERE parent_block_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS object_blocks_child_position_uq
ON object_blocks(object_id, parent_block_id, position)
WHERE parent_block_id IS NOT NULL;
