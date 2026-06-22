import type { Block, BlockID } from "./block";
import type { Obj, ObjID } from "./object";
import type { WorkspaceID } from "./workspace";

export type EntityType = "object" | "block";
export type EntityID = ObjID | BlockID;
export type Entity = Obj | Block;

export interface EntityReference {
    readonly type: EntityType;
    readonly id: EntityID;
}

export type EntityParentID = WorkspaceID | EntityID | null;
