import type { Database } from "bun:sqlite";

import {
    insertStoredBlock,
    syncBlockPlacements,
    updateStoredBlock,
} from "../core/db/blocks";
import {
    insertStoredObject,
    updateStoredObject,
} from "../core/db/objects";
import type { StoredObject } from "../core/db/types";
import type { Block, BlockID, ObjectBlock } from "../core/types/block";
import type { Obj, ObjID } from "../core/types/object";
import { createBlockID, createObjID } from "../core/utils/id";
import { flattenObjectBlocks } from "./types";

export type BlockWrite = Omit<Block, "id"> & {
    id?: BlockID;
};

export type ObjectBlockWrite = Omit<ObjectBlock, "id" | "children"> & {
    id?: BlockID;
    children: ObjectBlockWrite[];
};

export type ObjectWrite = Omit<Obj, "id" | "blocks"> & {
    id?: ObjID;
    blocks: ObjectBlockWrite[];
};

export function writeBlock(db: Database, input: BlockWrite): Block {
    const block: Block = {
        id: input.id ?? createAvailableBlockID(),
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
    const objectID = input.id ?? createAvailableObjectID();
    const { blocks, explicitBlockIDs } = prepareBlocks(input.blocks);
    const placements = flattenObjectBlocks(blocks);
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
            syncBlockPlacements(db, objectID, placements, explicitBlockIDs);
        } else {
            updateStoredObject(db, storedObject, explicitBlockIDs);
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

/** Assigns IDs while producing public object blocks. */
function prepareBlocks(
    roots: ObjectBlockWrite[],
): { blocks: ObjectBlock[]; explicitBlockIDs: Set<BlockID> } {
    const usedIDs = new Set<BlockID>();
    const explicitBlockIDs = new Set<BlockID>();

    const visit = (
        children: ObjectBlockWrite[],
    ): ObjectBlock[] =>
        children.map((input) => {
            const id = input.id ?? createAvailableBlockID(usedIDs);
            if (usedIDs.has(id)) {
                throw new Error(`Duplicate block ID in object: ${id}`);
            }
            if (input.id !== undefined) {
                explicitBlockIDs.add(id);
            }

            usedIDs.add(id);
            return {
                id,
                content: input.content,
                properties: input.properties ?? {},
                children: visit(input.children),
            };
        });

    return {
        blocks: visit(roots),
        explicitBlockIDs,
    };
}

/** Generates an object ID. */
function createAvailableObjectID(): ObjID {
    return createObjID();
}

/** Generates a block ID that is neither stored nor reserved by the current write. */
function createAvailableBlockID(reserved: Set<BlockID> = new Set()): BlockID {
    let id = createBlockID();
    while (reserved.has(id)) {
        id = createBlockID();
    }
    return id;
}
