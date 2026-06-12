import { afterEach, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";

import {
    getBlock,
    getObjectBlocks,
    insertBlock,
    insertBlocks,
    insertObjectBlocks,
    isBlock,
} from "../../core/db/blocks";
import { getDatabaseMetadata, initDatabase } from "../../core/db/init";
import {
    deleteObject,
    getObject,
    getObjectMetadata,
    insertObject,
    isObject,
    updateObject,
    updateObjectMetadata,
} from "../../core/db/objects";
import type { ObjectBlock } from "../../core/types/block";
import type { Obj } from "../../core/types/object";

let db: Database | undefined;

afterEach(() => {
    db?.close();
    db = undefined;
});

test("object operations persist caller IDs under database and silo parents", () => {
    db = initDatabase(":memory:", "Test Database");
    const databaseID = getDatabaseMetadata(db).id;
    const siloID = "s_projects";

    db.query(`
        INSERT INTO silos (id, parent_id, name, properties)
        VALUES ($id, $parentID, $name, '{}')
    `).run({
        $id: siloID,
        $parentID: databaseID,
        $name: "Projects",
    });

    insertObject(db, {
        id: "o_root",
        parentID: databaseID,
        name: "Root Object",
        properties: {
            scope: "database",
        },
    });
    insertObject(db, {
        id: "o_nested",
        parentID: siloID,
        name: "Nested Object",
    });

    expect(getObjectMetadata(db, "o_root")).toEqual({
        id: "o_root",
        parentID: databaseID,
        name: "Root Object",
        properties: {
            scope: "database",
        },
    });
    expect(getObjectMetadata(db, "o_nested").parentID).toBe(siloID);
    expect(isObject(db, "o_root")).toBe(true);
    expect(() => insertObject(db!, {
        id: "o_root",
        parentID: databaseID,
        name: "Duplicate",
    })).toThrow("Object already exists");
    expect(() => insertObject(db!, {
        id: "o_missing_parent",
        parentID: "s_missing",
        name: "Missing Parent",
    })).toThrow("Silo parent not found");

    updateObjectMetadata(db, {
        id: "o_root",
        parentID: siloID,
        name: "Moved Object",
        properties: {
            scope: "silo",
        },
    });
    expect(getObjectMetadata(db, "o_root")).toEqual({
        id: "o_root",
        parentID: siloID,
        name: "Moved Object",
        properties: {
            scope: "silo",
        },
    });
});

test("empty objects compile with no blocks", () => {
    db = initDatabase(":memory:");
    const databaseID = getDatabaseMetadata(db).id;

    insertObject(db, {
        id: "o_empty",
        parentID: databaseID,
        name: "Empty",
    });

    expect(getObject(db, "o_empty")).toEqual({
        id: "o_empty",
        parentID: databaseID,
        name: "Empty",
        properties: {},
        blocks: [],
    });
});

test("getObject compiles nested placements in depth-first preorder", () => {
    db = initDatabase(":memory:");
    const databaseID = getDatabaseMetadata(db).id;

    insertObject(db, {
        id: "o_tree",
        parentID: databaseID,
        name: "Tree",
    });
    insertBlocks(db, [
        block("b_child_two", "Child two"),
        block("b_second", "Second"),
        block("b_grandchild", "Grandchild"),
        block("b_parent", "Parent"),
        block("b_child_one", "Child one"),
    ]);
    insertObjectBlocks(db, "o_tree", [
        placement("b_child_two", "b_parent", 1),
        placement("b_second", undefined, 1),
        placement("b_grandchild", "b_child_one", 0),
        placement("b_parent", undefined, 0),
        placement("b_child_one", "b_parent", 0),
    ]);

    const object = getObject(db, "o_tree");
    expect(object.blocks.map((item) => item.id)).toEqual([
        "b_parent",
        "b_child_one",
        "b_grandchild",
        "b_child_two",
        "b_second",
    ]);
    expect(object.blocks.map((item) => item.parentBlockID)).toEqual([
        undefined,
        "b_parent",
        "b_child_one",
        "b_parent",
        undefined,
    ]);
});

test("updateObject synchronizes placements and globally updates shared blocks", () => {
    db = initDatabase(":memory:");
    const databaseID = getDatabaseMetadata(db).id;

    insertObject(db, {
        id: "o_update",
        parentID: databaseID,
        name: "Original",
    });
    insertObject(db, {
        id: "o_shared",
        parentID: databaseID,
        name: "Shared",
    });
    insertBlocks(db, [
        block("b_keep", "Keep"),
        block("b_remove", "Remove"),
        block("b_remove_child", "Remove child"),
    ]);
    insertObjectBlocks(db, "o_update", [
        placement("b_keep", undefined, 0),
        placement("b_remove", undefined, 1),
        placement("b_remove_child", "b_remove", 0),
    ]);
    insertObjectBlocks(db, "o_shared", [
        placement("b_keep", undefined, 0),
    ]);

    const desired: Obj = {
        id: "o_update",
        parentID: databaseID,
        name: "Updated",
        properties: {
            status: "done",
        },
        blocks: [
            objectBlock("b_new_child", "New child", "b_keep", 0),
            objectBlock("b_new", "New", undefined, 1),
            objectBlock("b_keep", "Keep updated", undefined, 0),
        ],
    };

    updateObject(db, desired);
    const updated = getObject(db, "o_update");
    expect(updated.name).toBe("Updated");
    expect(updated.properties).toEqual({ status: "done" });
    expect(updated.blocks.map((item) => item.id)).toEqual([
        "b_keep",
        "b_new_child",
        "b_new",
    ]);
    expect(updated.blocks[0]?.content).toBe("Keep updated");
    expect(getObject(db, "o_shared").blocks[0]?.content).toBe("Keep updated");
    expect(getBlock(db, "b_remove").content).toBe("Remove");
    expect(getBlock(db, "b_remove_child").content).toBe("Remove child");
    expect(getObjectBlocks(db, "o_update").some((item) => item.id === "b_remove")).toBe(false);
    expect(isBlock(db, "b_new")).toBe(true);

    updateObjectMetadata(db, {
        id: "o_update",
        parentID: databaseID,
        name: "Metadata Only",
    });
    expect(getObject(db, "o_update").blocks).toHaveLength(3);
});

test("deleteObject removes only its placements and preserves canonical blocks", () => {
    db = initDatabase(":memory:");
    const databaseID = getDatabaseMetadata(db).id;

    insertObject(db, { id: "o_one", parentID: databaseID, name: "One" });
    insertObject(db, { id: "o_two", parentID: databaseID, name: "Two" });
    insertBlock(db, block("b_shared", "Shared"));
    insertObjectBlocks(db, "o_one", [placement("b_shared", undefined, 0)]);
    insertObjectBlocks(db, "o_two", [placement("b_shared", undefined, 0)]);

    expect(deleteObject(db, "o_one")).toBe(true);
    expect(deleteObject(db, "o_one")).toBe(false);
    expect(isBlock(db, "b_shared")).toBe(true);
    expect(getObject(db, "o_two").blocks.map((item) => item.id)).toEqual(["b_shared"]);
    expect(db.query(`
        SELECT COUNT(*) AS count
        FROM object_blocks
        WHERE object_id = 'o_one'
    `).get()).toEqual({ count: 0 });
});

function block(id: string, content: string) {
    return { id, content };
}

function placement(id: string, parentBlockID: string | undefined, position: number) {
    return { id, parentBlockID, position };
}

function objectBlock(id: string, content: string, parentBlockID: string | undefined, position: number): ObjectBlock {
    return { id, content, parentBlockID, position };
}
