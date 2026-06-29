import type { Database } from "bun:sqlite";

import { searchEntities, type SearchResult, type SearchType } from "../src/storage";
export type { SearchResult, SearchType } from "../src/storage";

export function search(
    db: Database,
    query: string,
    type?: SearchType,
): SearchResult[] {
    return searchEntities(db, query, type);
}
