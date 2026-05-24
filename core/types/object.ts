
export type ObjID = string;

// ObjectMetadata represents the metadata associated with an object
// TODO: Allow flexible properties
export interface ObjFrontmatter {
    id: ObjID;
    name: string;
    metafields?: Record<string, any>;
}

export interface Obj extends ObjFrontmatter {
    body: string;
}