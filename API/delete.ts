import type { Database } from "bun:sqlite";

import { deleteStoredBlock } from "../core/db/blocks";
import { deleteStoredObject } from "../core/db/objects";
import type { BlockID } from "../core/types/block";
import type { ObjID } from "../core/types/object";

export function deleteObject(db: Database, objectID: ObjID): boolean {
    return deleteStoredObject(db, objectID);
}

export function deleteBlock(db: Database, blockID: BlockID): boolean {
    return deleteStoredBlock(db, blockID);
}
