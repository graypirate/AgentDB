export type BlockID = string;

// Represents a Block with an ID, content, and optional properties
export interface BlockFrontmatter {
    readonly id: BlockID;
    properties?: Record<string, unknown>;
}

export interface Block extends BlockFrontmatter {
    content: string;
}
