import test from "node:test";
import assert from "node:assert/strict";
import {
  coveragePercent,
  extractTikTokVideoId,
  extractYouTubeVideoId,
  isTaskActionAllowed,
  normalizeTaskAction,
} from "./task-actions.ts";

test("normalizes legacy view actions to Watch", () => {
  assert.equal(normalizeTaskAction("view"), "watch");
  assert.equal(normalizeTaskAction("views"), "watch");
  assert.equal(normalizeTaskAction("Follow"), "follow");
});

test("keeps actions attached to the correct platform", () => {
  assert.equal(isTaskActionAllowed("telegram", "join"), true);
  assert.equal(isTaskActionAllowed("telegram", "follow"), true);
  assert.equal(isTaskActionAllowed("telegram", "repost"), false);
  assert.equal(isTaskActionAllowed("x", "repost"), true);
  assert.equal(isTaskActionAllowed("x", "join"), false);
  assert.equal(isTaskActionAllowed("youtube", "watch"), true);
});

test("extracts supported video IDs", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractTikTokVideoId("https://www.tiktok.com/@creator/video/6718335390845095173"), "6718335390845095173");
});

test("watch coverage requires the full timeline, not just the final timestamp", () => {
  const watched = new Set([0, 1, 2, 3]);
  assert.equal(Math.round(coveragePercent(watched, 4)), 100);
  assert.equal(Math.round(coveragePercent(new Set([0, 3]), 4)), 50);
});
