import test from "node:test";
import assert from "node:assert/strict";
import { ADVERTISE_SERVICES, calculateAdvertiseOrder } from "./advertise-economy.ts";

test("Advertise catalogue contains the 60 configured services", () => {
  assert.equal(ADVERTISE_SERVICES.length, 60);
  assert.equal(new Set(ADVERTISE_SERVICES.map((s) => s.serviceId)).size, 60);
});

test("standard service pricing splits 70% tasker / 30% TASKORA", () => {
  const service = ADVERTISE_SERVICES.find((s) => s.serviceId === "sv_responses");
  assert.ok(service);
  const result = calculateAdvertiseOrder(service, 20);
  assert.equal(result.customerTotal, 20);
  assert.equal(result.taskerBudget, 14);
  assert.equal(result.taskoraMargin, 6);
});

test("YouTube Watch uses verified seconds and the approved rate", () => {
  const service = ADVERTISE_SERVICES.find((s) => s.serviceId === "yt_watch");
  assert.ok(service);
  assert.equal(service.customerUnitPrice, 0.0001);
  assert.equal(service.taskerUnitReward, 0.00007);
  assert.equal(service.taskoraUnitMargin, 0.00003);
  const result = calculateAdvertiseOrder(service, 100, 60);
  assert.equal(result.units, 60);
  assert.equal(result.customerTotal, 0.006);
  assert.equal(result.taskerBudget, 0.0042);
  assert.equal(result.taskoraMargin, 0.0018);
});

test("minimum quantities match the approved catalogue", () => {
  const min = Object.fromEntries(ADVERTISE_SERVICES.map((s) => [s.serviceId, s.minQuantity]));
  assert.equal(min.ig_followers, 100);
  assert.equal(min.ig_comments, 20);
  assert.equal(min.yt_views, 500);
  assert.equal(min.ar_ios, 10);
  assert.equal(min.sv_responses, 20);
  assert.equal(min.rd_comments, 20);
});
