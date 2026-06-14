import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import {
    deleteStoredBlock,
    deleteStoredBlocks,
    deleteBlockPlacement,
    deleteBlockPlacements,
    getStoredBlock,
    getBlockMetadata,
    getBlockPlacements,
    insertStoredBlock,
    insertStoredBlocks,
    insertBlockPlacement,
    insertBlockPlacements,
    isStoredBlock,
    syncBlockPlacements,
    updateStoredBlock,
    updateStoredBlocks,
    updateBlockPlacement,
    updateBlockPlacements,
} from "../../core/db/blocks";
import { getDatabaseMetadata, initDatabase } from "../../core/db/init";

let db: Database | undefined;

afterEach(() => {
    db?.close();
    db = undefined;
});

test("canonical blocks support independent and orphan CRUD", () => {
    db = initDatabase(":memory:");

    insertStoredBlock(db, block("b_one", "One", { kind: "text" }));
    insertStoredBlocks(db, [
        block("b_two", "Two"),
        block("b_three", "Three"),
    ]);

    expect(getBlockMetadata(db, "b_one")).toEqual({
        id: "b_one",
        properties: { kind: "text" },
    });
    expect(getStoredBlock(db, "b_one")).toEqual({
        id: "b_one",
        content: "One",
        properties: { kind: "text" },
    });

    updateStoredBlock(db, block("b_one", "One updated"));
    updateStoredBlocks(db, [
        block("b_two", "Two updated"),
        block("b_three", "Three updated"),
    ]);

    expect(getStoredBlock(db, "b_one").content).toBe("One updated");
    expect(getStoredBlock(db, "b_two").content).toBe("Two updated");
    expect(deleteStoredBlocks(db, ["b_two", "b_three"])).toBe(2);
    expect(deleteStoredBlock(db, "b_one")).toBe(true);
    expect(deleteStoredBlock(db, "b_one")).toBe(false);
    expect(isStoredBlock(db, "b_two")).toBe(false);
});

test("one canonical block can have different placements in multiple objects", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_first");
    createObject(db, "o_second");
    insertStoredBlocks(db, [
        block("b_shared", "Shared"),
        block("b_parent", "Parent"),
        block("b_other", "Other"),
    ]);

    insertBlockPlacements(db, "o_first", [
        placement("b_shared", undefined, 1),
        placement("b_parent", undefined, 0),
    ]);
    insertBlockPlacements(db, "o_second", [
        placement("b_shared", "b_other", 0),
        placement("b_other", undefined, 0),
    ]);

    expect(getBlockPlacements(db, "o_first").map(compactPlacement)).toEqual([
        { id: "b_parent", parentBlockID: undefined, position: 0 },
        { id: "b_shared", parentBlockID: undefined, position: 1 },
    ]);
    expect(getBlockPlacements(db, "o_second").map(compactPlacement)).toEqual([
        { id: "b_other", parentBlockID: undefined, position: 0 },
        { id: "b_shared", parentBlockID: "b_other", position: 0 },
    ]);

    updateStoredBlock(db, block("b_shared", "Shared globally"));
    expect(getBlockPlacements(db, "o_first").find((item) => item.id === "b_shared")?.content).toBe("Shared globally");
    expect(getBlockPlacements(db, "o_second").find((item) => item.id === "b_shared")?.content).toBe("Shared globally");
});

test("placement batches accept unordered trees and atomic sibling swaps", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_tree");
    insertStoredBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_grandchild", "Grandchild"),
        block("b_sibling", "Sibling"),
    ]);

    insertBlockPlacements(db, "o_tree", [
        placement("b_grandchild", "b_child", 0),
        placement("b_sibling", undefined, 1),
        placement("b_child", "b_parent", 0),
        placement("b_parent", undefined, 0),
    ]);
    expect(getBlockPlacements(db, "o_tree").map((item) => item.id)).toEqual([
        "b_parent",
        "b_child",
        "b_grandchild",
        "b_sibling",
    ]);

    updateBlockPlacements(db, "o_tree", [
        placement("b_parent", undefined, 1),
        placement("b_sibling", undefined, 0),
    ]);
    updateBlockPlacement(db, "o_tree", "b_child", "b_sibling", 0);

    expect(getBlockPlacements(db, "o_tree").map(compactPlacement)).toEqual([
        { id: "b_sibling", parentBlockID: undefined, position: 0 },
        { id: "b_child", parentBlockID: "b_sibling", position: 0 },
        { id: "b_grandchild", parentBlockID: "b_child", position: 0 },
        { id: "b_parent", parentBlockID: undefined, position: 1 },
    ]);
});

test("placement updates vacate positions above high desired targets", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_high_update");
    insertStoredBlocks(db, [
        block("b_first", "First"),
        block("b_second", "Second"),
    ]);
    insertBlockPlacements(db, "o_high_update", [
        placement("b_first", undefined, 0),
        placement("b_second", undefined, 1),
    ]);

    updateBlockPlacements(db, "o_high_update", [
        placement("b_first", undefined, 3),
        placement("b_second", undefined, 2),
    ]);

    expect(getBlockPlacements(db, "o_high_update").map(compactPlacement)).toEqual([
        { id: "b_second", parentBlockID: undefined, position: 2 },
        { id: "b_first", parentBlockID: undefined, position: 3 },
    ]);
});

test("deleting a placement subtree preserves every canonical block", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_placement");
    insertStoredBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_keep", "Keep"),
    ]);
    insertBlockPlacements(db, "o_delete_placement", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_keep", undefined, 1),
    ]);

    expect(deleteBlockPlacement(db, "o_delete_placement", "b_parent")).toBe(true);
    expect(getBlockPlacements(db, "o_delete_placement").map((item) => item.id)).toEqual(["b_keep"]);
    expect(isStoredBlock(db, "b_parent")).toBe(true);
    expect(isStoredBlock(db, "b_child")).toBe(true);

    expect(deleteBlockPlacements(db, "o_delete_placement", ["b_keep"])).toBe(1);
    expect(isStoredBlock(db, "b_keep")).toBe(true);
});

test("placement deletion counts requested roots instead of cascaded descendants", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_counts");
    insertStoredBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_grandchild", "Grandchild"),
    ]);
    insertBlockPlacements(db, "o_delete_counts", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_grandchild", "b_child", 0),
    ]);

    expect(deleteBlockPlacements(db, "o_delete_counts", ["b_parent", "b_child", "b_missing"])).toBe(2);
    expect(getBlockPlacements(db, "o_delete_counts")).toEqual([]);
});

test("deleting a canonical block cascades placements and descendant placements only", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_cascade");
    createObject(db, "o_cascade_second");
    insertStoredBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
        block("b_shared", "Shared"),
    ]);
    insertBlockPlacements(db, "o_cascade", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
        placement("b_shared", undefined, 1),
    ]);
    insertBlockPlacements(db, "o_cascade_second", [
        placement("b_parent", undefined, 0),
        placement("b_shared", undefined, 1),
    ]);

    expect(deleteStoredBlock(db, "b_parent")).toBe(true);
    expect(getBlockPlacements(db, "o_cascade").map((item) => item.id)).toEqual(["b_shared"]);
    expect(getBlockPlacements(db, "o_cascade_second").map((item) => item.id)).toEqual(["b_shared"]);
    expect(isStoredBlock(db, "b_child")).toBe(true);
    expect(isStoredBlock(db, "b_shared")).toBe(true);
});

test("canonical block deletion counts matched IDs instead of cascaded placements", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_block_delete_counts");
    insertStoredBlocks(db, [
        block("b_parent", "Parent"),
        block("b_child", "Child"),
    ]);
    insertBlockPlacements(db, "o_block_delete_counts", [
        placement("b_parent", undefined, 0),
        placement("b_child", "b_parent", 0),
    ]);

    expect(deleteStoredBlocks(db, ["b_parent", "b_missing"])).toBe(1);
    expect(isStoredBlock(db, "b_child")).toBe(true);
    expect(getBlockPlacements(db, "o_block_delete_counts")).toEqual([]);
});

test("deleting an object removes placements but preserves canonical blocks", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_delete_object");
    insertStoredBlock(db, block("b_preserved", "Preserved"));
    insertBlockPlacement(db, "o_delete_object", "b_preserved", undefined, 0);

    db.query("DELETE FROM objects WHERE id = $id").run({ $id: "o_delete_object" });

    expect(isStoredBlock(db, "b_preserved")).toBe(true);
    expect(db.query("SELECT 1 FROM object_blocks WHERE block_id = $id").get({ $id: "b_preserved" })).toBeNull();
});

test("placement validation rejects missing entities, duplicates, positions, and cycles", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_validation");
    createObject(db, "o_other");
    insertStoredBlocks(db, [
        block("b_one", "One"),
        block("b_two", "Two"),
        block("b_three", "Three"),
    ]);

    expect(() => insertBlockPlacement(db!, "o_missing", "b_one", undefined, 0)).toThrow("Object not found");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_missing", undefined, 0)).toThrow("Block not found");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_one", "b_missing", 0)).toThrow("Parent block");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_one", "b_one", 0)).toThrow("cannot parent itself");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_one", undefined, -1)).toThrow("Invalid block position");

    insertBlockPlacement(db, "o_validation", "b_one", undefined, 0);
    insertBlockPlacement(db, "o_other", "b_three", undefined, 0);
    expect(() => insertBlockPlacement(db!, "o_validation", "b_one", undefined, 1)).toThrow("already placed");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_two", undefined, 0)).toThrow("occupied");
    expect(() => insertBlockPlacement(db!, "o_validation", "b_two", "b_three", 0)).toThrow("Parent block");

    insertBlockPlacements(db, "o_validation", [
        placement("b_two", "b_one", 0),
        placement("b_three", "b_two", 0),
    ]);
    expect(() => updateBlockPlacement(db!, "o_validation", "b_one", "b_three", 0)).toThrow("cycle");

    expect(() => updateBlockPlacements(db!, "o_validation", [
        placement("b_one", undefined, 2),
        placement("b_missing", undefined, 3),
    ])).toThrow("not placed");
    expect(getBlockPlacements(db, "o_validation").find((item) => item.id === "b_one")?.position).toBe(0);
});

test("syncBlockPlacements reconciles placements without deleting omitted blocks", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_sync");

    syncBlockPlacements(db, "o_sync", [
        objectBlock("b_parent", "Parent", undefined, 0),
        objectBlock("b_child", "Child", "b_parent", 0),
        objectBlock("b_omit", "Omit", undefined, 1),
    ]);
    syncBlockPlacements(db, "o_sync", [
        objectBlock("b_child", "Child updated", undefined, 0),
        objectBlock("b_new", "New", "b_child", 0),
    ]);

    expect(getBlockPlacements(db, "o_sync").map(compactPlacement)).toEqual([
        { id: "b_child", parentBlockID: undefined, position: 0 },
        { id: "b_new", parentBlockID: "b_child", position: 0 },
    ]);
    expect(getStoredBlock(db, "b_child").content).toBe("Child updated");
    expect(isStoredBlock(db, "b_parent")).toBe(true);
    expect(isStoredBlock(db, "b_omit")).toBe(true);
});

test("syncBlockPlacements vacates positions above high desired targets", () => {
    db = initDatabase(":memory:");
    createObject(db, "o_high_sync");

    syncBlockPlacements(db, "o_high_sync", [
        objectBlock("b_first", "First", undefined, 0),
        objectBlock("b_second", "Second", undefined, 1),
    ]);
    syncBlockPlacements(db, "o_high_sync", [
        objectBlock("b_first", "First", undefined, 3),
        objectBlock("b_second", "Second", undefined, 2),
    ]);

    expect(getBlockPlacements(db, "o_high_sync").map(compactPlacement)).toEqual([
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
