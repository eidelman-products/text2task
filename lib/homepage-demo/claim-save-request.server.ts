import "server-only";

import { HomepageDemoPublicRequestError } from "@/lib/homepage-demo/errors";
import { readHomepageDemoPublicExtractRequestJson } from "@/lib/homepage-demo/public-extract-request.server";

export type HomepageDemoClaimSaveRequest = Readonly<Record<string, never>>;

type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;

export async function readHomepageDemoClaimSaveRequestJson(
  request: Request
): Promise<unknown> {
  return readHomepageDemoPublicExtractRequestJson(request);
}

export function parseHomepageDemoClaimSaveRequest(
  value: unknown
): HomepageDemoClaimSaveRequest {
  validateEmptyRequestRecord(value);

  return {};
}

function validateEmptyRequestRecord(value: unknown): void {
  if (!isPlainObject(value)) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  const descriptors = getOwnPropertyDescriptors(value);
  const propertyKeys = Reflect.ownKeys(descriptors);

  if (propertyKeys.length !== 0) {
    throw new HomepageDemoPublicRequestError("invalid_request_body");
  }

  for (const descriptor of Object.values(descriptors)) {
    if (!isEnumerableDataDescriptor(descriptor)) {
      throw new HomepageDemoPublicRequestError("invalid_request_body");
    }
  }
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
