import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatSidebarBadgeCount,
  mapUnreadNotificationsToSidebarBadges,
} from "./sidebar-notifications";

describe("sidebar-notifications", () => {
  it("formats notification counts for compact sidebar badges", () => {
    assert.equal(formatSidebarBadgeCount(0), null);
    assert.equal(formatSidebarBadgeCount(7), "7");
    assert.equal(formatSidebarBadgeCount(120), "99+");
  });

  it("groups unread rich notifications by the closest sidebar route", () => {
    const badges = mapUnreadNotificationsToSidebarBadges(
      [
        {
          id: "1",
          title: "Sala coletiva atualizada",
          message: JSON.stringify({
            kind: "rich_notification",
            body: "Há nova movimentação na sala.",
            cta_url: "https://percata.vercel.app/dfds-coletivas/abc",
          }),
          type: "warning",
          read: false,
        },
        {
          id: "2",
          title: "Outra sala coletiva",
          message: JSON.stringify({
            kind: "rich_notification",
            body: "Há comentário novo.",
            ctaUrl: "/dfds-coletivas/xyz",
          }),
          type: "info",
          read: false,
        },
        {
          id: "3",
          title: "Já lida",
          message: JSON.stringify({
            kind: "rich_notification",
            cta_url: "https://percata.vercel.app/dfds-coletivas/lida",
          }),
          type: "success",
          read: true,
        },
      ],
      ["/dashboard", "/dfds-coletivas", "/triagem"],
    );

    assert.equal(badges["/dfds-coletivas"].value, "2");
    assert.equal(badges["/dfds-coletivas"].tone, "warning");
    assert.equal(badges["/dfds-coletivas"].shake, true);
    assert.equal(badges["/dashboard"], undefined);
  });

  it("falls back to known workflow routes when a notification has no cta", () => {
    const badges = mapUnreadNotificationsToSidebarBadges(
      [
        {
          id: "1",
          title: "DFD enviada para análise",
          message: "Uma DFD chegou para triagem.",
          type: "info",
          read: false,
        },
      ],
      ["/dashboard", "/triagem", "/minhas-dfds"],
    );

    assert.equal(badges["/triagem"].value, "1");
  });
});
