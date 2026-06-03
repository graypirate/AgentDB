import type { Block } from "./block";

export type ObjID = string;

// Represents an Object with an ID, name, and optional properties
export interface ObjFrontmatter {
    readonly id: ObjID;
    name: string;
    properties?: Record<string, unknown>;
}

export interface Obj extends ObjFrontmatter {
    blocks: Block[];
}
