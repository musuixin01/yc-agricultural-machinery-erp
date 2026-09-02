import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
} from "../src/modules/identity/password.js";
import { hashToken, issueOpaqueToken } from "../src/modules/identity/tokens.js";

describe("identity credentials", () => {
  it("hashes passwords with a unique salt and verifies without storing plaintext", async () => {
    const first = await hashPassword("玉春安全密码-2026");
    const second = await hashPassword("玉春安全密码-2026");
    expect(first).not.toBe(second);
    expect(first).not.toContain("玉春安全密码");
    await expect(verifyPassword("玉春安全密码-2026", first)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("错误密码", first)).resolves.toBe(false);
  }, 20_000);

  it("issues unpredictable opaque tokens and stores only their digest", () => {
    const first = issueOpaqueToken();
    const second = issueOpaqueToken();
    expect(first).not.toBe(second);
    expect(hashToken(first)).toHaveLength(64);
    expect(hashToken(first)).not.toContain(first);
  });
});
