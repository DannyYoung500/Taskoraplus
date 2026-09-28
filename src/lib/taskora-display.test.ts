import test from "node:test";
import assert from "node:assert/strict";
import { formatUsd, isDemoTaskTitle, isDemoTransactionLabel } from "./taskora-display.ts";

test("formats all TASKORA monetary values to four decimals", () => {
  assert.equal(formatUsd(0), "$0.0000");
  assert.equal(formatUsd(1.2), "$1.2000");
  assert.equal(formatUsd(0.0001), "$0.0001");
  assert.equal(formatUsd(undefined), "$0.0000");
});

test("recognizes seeded demo tasks", () => {
  assert.equal(isDemoTaskTitle("Join the Alpha Signals channel"), true);
  assert.equal(isDemoTaskTitle("Real owner task"), false);
});

test("recognizes seeded demo and check-in money labels", () => {
  assert.equal(isDemoTransactionLabel("Referral bonus"), true);
  assert.equal(isDemoTransactionLabel("Daily check-in — day 3"), true);
  assert.equal(isDemoTransactionLabel("Verified — real advertiser"), false);
});
