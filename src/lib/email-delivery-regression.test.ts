import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { EMAIL_TEMPLATE_CATALOG, parseEmailTemplateKey } from "./email";

const root = process.cwd();
const emailSource = readFileSync(path.join(root, "src/lib/email.ts"), "utf8");
const queueSource = readFileSync(path.join(root, "src/lib/email-alert-queue.ts"), "utf8");
const claimMigration = readFileSync(
  path.join(root, "supabase/migrations/20260919150000_reliable_email_queue_delivery.sql"),
  "utf8",
);
const cronRouteSource = readFileSync(
  path.join(root, "src/app/api/cron/email-dispatch/route.ts"),
  "utf8",
);
const vercelConfig = readFileSync(path.join(root, "vercel.json"), "utf8");

test("only Gmail SMTP is eligible to deliver system emails", () => {
  assert.doesNotMatch(emailSource, /from "resend"/);
  assert.doesNotMatch(emailSource, /RESEND_API_KEY/);
  assert.match(emailSource, /getSmtpTransport\(\)/);
});

test("the delivery worker accepts every current template, including distinct rejection and archive messages", () => {
  assert.equal(Object.keys(EMAIL_TEMPLATE_CATALOG).length, 20);
  assert.equal(parseEmailTemplateKey("dfd_rejected"), "dfd_rejected");
  assert.equal(parseEmailTemplateKey("dfd_archived"), "dfd_archived");
  assert.equal(parseEmailTemplateKey("template_that_does_not_exist"), undefined);
  assert.match(queueSource, /template_key\?: EmailTemplateKey/);
  assert.match(emailSource, /export function parseEmailTemplateKey/);
});

test("full-size illustrations stay hosted by default instead of bloating Gmail messages", () => {
  assert.match(emailSource, /EMAIL_INLINE_IMAGES/);
  assert.match(emailSource, /!== "true"/);
  assert.match(emailSource, /getFlatImageUrl\(slot\)/);
});

test("the email keeps essential layout inline and improves reading on narrow Gmail screens", () => {
  assert.match(emailSource, /@media screen and \(max-width: 600px\)/);
  assert.match(emailSource, /class="email-button"/);
  assert.match(emailSource, /class="email-title"/);
  assert.match(emailSource, /class="email-fact-value"/);
  assert.match(emailSource, /style="max-width:650px/);
});

test("the email worker persists every delivery-state transition", () => {
  assert.match(queueSource, /export async function dispatchEmailAlertQueue/);
  assert.match(queueSource, /await markQueueItem\(admin, queueItem\.id, \{/);
  assert.match(queueSource, /status: "sent"/);
  assert.match(queueSource, /status: "failed"/);
});

test("stale processing rows return to the claimable queue", () => {
  assert.match(claimMigration, /locked_at TIMESTAMPTZ/);
  assert.match(claimMigration, /q\.status = 'processing'/);
  assert.match(claimMigration, /q\.locked_at < now\(\) - interval '20 minutes'/);
});

test("a secured background route processes the queue without an open browser", () => {
  assert.match(cronRouteSource, /request\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/);
  assert.match(cronRouteSource, /dispatchEmailAlertQueue/);
  assert.match(vercelConfig, /"path": "\/api\/cron\/email-dispatch"/);
});
