// Contains filesystem operations for manipulating Markdown files for use as Objects

import type { Object } from "../../types/object"

function createObject(name: string): Object {
    return Object();
}

function readObject(path: string): Object {
    return Object();
}

function writeObject(path: string, object: Object): void {}

function deleteObject(path: string): void {}