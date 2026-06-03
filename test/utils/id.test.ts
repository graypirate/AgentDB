import { expect, test } from "bun:test";

import { BlockPrefix, createBlockID } from "../../core/utils/id";

test("createBlockID creates b-prefixed block ids", () => {
    const id = createBlockID();

    expect(id.startsWith(`${BlockPrefix}_`)).toBe(true);
});
