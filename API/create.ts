import type { Database } from "bun:sqlite";

import { insertStoredBlock, isStoredBlock } from "../core/db/blocks";
import { insertStoredObject, isStoredObject } from "../core/db/objects";
import type { StoredObject } from "../core/db/types";
import type { Block } from "../core/types/block";
import type { Obj } from "../core/types/object";
import { createBlockID, createObjID } from "../core/utils/id";

type Properties = Record<string, unknown>;

export function createObject(
    db: Database,
    parentID: string,
    name: string,
    properties: Properties = {},
): Obj {
    const object: StoredObject = {
        id: createAvailableID(createObjID, (id) => isStoredObject(db, id)),
        parentID,
        name,
        properties,
        blocks: [],
    };

    insertStoredObject(db, object);
    return {
        ...object,
        blocks: [],
    };
}

export function createBlock(
    db: Database,
    content: string,
    properties: Properties = {},
): Block {
    const block: Block = {
        id: createAvailableID(createBlockID, (id) => isStoredBlock(db, id)),
        content,
        properties,
    };

    insertStoredBlock(db, block);
    return block;
}

/** Generates an entity ID that is not already stored. */
function createAvailableID(createID: () => string, exists: (id: string) => boolean): string {
    let id = createID();
    while (exists(id)) {
        id = createID();
    }
    return id;
}
