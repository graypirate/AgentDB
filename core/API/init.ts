import type { Database } from "bun:sqlite";

import {
    resolveInitializedWorkspaceDatabasePath,
    resolveWorkspaceDatabasePath,
} from "../src/workspace";
import {
    initializeStorage,
    openStorage,
} from "../src/storage";

export function initializeWorkspace(name: string): Database {
    return initializeStorage(resolveInitializedWorkspaceDatabasePath(name), name);
}

export function openWorkspace(name: string): Database {
    return openStorage(resolveWorkspaceDatabasePath(name));
}
