import { BadRequestException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  prepareIdentityNumber,
  preparePortrait,
} from "../src/modules/parties/customer-pii.js";

describe("customer PII", () => {
  const originalKey = process.env.PII_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString("base64url");
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts identity numbers and keeps only a deterministic hash and last four", () => {
    const first = prepareIdentityNumber("11010519491231002x");
    const second = prepareIdentityNumber("11010519491231002X");

    expect(first).not.toBeNull();
    expect(first?.encrypted).not.toContain("11010519491231002X");
    expect(first?.encrypted).not.toBe(second?.encrypted);
    expect(first?.hash).toBe(second?.hash);
    expect(first?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first?.last4).toBe("002X");
  });

  it("rejects an identity number with an invalid check digit", () => {
    expect(() => prepareIdentityNumber("110105194912310021")).toThrow(
      BadRequestException,
    );
  });

  it("accepts supported portrait content and rejects a mismatched format", () => {
    const jpeg = preparePortrait(
      `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`,
    );

    expect(jpeg?.mimeType).toBe("image/jpeg");
    expect(jpeg?.bytes.length).toBe(4);
    expect(() =>
      preparePortrait(
        `data:image/png;base64,${Buffer.from("not-a-png").toString("base64")}`,
      ),
    ).toThrow(BadRequestException);
  });
});
