import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captureCartAnimationOrigin } from "./cart-animation-origin.ts";

describe("captureCartAnimationOrigin", () => {
  it("keeps the button coordinates before an asynchronous event loses currentTarget", () => {
    const origin = captureCartAnimationOrigin({
      getBoundingClientRect: () => ({ left: 12, top: 24, width: 80, height: 32 }),
    });

    assert.deepEqual(origin, { left: 12, top: 24, width: 80, height: 32 });
    assert.equal(captureCartAnimationOrigin(null), null);
  });
});
