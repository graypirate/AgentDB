import type { Database } from "bun:sqlite";

import {
    insertStoredBlock,
    isStoredBlock,
    syncBlockPlacements,
    updateStoredBlock,
} from "../core/db/blocks";
import {
    insertStoredObject,
    isStoredObject,
    updateStoredObject,
} from "../core/db/objects";
import type { StoredBlock, BlockID, BlockPlacement } from "../core/types/block";
import type { ObjID, StoredObject } from "../core/types/object";
import { createBlockID, createObjID } from "../core/utils/id";
import type {
    Block,
    BlockWrite,
    Obj,
    ObjectBlock,
    ObjectBlockWrite,
    ObjectWrite,
} from "./types";

export function writeBlock(db: Database, input: BlockWrite): Block {
    const block: StoredBlock = {
        id: input.id ?? createAvailableBlockID(db),
        content: input.content,
        properties: input.properties ?? {},
    };

    if (input.id === undefined) {
        insertStoredBlock(db, block);
    } else {
        updateStoredBlock(db, block);
    }

    return block;
}

export function writeObject(db: Database, input: ObjectWrite): Obj {
    const objectID = input.id ?? createAvailableObjectID(db);
    const { blocks, placements } = prepareBlocks(db, input.blocks);
    const storedObject: StoredObject = {
        id: objectID,
        parentID: input.parentID,
        name: input.name,
        properties: input.properties ?? {},
        blocks: placements,
    };

    const write = db.transaction(() => {
        if (input.id === undefined) {
            insertStoredObject(db, storedObject);
            syncBlockPlacements(db, objectID, placements);
        } else {
            updateStoredObject(db, storedObject);
        }
    });

    write();
    return {
        id: objectID,
        parentID: input.parentID,
        name: input.name,
        properties: input.properties ?? {},
        blocks,
    };
}

/** Assigns IDs while producing public blocks and stored flat placements. */
function prepareBlocks(
    db: Database,
    roots: ObjectBlockWrite[],
): { blocks: ObjectBlock[]; placements: BlockPlacement[] } {
    const placements: BlockPlacement[] = [];
    const usedIDs = new Set<BlockID>();

    const visit = (
        children: ObjectBlockWrite[],
        parentBlockID?: BlockID,
    ): ObjectBlock[] =>
        children.map((input, position) => {
            const id = input.id ?? createAvailableBlockID(db, usedIDs);
            if (usedIDs.has(id)) {
                throw new Error(`Duplicate block ID in object: ${id}`);
            }
            if (input.id !== undefined && !isStoredBlock(db, id)) {
                throw new Error(`Block not found: ${id}`);
            }

            usedIDs.add(id);
            placements.push({
                id,
                content: input.content,
                properties: input.properties ?? {},
                parentBlockID,
                position,
            });
            return {
                id,
                content: input.content,
                properties: input.properties ?? {},
                children: visit(input.children, id),
            };
        });

    return {
        blocks: visit(roots),
        placements,
    };
}

/** Generates an object ID that is not already stored. */
function createAvailableObjectID(db: Database): ObjID {
    let id = createObjID();
    while (isStoredObject(db, id)) {
        id = createObjID();
    }
    return id;
}

/** Generates a block ID that is neither stored nor reserved by the current write. */
function createAvailableBlockID(db: Database, reserved: Set<BlockID> = new Set()): BlockID {
    let id = createBlockID();
    while (reserved.has(id) || isStoredBlock(db, id)) {
        id = createBlockID();
    }
    return id;
}
