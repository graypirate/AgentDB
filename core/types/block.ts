export type BlockID = string;

// Represents a Block with an ID, content, and optional properties
export interface BlockMetadata {
    readonly id: BlockID;
    properties?: Record<string, unknown>;
}

export interface StoredBlock extends BlockMetadata {
    content: string;
}

// Represents a block's stored placement within an object.
export interface BlockPlacement extends StoredBlock {
    parentBlockID?: BlockID;
    position: number;
}
