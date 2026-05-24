// Contains filesystem operations for manipulating Markdown files for use as Objects

import type { ObjFrontmatter, Obj, ObjID } from "../../types/object"

function createObject(name: string): ObjID {
    throw new Error("TODO");
}

function readObjectFrontmatter(path: string): ObjFrontmatter {
    throw new Error("TODO");
}

function readObject(path: string): Obj {
    throw new Error("TODO");
}

function writeObject(path: string, object: Obj): void {
    throw new Error("TODO");
}

function deleteObject(path: string): void {
    throw new Error("TODO");
}