// Contains filesystem operations for manipulating directories for use as Silos

import type { SiloFrontmatter, Silo, SiloID } from "../../types/silo"

/**
 * Creates a new silo with the given name and optional metafields.
 * @param name - The name of the silo to create
 * @param metafields - Optional metafields to associate with the silo
 * @returns The ID of the newly created silo
*/
function createSilo(name: string, metafields?: Record<string, any>): SiloID {
    return "";
}

/**
 * Reads the silo at the specified path and returns its shape.
 * @param path The path to the silo to read
 * @returns The SiloShape
 */
function readSiloShape(path: string): Silo {
    throw new Error("TODO");
}

/**
 * Reads the Silo (name+metafields) at the specified path.
 * This function does not read the silo's shape.
 * 
 * @param path The path to the silo to read
 * @returns The SiloFrontmatter at the path
 */
function readSiloFrontmatter(path: string): SiloFrontmatter {
    throw new Error("TODO");
}

/**
 * Writes the given metafields to the silo at the specified path.
 * @param metafields The metafields to write to the silo
 */
function writeSilo(metafields: Record<string, any>): void {}

/**
 * Deletes the silo at the specified path.
 * WARNING: This operation deletes all nested Silo Objects and Silos
 * @param path The silo path to delete
 * @returns True if the silo was successfully deleted
 */
function deleteSilo(path: string): boolean {
    return false;
}