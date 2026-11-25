import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  EVIDENCE_MAX_BYTES,
  checkEvidenceUpload,
  evidencePathOwner,
  isEvidencePath,
  planEvidencePath,
  sniffEvidence,
} from "@/features/quests/evidence-file";

const UID = "11111111-1111-4111-8111-111111111111";
const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("quest evidence files", () => {
  test("sniffs photos and PDFs from their bytes", () => {
    assert.equal(sniffEvidence(bytes(0xff, 0xd8, 0xff)), "image/jpeg");
    assert.equal(sniffEvidence(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
    assert.equal(sniffEvidence(bytes(0x25, 0x50, 0x44, 0x46, 0x2d)), "application/pdf");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    assert.equal(sniffEvidence(webp), "image/webp");
    assert.equal(sniffEvidence(new TextEncoder().encode("<html><script>")), null);
  });

  test("checks declared type and size before upload", () => {
    assert.deepEqual(checkEvidenceUpload({ type: "image/jpeg", size: 1000 }), { ok: true, mime: "image/jpeg", ext: "jpg" });
    assert.equal(checkEvidenceUpload({ type: "image/jpg", size: 1000 }).ok, true);
    assert.equal(checkEvidenceUpload({ type: "video/mp4", size: 1000 }).ok, false);
    assert.equal(checkEvidenceUpload({ type: "application/pdf", size: EVIDENCE_MAX_BYTES + 1 }).ok, false);
    assert.equal(checkEvidenceUpload({ type: "application/pdf", size: 0 }).ok, false);
  });

  test("plans paths inside the student's own folder", () => {
    const path = planEvidencePath(UID, "pdf");
    assert.ok(isEvidencePath(path));
    assert.equal(evidencePathOwner(path), UID);
    assert.equal(isEvidencePath(`${UID}/../x.pdf`), false);
    assert.equal(isEvidencePath(`${UID}/22222222-2222-4222-8222-222222222222.exe`), false);
  });
});
