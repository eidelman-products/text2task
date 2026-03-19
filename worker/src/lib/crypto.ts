import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

const SECRET = process.env.ENCRYPTION_SECRET!;

if (!SECRET) {
  throw new Error("Missing ENCRYPTION_SECRET env variable");
}

function getKey() {
  return crypto.createHash("sha256").update(SECRET).digest();
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}