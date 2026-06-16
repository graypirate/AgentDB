import type { ObjectBlock } from "./block";
import type { DatabaseID } from "./database";

export type ObjID = string;

export interface ObjMetadata {
    readonly id: ObjID;
    parentID: DatabaseID;
    name: string;
    properties?: Record<string, unknown>;
}

// Recursive structure
export interface Obj extends ObjMetadata {
    blocks: ObjectBlock[];
}
