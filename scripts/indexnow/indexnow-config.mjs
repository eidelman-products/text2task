export const INDEXNOW_KEY =
  "bfc07a49eb3f8529250cbcf7e23cce46febab912744d05dd172331de6fc230c6";

export const SITE_ORIGIN = "https://www.text2task.com";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export const CANONICAL_URL = new URL(SITE_ORIGIN);
export const CANONICAL_HOST = CANONICAL_URL.host;
export const INDEXNOW_KEY_LOCATION = `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`;

export function assertIndexNowKeyIsProtocolValid(key = INDEXNOW_KEY) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error("IndexNow key must be 8-128 characters: A-Z, a-z, 0-9, or dash.");
  }
}
