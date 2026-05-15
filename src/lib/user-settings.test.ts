import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapUserSettingsRow,
  normalizeUserSettings,
  toUserSettingsUpsert,
} from "./user-settings.ts";

describe("user-settings", () => {
  it("keeps the selected accent color when loading and saving database settings", () => {
    const settings = mapUserSettingsRow({
      theme_mode: "system",
      density_mode: "comfortable",
      accent_color: "teal",
      reduced_motion: false,
      show_animations: true,
      notify_aprovacao: true,
      notify_devolucao: true,
      notify_homologacao: true,
      notify_email: true,
      profile_visibility: "campus",
      show_email: true,
      show_avatar: true,
    });

    assert.equal(settings.accentColor, "teal");
    assert.equal(toUserSettingsUpsert("user-1", settings).accent_color, "teal");
  });

  it("falls back to the institutional accent for invalid values", () => {
    assert.equal(normalizeUserSettings({ accentColor: "purple" as any }).accentColor, "upe");
  });
});
