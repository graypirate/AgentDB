export type BlockID = string;

// Represents a Block with an ID, content, and optional properties
export interface BlockMetadata {
    readonly id: BlockID;
    properties?: Record<string, unknown>;
}

export interface Block extends BlockMetadata {
    content: string;
}

// ObjectBlock represents a Block that is part of an Object, with an optional parentBlockID and a position within its parent
export interface ObjectBlock extends Block {
    parentBlockID?: BlockID;
    position: number;
}
