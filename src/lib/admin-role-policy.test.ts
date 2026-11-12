import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as policy from "./admin-role-policy.ts";

type PolicyModule = typeof policy & {
  evaluateAdminTargetAccess?: (input: {
    actorRole: string;
    actorCampusId: string | null;
    targetCampusId: string | null;
    targetRole: string | null;
  }) => { allowed: boolean };
  resolveManagedCampus?: (input: {
    actorRole: string;
    actorCampusId: string | null;
    requestedCampusId: string | null;
  }) => { allowed: boolean; campusId: string | null };
};

describe("admin role policy", () => {
  it("restricts admin mutations to non-superadmin profiles in its own campus", () => {
    const decide = (policy as PolicyModule).evaluateAdminTargetAccess;

    assert.equal(
      decide?.({ actorRole: "admin", actorCampusId: "campus-a", targetCampusId: "campus-a", targetRole: "chefia" }).allowed,
      true,
    );
    assert.equal(
      decide?.({ actorRole: "admin", actorCampusId: "campus-a", targetCampusId: "campus-b", targetRole: "chefia" }).allowed,
      false,
    );
    assert.equal(
      decide?.({ actorRole: "admin", actorCampusId: "campus-a", targetCampusId: "campus-a", targetRole: "superadmin" }).allowed,
      false,
    );
  });

  it("allows superadmin to manage every campus and protected profile", () => {
    const decide = (policy as PolicyModule).evaluateAdminTargetAccess;

    assert.equal(
      decide?.({ actorRole: "superadmin", actorCampusId: null, targetCampusId: "campus-b", targetRole: "superadmin" }).allowed,
      true,
    );
  });

  it("forces admin invitations into its own campus while superadmin remains unrestricted", () => {
    const resolve = (policy as PolicyModule).resolveManagedCampus;

    assert.deepEqual(
      resolve?.({ actorRole: "admin", actorCampusId: "campus-a", requestedCampusId: null }),
      { allowed: true, campusId: "campus-a" },
    );
    assert.deepEqual(
      resolve?.({ actorRole: "admin", actorCampusId: "campus-a", requestedCampusId: "campus-b" }),
      { allowed: false, campusId: null },
    );
    assert.deepEqual(
      resolve?.({ actorRole: "superadmin", actorCampusId: null, requestedCampusId: "campus-b" }),
      { allowed: true, campusId: "campus-b" },
    );
  });
});
