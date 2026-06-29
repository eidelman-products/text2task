import "server-only";

import {
  extractProjectFromText,
  TextExtractionError,
} from "@/lib/extraction/text-extraction.server";
import { HomepageDemoExtractionError } from "@/lib/homepage-demo/errors";
import { validateHomepageDemoTextInput } from "@/lib/homepage-demo/extraction-validation.server";
import {
  isHomepageDemoJsonObject,
  type HomepageDemoJsonObject,
} from "@/lib/homepage-demo/json-validation";
import type { HomepageDemoTextExtractionArtifact } from "@/lib/homepage-demo/types";

const HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION = "homepage-demo-draft-v1";
const HOMEPAGE_DEMO_TEXT_ENGINE_VERSION = "text-extraction-v1";

export async function extractHomepageDemoText(
  input: unknown
): Promise<HomepageDemoTextExtractionArtifact> {
  const validatedText = validateHomepageDemoTextInput(input);

  let extractionResult: unknown;

  try {
    // The Review draft stores the existing extraction schema directly; any
    // task.raw_input values come from the validated, trimmed input here.
    extractionResult = await extractProjectFromText({ input: validatedText });
  } catch (error) {
    throw mapTextExtractionError(error);
  }

  return {
    normalizedResult: validateNormalizedResult(extractionResult),
    schemaVersion: HOMEPAGE_DEMO_TEXT_SCHEMA_VERSION,
    engineVersion: HOMEPAGE_DEMO_TEXT_ENGINE_VERSION,
  };
}

function validateNormalizedResult(value: unknown): HomepageDemoJsonObject {
  if (!isHomepageDemoJsonObject(value)) {
    throw new HomepageDemoExtractionError("text_extraction_invalid_result");
  }

  return value;
}

function mapTextExtractionError(error: unknown): HomepageDemoExtractionError {
  if (error instanceof HomepageDemoExtractionError) {
    return error;
  }

  if (error instanceof TextExtractionError) {
    if (error.code === "extraction_timeout") {
      return new HomepageDemoExtractionError("text_extraction_timeout");
    }

    if (error.code === "invalid_model_output") {
      return new HomepageDemoExtractionError("text_extraction_invalid_result");
    }
  }

  return new HomepageDemoExtractionError("text_extraction_unavailable");
}
