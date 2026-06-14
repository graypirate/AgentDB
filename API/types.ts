import type { StoredBlock, BlockID } from "../core/types/block";
import type { ObjID, ObjMetadata } from "../core/types/object";

export type Block = StoredBlock;

export interface ObjectBlock extends Block {
    children: ObjectBlock[];
}

export interface Obj extends ObjMetadata {
    blocks: ObjectBlock[];
}

export type BlockWrite = Omit<Block, "id"> & {
    id?: BlockID;
};

export type ObjectBlockWrite = Omit<ObjectBlock, "id" | "children"> & {
    id?: BlockID;
    children: ObjectBlockWrite[];
};

export type ObjectWrite = Omit<Obj, "id" | "blocks"> & {
    id?: ObjID;
    blocks: ObjectBlockWrite[];
};
