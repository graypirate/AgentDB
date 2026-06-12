import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import {
    deleteBlock,
    deleteBlocks,
    deleteObjectBlock,
    deleteObjectBlocks,
    getBlock,
    getBlockMetadata,
    getObjectBlocks,
    insertBlock,
    insertBlocks,
    insertObjectBlock,
    insertObjectBlocks,
    isBlock,
    syncObjectBlocks,
    updateBlock,
    updateBlocks,
    updateObjectBlock,
    updateObjectBlocks,
} from "../../core/db/blocks";
import { getDatabaseMetadata, initDatabase } from "../../core/db/init";

let db: Database | undefined;

afterEach(() => {
    db?.close();
    db = undefined;
});

test("canonical blocks support independent and orphan CRUD", () => {
    db = initDatabase(":memory:");

    insertBlock(db, block("b_one", "One", { kind: "text" }));
    insertBlocks(db, [
        block("b_two", "Two"),
        block("b_three", "Three"),
    ]);

    expect(getBlockMetadata(db, "b_one")).toEqual({
        id: "b_one",
        properties: { kind: "text" },
    });
    expect(getBlock(db, "b_one")).toEqual({
        id: "b_one",
        content: "One",
        properties: { kind: "text" },
    });

    updateBlock(db, block("b_one", "One updated"));
    updateBlocks(db, [
        block("b_two", "Two updated"),
        block("b_three", "Three updated"),
    ]);

    expect(getBlock(db, "b_one").content).toBe("One updated");
    expect(getBlock(db, "b_two").content).toBe("Two updated");
    expect(deleteBlocks(db, ["b_two", "b_three"])).toBe(2);
    expect(deleteBlock(db, "b_one")).toBe(true);
    expect(deleteBlock(db, "b_one")).toBe(false);
    expect(isBlock(db, "b_two")).toBe(false);
});

test("one canonical block can have different placements in multiple objects", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_first");
    createObject(db, "o_second");
    insertBlocks(db, [
        block("b_shared", "Shared"),
        block("b_parent", "Parent"),
        block("b_other", "Other"),
    ]);

    insertObjectBlocks(db, "o_first", [
        placement("b_shared", undefined, 1),
        placement("b_parent", undefined, 0),
    ]);
    insertObjectBlocks(db, "o_second", [
        placement("b_shared", "b_other", 0),
        placement("b_other", undefined, 0),
    ]);

    expect(getObjectBlocks(db, "o_first").map(compactPlacement)).toEqual([
        { id: "b_parent", parentBlockID: undefined, position: 0 },
        { id: "b_shared", parentBlockID: undefined, position: 1 },
    ]);
    expect(getObjectBlocks(db, "o_second").map(compactPlacement)).toEqual([
        { id: "b_other", parentBlockID: undefined, position: 0 },
        { id: "b_shared", parentBlockID: "b_other", position: 0 },
    ]);

    updateBlock(db, block("b_shared", "Shared globally"));
    expect(getObjectBlocks(db, "o_first").find((item) => item.id === "b_shared")?.content).toBe("Shared globally");
    expect(getObjectBlocks(db, "o_second").find((item) => item.id === "b_shared")?.content).toBe("Shared globally");
});

test("placement batches accept unordered trees and atomic sibling swaps", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_tree");
    insertBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_grandchild", "Grandchild"),
        block("b_sibling", "Sibling"),
    ]);

    insertObjectBlocks(db, "o_tree", [
        placement("b_grandchild", "b_child", 0),
        placement("b_sibling", undefined, 1),
        placement("b_child", "b_parent", 0),
        placement("b_parent", undefined, 0),
    ]);
    expect(getObjectBlocks(db, "o_tree").map((item) => item.id)).toEqual([
        "b_parent",
        "b_child",
        "b_grandchild",
        "b_sibling",
    ]);

    updateObjectBlocks(db, "o_tree", [
        placement("b_parent", undefined, 1),
        placement("b_sibling", undefined, 0),
    ]);
    updateObjectBlock(db, "o_tree", "b_child", "b_sibling", 0);

    expect(getObjectBlocks(db, "o_tree").map(compactPlacement)).toEqual([
        { id: "b_sibling", parentBlockID: undefined, position: 0 },
        { id: "b_child", parentBlockID: "b_sibling", position: 0 },
        { id: "b_grandchild", parentBlockID: "b_child", position: 0 },
        { id: "b_parent", parentBlockID: undefined, position: 1 },
    ]);
});

test("placement updates vacate positions above high desired targets", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_high_update");
    insertBlocks(db, [
        block("b_first", "First"),
        block("b_second", "Second"),
    ]);
    insertObjectBlocks(db, "o_high_update", [
        placement("b_first", undefined, 0),
        placement("b_second", undefined, 1),
    ]);

    updateObjectBlocks(db, "o_high_update", [
        placement("b_first", undefined, 3),
        placement("b_second", undefined, 2),
    ]);

    expect(getObjectBlocks(db, "o_high_update").map(compactPlacement)).toEqual([
        { id: "b_second", parentBlockID: undefined, position: 2 },
        { id: "b_first", parentBlockID: undefined, position: 3 },
    ]);
});

test("deleting a placement subtree preserves every canonical block", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_placement");
    insertBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_keep", "Keep"),
    ]);
    insertObjectBlocks(db, "o_delete_placement", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_keep", undefined, 1),
    ]);

    expect(deleteObjectBlock(db, "o_delete_placement", "b_parent")).toBe(true);
    expect(getObjectBlocks(db, "o_delete_placement").map((item) => item.id)).toEqual(["b_keep"]);
    expect(isBlock(db, "b_parent")).toBe(true);
    expect(isBlock(db, "b_child")).toBe(true);

    expect(deleteObjectBlocks(db, "o_delete_placement", ["b_keep"])).toBe(1);
    expect(isBlock(db, "b_keep")).toBe(true);
});

test("placement deletion counts requested roots instead of cascaded descendants", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_counts");
    insertBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_grandchild", "Grandchild"),
    ]);
    insertObjectBlocks(db, "o_delete_counts", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_grandchild", "b_child", 0),
    ]);

    expect(deleteObjectBlocks(db, "o_delete_counts", ["b_parent", "b_child", "b_missing"])).toBe(2);
    expect(getObjectBlocks(db, "o_delete_counts")).toEqual([]);
});

test("deleting a canonical block cascades placements and descendant placements only", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_cascade");
    createObject(db, "o_cascade_second");
    insertBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_shared", "Shared"),
    ]);
    insertObjectBlocks(db, "o_cascade", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_shared", undefined, 1),
    ]);
    insertObjectBlocks(db, "o_cascade_second", [
        placement("b_parent", undefined, 0),
        placement("b_shared", undefined, 1),
    ]);

    expect(deleteBlock(db, "b_parent")).toBe(true);
    expect(getObjectBlocks(db, "o_cascade").map((item) => item.id)).toEqual(["b_shared"]);
    expect(getObjectBlocks(db, "o_cascade_second").map((item) => item.id)).toEqual(["b_shared"]);
    expect(isBlock(db, "b_child")).toBe(true);
    expect(isBlock(db, "b_shared")).toBe(true);
});

test("canonical block deletion counts matched IDs instead of cascaded placements", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_block_delete_counts");
    insertBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
    ]);
    insertObjectBlocks(db, "o_block_delete_counts", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
    ]);

    expect(deleteBlocks(db, ["b_parent", "b_missing"])).toBe(1);
    expect(isBlock(db, "b_child")).toBe(true);
    expect(getObjectBlocks(db, "o_block_delete_counts")).toEqual([]);
});

test("deleting an object removes placements but preserves canonical blocks", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_object");
    insertBlock(db, block("b_preserved", "Preserved"));
    insertObjectBlock(db, "o_delete_object", "b_preserved", undefined, 0);

    db.query("DELETE FROM objects WHERE id = $id").run({ $id: "o_delete_object" });

    expect(isBlock(db, "b_preserved")).toBe(true);
    expect(db.query("SELECT 1 FROM object_blocks WHERE block_id = $id").get({ $id: "b_preserved" })).toBeNull();
});

test("placement validation rejects missing entities, duplicates, positions, and cycles", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_validation");
    createObject(db, "o_other");
    insertBlocks(db, [
        block("b_one", "One"),
        block("b_two", "Two"),
        block("b_three", "Three"),
    ]);

    expect(() => insertObjectBlock(db!, "o_missing", "b_one", undefined, 0)).toThrow("Object not found");
    expect(() => insertObjectBlock(db!, "o_validation", "b_missing", undefined, 0)).toThrow("Block not found");
    expect(() => insertObjectBlock(db!, "o_validation", "b_one", "b_missing", 0)).toThrow("Parent block");
    expect(() => insertObjectBlock(db!, "o_validation", "b_one", "b_one", 0)).toThrow("cannot parent itself");
    expect(() => insertObjectBlock(db!, "o_validation", "b_one", undefined, -1)).toThrow("Invalid block position");

    insertObjectBlock(db, "o_validation", "b_one", undefined, 0);
    insertObjectBlock(db, "o_other", "b_three", undefined, 0);
    expect(() => insertObjectBlock(db!, "o_validation", "b_one", undefined, 1)).toThrow("already placed");
    expect(() => insertObjectBlock(db!, "o_validation", "b_two", undefined, 0)).toThrow("occupied");
    expect(() => insertObjectBlock(db!, "o_validation", "b_two", "b_three", 0)).toThrow("Parent block");

    insertObjectBlocks(db, "o_validation", [
        placement("b_two", "b_one", 0),
        placement("b_three", "b_two", 0),
    ]);
    expect(() => updateObjectBlock(db!, "o_validation", "b_one", "b_three", 0)).toThrow("cycle");

    expect(() => updateObjectBlocks(db!, "o_validation", [
        placement("b_one", undefined, 2),
        placement("b_missing", undefined, 3),
    ])).toThrow("not placed");
    expect(getObjectBlocks(db, "o_validation").find((item) => item.id === "b_one")?.position).toBe(0);
});

test("syncObjectBlocks reconciles placements without deleting omitted blocks", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_sync");

    syncObjectBlocks(db, "o_sync", [
        objectBlock("b_parent", "Parent", undefined, 0),
        objectBlock("b_child", "Child", "b_parent", 0),
        objectBlock("b_omit", "Omit", undefined, 1),
    ]);
    syncObjectBlocks(db, "o_sync", [
        objectBlock("b_child", "Child updated", undefined, 0),
        objectBlock("b_new", "New", "b_child", 0),
    ]);

    expect(getObjectBlocks(db, "o_sync").map(compactPlacement)).toEqual([
        { id: "b_child", parentBlockID: undefined, position: 0 },
        { id: "b_new", parentBlockID: "b_child", position: 0 },
    ]);
    expect(getBlock(db, "b_child").content).toBe("Child updated");
    expect(isBlock(db, "b_parent")).toBe(true);
    expect(isBlock(db, "b_omit")).toBe(true);
});

test("syncObjectBlocks vacates positions above high desired targets", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_high_sync");

    syncObjectBlocks(db, "o_high_sync", [
        objectBlock("b_first", "First", undefined, 0),
        objectBlock("b_second", "Second", undefined, 1),
    ]);
    syncObjectBlocks(db, "o_high_sync", [
        objectBlock("b_first", "First", undefined, 3),
        objectBlock("b_second", "Second", undefined, 2),
    ]);

    expect(getObjectBlocks(db, "o_high_sync").map(compactPlacement)).toEqual([
        { id: "b_second", parentBlockID: undefined, position: 2 },
        { id: "b_first", parentBlockID: undefined, position: 3 },
    ]);
});

function createObject(database: Database, id: string): void {
    const databaseID = getDatabaseMetadata(database).id;
    database.query(`
        INSERT INTO objects (id, parent_id, name, properties)
        VALUES ($id, $parentID, $name, '{}')
    `).run({
        $id: id,
        $parentID: databaseID,
        $name: id,
    });
}

function block(id: string, content: string, properties?: Record<string, unknown>) {
    return { id, content, properties };
}

function placement(id: string, parentBlockID: string | undefined, position: number) {
    return { id, parentBlockID, position };
}

function objectBlock(id: string, content: string, parentBlockID: string | undefined, position: number) {
    return { id, content, parentBlockID, position };
}

function compactPlacement(blockValue: { id: string; parentBlockID?: string; position: number }) {
    return {
        id: blockValue.id,
        parentBlockID: blockValue.parentBlockID,
        position: blockValue.position,
    };
}
