import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
    createBlock,
    createObject,
    deleteObject,
    initializeDatabase,
    listBlock,
    listDatabase,
    listObject,
    openDatabase,
    readBlock,
    readDatabase,
    readObject,
    search,
    writeBlock,
    writeObject,
} from "../../API";
import type { ObjectWrite } from "../../API";

let db: Database | undefined;
let tempDirectory: string | undefined;

afterEach(() => {
    db?.close();
    db = undefined;
    if (tempDirectory) {
        rmSync(tempDirectory, { recursive: true, force: true });
        tempDirectory = undefined;
    }
});

test("initializes and opens an existing database", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "agentdb-api-"));
    const path = join(tempDirectory, "workspace.sqlite");
    const missing = join(tempDirectory, "missing.sqlite");

    expect(() => openDatabase(missing)).toThrow();
    expect(existsSync(missing)).toBe(false);

    db = initializeDatabase(path, "Workspace");
    const metadata = readDatabase(db);
    expect(metadata.name).toBe("Workspace");
    db.close();

    db = openDatabase(path);
    expect(readDatabase(db)).toEqual(metadata);
});

test("quick create functions generate IDs and return public domain types", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const object = createObject(db, databaseID, "AgentDB", { active: true });
    const block = createBlock(db, "Standalone", { kind: "text" });

    expect(object).toEqual({
        id: expect.stringMatching(/^o_/),
        parentID: databaseID,
        name: "AgentDB",
        properties: { active: true },
        blocks: [],
    });
    expect(block).toEqual({
        id: expect.stringMatching(/^b_/),
        content: "Standalone",
        properties: { kind: "text" },
    });
    expect(readObject(db, object.id)).toEqual(object);
    expect(readBlock(db, block.id)).toEqual(block);
});

test("writeBlock creates without an ID and updates with an ID", () => {
    db = initializeDatabase(":memory:");

    const created = writeBlock(db, {
        content: "Created",
        properties: { version: 1 },
    });
    const updated = writeBlock(db, {
        id: created.id,
        content: "Updated",
        properties: {},
    });

    expect(created.id).toStartWith("b_");
    expect(updated).toEqual({
        id: created.id,
        content: "Updated",
        properties: {},
    });
    expect(readBlock(db, created.id)).toEqual(updated);
});

test("writeObject creates and returns a complete recursive object", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;

    const object = writeObject(db, {
        parentID: databaseID,
        name: "Tree",
        properties: { status: "active" },
        blocks: [{
            content: "Parent",
            properties: {},
            children: [{
                content: "Child",
                properties: { level: 1 },
                children: [{
                    content: "Grandchild",
                    properties: {},
                    children: [],
                }],
            }],
        }, {
            content: "Second",
            properties: {},
            children: [],
        }],
    });

    expect(object.id).toStartWith("o_");
    expect(object.blocks).toHaveLength(2);
    expect(object.blocks.map((block) => block.content)).toEqual(["Parent", "Second"]);
    expect(object.blocks[0]?.children[0]?.content).toBe("Child");
    expect(object.blocks[0]?.children[0]?.children[0]?.content).toBe("Grandchild");
    expect(object.blocks[0]?.id).toStartWith("b_");
    expect(object.blocks[0]?.children[0]?.id).toStartWith("b_");
    expect(readObject(db, object.id)).toEqual(object);
});

test("readObject output can be written back without changing its shape", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const created = writeObject(db, {
        parentID: databaseID,
        name: "Round trip",
        properties: { version: 1 },
        blocks: [{
            content: "First",
            properties: {},
            children: [{
                content: "Nested",
                properties: { depth: 1 },
                children: [],
            }],
        }, {
            content: "Second",
            properties: {},
            children: [],
        }],
    });

    expect(writeObject(db, created)).toEqual(created);
    expect(readObject(db, created.id)).toEqual(created);
});

test("writeObject completely replaces placements and globally updates reused blocks", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const shared = createBlock(db, "Shared");
    const first = writeObject(db, objectWrite(databaseID, "First", shared.id));
    const second = writeObject(db, objectWrite(databaseID, "Second", shared.id));
    const omitted = first.blocks[0]!.children[0]!;

    const replaced = writeObject(db, {
        id: first.id,
        parentID: databaseID,
        name: "First updated",
        properties: {},
        blocks: [{
            id: shared.id,
            content: "Shared globally updated",
            properties: {},
            children: [],
        }],
    });

    expect(replaced.blocks.map((block) => block.id)).toEqual([shared.id]);
    expect(readObject(db, second.id).blocks[0]?.content).toBe("Shared globally updated");
    expect(readBlock(db, omitted.id).content).toBe("First child");
});

test("entity-specific list functions return metadata and direct IDs", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const object = writeObject(db, {
        parentID: databaseID,
        name: "Object",
        properties: {},
        blocks: [{
            content: "Parent",
            properties: {},
            children: [{
                content: "Child",
                properties: {},
                children: [],
            }],
        }],
    });
    const parent = object.blocks[0]!;
    const child = parent.children[0]!;

    expect(listDatabase(db)).toEqual({
        metadata: readDatabase(db),
        objects: [object.id],
    });
    expect(listObject(db, object.id)).toEqual({
        metadata: {
            id: object.id,
            parentID: databaseID,
            name: "Object",
            properties: {},
        },
        blocks: [parent.id],
    });
    expect(listBlock(db, child.id, object.id)).toEqual({
        metadata: {
            id: child.id,
            properties: {},
        },
        objectID: object.id,
        ancestors: [parent.id],
        children: [],
    });
});

test("object deletion preserves canonical blocks", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const object = writeObject(db, {
        parentID: databaseID,
        name: "Nested",
        properties: {},
        blocks: [{
            content: "Preserved",
            properties: {},
            children: [],
        }],
    });
    const blockID = object.blocks[0]!.id;

    expect(deleteObject(db, object.id)).toBe(true);
    expect(() => readObject(db!, object.id)).toThrow();
    expect(readBlock(db, blockID).content).toBe("Preserved");
});

test("search supports an optional entity type parameter", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const object = createObject(db, databaseID, "Needle object");
    const block = createBlock(db, "Needle block");

    expect(search(db, "needle").map((result) => result.id)).toEqual([
        block.id,
        object.id,
    ]);
    expect(search(db, "needle", "block")).toEqual([{
        type: "block",
        id: block.id,
        label: "Needle block",
    }]);
});

test("writeObject rejects missing and duplicate existing blocks", () => {
    db = initializeDatabase(":memory:");
    const databaseID = readDatabase(db).id;
    const existing = createBlock(db, "Existing");

    expect(() => writeObject(db!, {
        parentID: databaseID,
        name: "Missing",
        properties: {},
        blocks: [{
            id: "b_missing",
            content: "Missing",
            properties: {},
            children: [],
        }],
    })).toThrow("Block not found");

    expect(() => writeObject(db!, {
        parentID: databaseID,
        name: "Duplicate",
        properties: {},
        blocks: [{
            id: existing.id,
            content: "First",
            properties: {},
            children: [],
        }, {
            id: existing.id,
            content: "Second",
            properties: {},
            children: [],
        }],
    })).toThrow("Duplicate block ID");
});

function objectWrite(parentID: string, name: string, sharedBlockID: string): ObjectWrite {
    return {
        parentID,
        name,
        properties: {},
        blocks: [{
            id: sharedBlockID,
            content: "Shared",
            properties: {},
            children: [{
                content: `${name} child`,
                properties: {},
                children: [],
            }],
        }],
    };
}
