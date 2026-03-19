import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

const SECRET = process.env.ENCRYPTION_SECRET!;

if (!SECRET) {
  throw new Error("Missing ENCRYPTION_SECRET env variable");
}

// מייצר מפתח באורך נכון
function getKey() {
  return crypto.createHash("sha256").update(SECRET).digest();
}

// 🔐 הצפנה
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

// 🔓 פענוח
export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}