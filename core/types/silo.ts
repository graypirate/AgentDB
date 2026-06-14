import type { DatabaseID } from "./database";
import type { StoredObject } from "./object";

export type SiloID = string;

// Represents a Silo with an ID, name, and optional properties
export interface SiloMetadata {
    readonly id: SiloID;
    parentID: DatabaseID | SiloID;
    name: string;
    properties?: Record<string, unknown>;
}

export interface Silo {
    frontmatter: SiloMetadata;
    objects: StoredObject[];
    silos: Silo[];
}
