import { randomUUID } from "node:crypto";

export const ObjectPrefix: string = "o";
export const BlockPrefix: string = "b";
export const DatabasePrefix: string = "d";

// HELPER: Creates a unique ID with the given prefix
function createID(prefix: string): string {
    const random = randomUUID().replaceAll("-", "");
    return `${prefix}_${random}`;
}

export function createObjID(): string {
    return createID(ObjectPrefix);
}

export function createBlockID(): string {
    return createID(BlockPrefix);
}

export function createDatabaseID(): string {
    return createID(DatabasePrefix);
}
