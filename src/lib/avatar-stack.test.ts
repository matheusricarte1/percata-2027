import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAvatarInitials,
  prepareAvatarStackMembers,
} from "./avatar-stack";

describe("avatar-stack", () => {
  it("builds readable initials from names and emails", () => {
    assert.equal(getAvatarInitials("Maria Ricarte de Souza"), "MS");
    assert.equal(getAvatarInitials("planejamento@upe.br"), "PL");
    assert.equal(getAvatarInitials(""), "US");
  });

  it("deduplicates members and computes overflow from the real total", () => {
    const stack = prepareAvatarStackMembers(
      [
        { id: "1", name: "Ana Souza", avatarUrl: null },
        { id: "1", name: "Ana Souza", avatarUrl: "https://example.com/ana.png" },
        { id: "2", name: "Bruno Lima", avatarUrl: null },
        { id: "3", name: "Carla Dias", avatarUrl: null },
      ],
      { maxVisible: 2, total: 5 },
    );

    assert.deepEqual(
      stack.visible.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
        initials: member.initials,
      })),
      [
        {
          id: "1",
          name: "Ana Souza",
          avatarUrl: "https://example.com/ana.png",
          initials: "AS",
        },
        {
          id: "2",
          name: "Bruno Lima",
          avatarUrl: null,
          initials: "BL",
        },
      ],
    );
    assert.equal(stack.total, 5);
    assert.equal(stack.overflow, 3);
  });

  it("keeps an empty stack usable for empty states", () => {
    const stack = prepareAvatarStackMembers([], { maxVisible: 4 });

    assert.equal(stack.total, 0);
    assert.equal(stack.overflow, 0);
    assert.deepEqual(stack.visible, []);
  });
});
