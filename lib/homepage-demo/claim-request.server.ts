import "server-only";

import { HomepageDemoPublicRequestError } from "@/lib/homepage-demo/errors";
import { readHomepageDemoPublicExtractRequestJson } from "@/lib/homepage-demo/public-extract-request.server";
import { isValidHomepageDemoToken } from "@/lib/homepage-demo/tokens.server";

export type HomepageDemoClaimPrepareRequest = Readonly<{
  publicToken: string;
}>;

type ClaimPrepareRequestRecord = Readonly<{
  publicToken: unknown;
}>;

type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;

const CLAIM_PREPARE_REQUEST_KEYS = ["publicToken"] as const;

export async function readHomepageDemoClaimPrepareRequestJson(
  request: Request
): Promise<unknown> {
  return readHomepageDemoPublicExtractRequestJson(request);
}

export function parseHomepageDemoClaimPrepareRequest(
  value: unknown
): HomepageDemoClaimPrepareRequest {
  const record = validateClaimPrepareRequestRecord(value);

  if (!isValidHomepageDemoToken(record.publicToken)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  return {
    publicToken: record.publicToken,
  };
}

function validateClaimPrepareRequestRecord(
  value: unknown
): ClaimPrepareRequestRecord {
  if (!isPlainObject(value)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const descriptors = getOwnPropertyDescriptors(value);
  const propertyKeys = Reflect.ownKeys(descriptors);

  if (
    propertyKeys.length !== CLAIM_PREPARE_REQUEST_KEYS.length ||
    propertyKeys.some((key) => typeof key !== "string")
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  for (const key of CLAIM_PREPARE_REQUEST_KEYS) {
    const descriptor = descriptors[key];

    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoPublicRequestError("invalid_request_body");
    }
  }

  return {
    publicToken: descriptors.publicToken.value,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function getOwnPropertyDescriptors(value: object): PropertyDescriptorMap {
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined
): descriptor is DataPropertyDescriptor {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor &&
    descriptor.get === undefined &&
    descriptor.set === undefined
  );
}
