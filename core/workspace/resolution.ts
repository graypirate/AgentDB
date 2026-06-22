import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const WorkspaceDirectoryName = ".agentdb";
const DatabaseExtension = ".sqlite";
const WorkspaceNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class InvalidWorkspaceNameError extends Error {
    override readonly name = "InvalidWorkspaceNameError";
    readonly details = {
        allowed: "letters, numbers, underscores, hyphens, and dots; must not start with a dot",
    };

    constructor(readonly workspaceName: string) {
        super(`Invalid workspace name: ${workspaceName}`);
    }
}

export function initializePackageStorage(): string {
    const directory = workspaceDirectory();
    mkdirSync(directory, { recursive: true });
    return directory;
}

export function validateWorkspaceName(name: string): void {
    if (!WorkspaceNamePattern.test(name)) {
        throw new InvalidWorkspaceNameError(name);
    }
}

export function resolveWorkspaceDatabasePath(name: string): string {
    validateWorkspaceName(name);
    return join(workspaceDirectory(), `${name}${DatabaseExtension}`);
}

export function resolveInitializedWorkspaceDatabasePath(name: string): string {
    validateWorkspaceName(name);
    initializePackageStorage();
    return resolveWorkspaceDatabasePath(name);
}

export function workspaceDirectory(): string {
    return join(process.env.HOME ?? homedir(), WorkspaceDirectoryName);
}
