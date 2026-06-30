import "server-only";

import { HomepageDemoPublicRequestError } from "@/lib/homepage-demo/errors";

export type HomepageDemoPublicReviewRequest = Readonly<{
  publicToken: string;
}>;

type PublicReviewRequestRecord = Readonly<{
  publicToken: unknown;
}>;

type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;

const PUBLIC_REVIEW_REQUEST_KEYS = ["publicToken"] as const;

export function parseHomepageDemoPublicReviewRequest(
  value: unknown
): HomepageDemoPublicReviewRequest {
  const record = validatePublicReviewRequestRecord(value);

  if (typeof record.publicToken !== "string") {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  return {
    publicToken: record.publicToken,
  };
}

function validatePublicReviewRequestRecord(
  value: unknown
): PublicReviewRequestRecord {
  if (!isPlainObject(value)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const descriptors = getOwnPropertyDescriptors(value);
  const propertyKeys = Reflect.ownKeys(descriptors);

  if (
    propertyKeys.length !== PUBLIC_REVIEW_REQUEST_KEYS.length ||
    propertyKeys.some((key) => typeof key !== "string")
  ) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  for (const key of PUBLIC_REVIEW_REQUEST_KEYS) {
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
