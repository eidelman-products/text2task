import "server-only";

import { HomepageDemoExtractionError } from "@/lib/homepage-demo/errors";

export const HOMEPAGE_DEMO_TEXT_INPUT_MAX_CHARACTERS = 8000;

// UTF-8 scalar values can occupy up to 4 bytes, so this cannot reject text
// that satisfies the character limit solely because it uses multi-byte text.
export const HOMEPAGE_DEMO_TEXT_INPUT_MAX_UTF8_BYTES =
  HOMEPAGE_DEMO_TEXT_INPUT_MAX_CHARACTERS * 4;

const DISALLOWED_CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

const textEncoder = new TextEncoder();

export function validateHomepageDemoTextInput(value: unknown): string {
  if (typeof value !== "string") {
    throw new HomepageDemoExtractionError("invalid_text_input");
  }

  if (DISALLOWED_CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new HomepageDemoExtractionError("invalid_text_input");
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new HomepageDemoExtractionError("invalid_text_input");
  }

  if (trimmedValue.length > HOMEPAGE_DEMO_TEXT_INPUT_MAX_CHARACTERS) {
    throw new HomepageDemoExtractionError("text_input_too_large");
  }

  if (
    textEncoder.encode(trimmedValue).length >
    HOMEPAGE_DEMO_TEXT_INPUT_MAX_UTF8_BYTES
  ) {
    throw new HomepageDemoExtractionError("text_input_too_large");
  }

  return trimmedValue;
}
