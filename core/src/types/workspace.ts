export type WorkspaceID = string;

// Represents the public metadata for an AgentDB workspace.
export interface WorkspaceMetadata {
    readonly id: WorkspaceID;
    name?: string;
    schemaVersion: string;
}
