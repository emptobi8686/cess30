import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ENGINEER_RANKS, engineerRank } from "@/features/quests/ranks";

describe("engineer ranks", () => {
  test("starts everyone as a site trainee", () => {
    const r = engineerRank(0);
    assert.equal(r.title, "Site Trainee");
    assert.equal(r.next?.title, "Surveyor");
    assert.equal(r.progress, 0);
    assert.equal(r.toNext, 100);
  });

  test("measures progress within the current rank", () => {
    const r = engineerRank(200);
    assert.equal(r.title, "Surveyor");
    assert.equal(r.progress, 0.5);
    assert.equal(r.toNext, 100);
  });

  test("tops out at chief engineer", () => {
    const top = ENGINEER_RANKS[ENGINEER_RANKS.length - 1];
    const r = engineerRank(top.min + 5000);
    assert.equal(r.title, "Chief Engineer");
    assert.equal(r.next, null);
    assert.equal(r.progress, 1);
    assert.equal(r.toNext, 0);
  });

  test("treats bad input as zero", () => {
    assert.equal(engineerRank(Number.NaN).title, "Site Trainee");
    assert.equal(engineerRank(-40).progress, 0);
  });
});
