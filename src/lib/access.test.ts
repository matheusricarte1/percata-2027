import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as access from "./access.ts";

describe("solicitante workspace access", () => {
  it("allows chefia to use the same request workspace exposed in its navigation", () => {
    const canUseSolicitanteWorkspace = (
      access as typeof access & {
        canUseSolicitanteWorkspace?: (role: string) => boolean;
      }
    ).canUseSolicitanteWorkspace;

    assert.equal(canUseSolicitanteWorkspace?.("chefia"), true);
  });
});

describe("role navigation", () => {
  it("sends admin work to admin routes instead of the chefia queue", () => {
    const accessModule = access as typeof access & {
      getRoleSettingsPath?: (role: string) => string;
      getRolePendingWorkPath?: (role: string) => string;
    };

    assert.equal(accessModule.getRoleSettingsPath?.("admin"), "/admin/configuracoes");
    assert.equal(accessModule.getRolePendingWorkPath?.("admin"), "/admin/consolidacao");
  });

  it("keeps chefia in triagem and superadmin in the strongest combined scope", () => {
    const accessModule = access as typeof access & {
      canUseTriagemWorkspace?: (role: string) => boolean;
      canUseAdminWorkspace?: (role: string) => boolean;
    };

    assert.equal(accessModule.canUseTriagemWorkspace?.("chefia"), true);
    assert.equal(accessModule.canUseAdminWorkspace?.("chefia"), false);
    assert.equal(accessModule.canUseTriagemWorkspace?.("superadmin"), true);
    assert.equal(accessModule.canUseAdminWorkspace?.("superadmin"), true);
  });
});
