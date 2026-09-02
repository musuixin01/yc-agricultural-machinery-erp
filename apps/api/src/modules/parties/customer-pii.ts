import { BadRequestException } from "@nestjs/common";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";

const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CHECK_CODES = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
const MAX_PORTRAIT_BYTES = 1_572_864;

function piiKey() {
  const encoded = process.env.PII_ENCRYPTION_KEY;
  const key = encoded ? Buffer.from(encoded, "base64url") : Buffer.alloc(0);
  if (key.length !== 32)
    throw new BadRequestException({
      code: "PII_ENCRYPTION_NOT_CONFIGURED",
      detail: "系统尚未配置客户敏感资料加密密钥，请联系管理员。",
    });
  return key;
}

export function prepareIdentityNumber(value?: string) {
  if (!value?.trim()) return null;
  const normalized = value.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(normalized)) invalidIdentity();
  const sum = ID_WEIGHTS.reduce(
    (total, weight, index) => total + Number(normalized[index]) * weight,
    0,
  );
  if (ID_CHECK_CODES[sum % 11] !== normalized[17]) invalidIdentity();

  const key = piiKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`,
    hash: createHmac("sha256", key).update(normalized).digest("hex"),
    last4: normalized.slice(-4),
  };
}

export function preparePortrait(value?: string) {
  if (!value) return null;
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match)
    throw new BadRequestException({
      code: "PORTRAIT_FORMAT_INVALID",
      detail: "客户人像只支持 JPEG、PNG 或 WebP 图片。",
    });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_PORTRAIT_BYTES)
    throw new BadRequestException({
      code: "PORTRAIT_SIZE_INVALID",
      detail: "客户人像压缩后不能超过 1.5MB。",
    });
  const mimeType = match[1];
  const valid =
    (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (mimeType === "image/png" &&
      bytes.subarray(0, 4).toString("hex") === "89504e47") ||
    (mimeType === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!valid)
    throw new BadRequestException({
      code: "PORTRAIT_CONTENT_INVALID",
      detail: "客户人像内容与图片格式不一致。",
    });
  return { bytes, mimeType };
}

function invalidIdentity(): never {
  throw new BadRequestException({
    code: "IDENTITY_NUMBER_INVALID",
    detail: "身份证号码格式或校验位不正确。",
  });
}
