
export type ObjectID = string;

// ObjectMetadata represents the metadata associated with an object
// TODO: Allow flexible properties
export interface ObjectMetadata {
    name: string;
}

export interface Object extends ObjectMetadata {
    id: ObjectID;
    body: string;
}