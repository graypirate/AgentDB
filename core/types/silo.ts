import type { Obj } from "../types/object"

export type SiloID = string;

// Represents a Silo with an ID, name, and optional metafields
export interface SiloFrontmatter {
    id: SiloID;
    name: string;
    metafields?: Record<string, any>;
}

export interface Silo {
    frontmatter: SiloFrontmatter;
    objects: Obj[];
    silos: Silo[];
}