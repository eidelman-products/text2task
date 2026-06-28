import "server-only";

import ipaddr from "ipaddr.js";

import { HomepageDemoIdentityError } from "@/lib/homepage-demo/errors";

const VERCEL_FORWARDED_FOR_HEADER = "x-vercel-forwarded-for";
const DEVELOPMENT_CLIENT_IP_HEADER = "x-text2task-dev-client-ip";
const MAX_TRUSTED_IP_HEADER_LENGTH = 128;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

const IPV6_GLOBAL_UNICAST_BASE = ipaddr.IPv6.parse("2000::");

export type HomepageDemoTrustedClientIpIdentity = Readonly<{
  family: "ipv4" | "ipv6";
  normalizedIdentity: string;
}>;

export type HomepageDemoHeadersLike =
  | Headers
  | Readonly<{
      get: (name: string) => unknown;
    }>;

type HeaderGetter = Readonly<{
  get: (name: string) => unknown;
}>;

type ParsedIpv4Address = ReturnType<typeof ipaddr.IPv4.parse>;
type ParsedIpv6Address = ReturnType<typeof ipaddr.IPv6.parse>;
type ParsedIpAddress = ParsedIpv4Address | ParsedIpv6Address;

export function getHomepageDemoTrustedClientIpIdentity(
  headers: HomepageDemoHeadersLike
): HomepageDemoTrustedClientIpIdentity {
  if (process.env.NODE_ENV === "production") {
    return getProductionTrustedClientIpIdentity(headers);
  }

  const value = readRequiredSingleHeader(
    headers,
    DEVELOPMENT_CLIENT_IP_HEADER
  );

  return normalizePublicClientIp(value);
}

function getProductionTrustedClientIpIdentity(
  headers: HomepageDemoHeadersLike
): HomepageDemoTrustedClientIpIdentity {
  if (process.env.VERCEL !== "1") {
    throw new HomepageDemoIdentityError("identity_unavailable");
  }

  // Vercel is the trusted reverse proxy for this deployment. The server-side
  // VERCEL environment value is the deployment trust boundary, and
  // x-vercel-forwarded-for is the canonical Vercel-provided client IP value.
  // x-vercel-id is request-region metadata, not cryptographic authentication.
  const value = readRequiredSingleHeader(headers, VERCEL_FORWARDED_FOR_HEADER);

  return normalizePublicClientIp(value);
}

function readRequiredSingleHeader(
  headers: HomepageDemoHeadersLike,
  name: string
): string {
  const value = readHeader(headers, name);

  if (value === null) {
    throw new HomepageDemoIdentityError("identity_unavailable");
  }

  return value;
}

function readHeader(
  headers: HomepageDemoHeadersLike,
  name: string
): string | null {
  try {
    if (!isHeaderGetter(headers)) {
      throw new HomepageDemoIdentityError("identity_unavailable");
    }

    const value = Reflect.apply(headers.get, headers, [name]);

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new HomepageDemoIdentityError("identity_unavailable");
    }

    return value;
  } catch {
    throw new HomepageDemoIdentityError("identity_unavailable");
  }
}

function isHeaderGetter(value: unknown): value is HeaderGetter {
  return value !== null && typeof value === "object" && "get" in value;
}

function normalizePublicClientIp(
  value: string
): HomepageDemoTrustedClientIpIdentity {
  assertSafeRawIpHeaderValue(value);

  const address = parseTrustedIpAddress(value);

  if (address instanceof ipaddr.IPv4) {
    return normalizePublicIpv4(address);
  }

  if (address instanceof ipaddr.IPv6) {
    return normalizePublicIpv6(address, value);
  }

  throw new HomepageDemoIdentityError("identity_input_invalid");
}

function assertSafeRawIpHeaderValue(value: string): void {
  if (
    value.length === 0 ||
    value.length > MAX_TRUSTED_IP_HEADER_LENGTH ||
    value.trim() !== value ||
    value.includes(",") ||
    value.includes("[") ||
    value.includes("]") ||
    value.includes("%") ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new HomepageDemoIdentityError("identity_input_invalid");
  }
}

function parseTrustedIpAddress(value: string): ParsedIpAddress {
  try {
    if (!value.includes(":")) {
      if (!ipaddr.IPv4.isValidFourPartDecimal(value)) {
        throw new HomepageDemoIdentityError("identity_input_invalid");
      }

      return ipaddr.IPv4.parse(value);
    }

    if (value.includes(".")) {
      const dottedTail = value.slice(value.lastIndexOf(":") + 1);

      if (!ipaddr.IPv4.isValidFourPartDecimal(dottedTail)) {
        throw new HomepageDemoIdentityError("identity_input_invalid");
      }
    }

    return ipaddr.parse(value);
  } catch {
    throw new HomepageDemoIdentityError("identity_input_invalid");
  }
}

function normalizePublicIpv4(
  address: ParsedIpv4Address
): HomepageDemoTrustedClientIpIdentity {
  if (address.range() !== "unicast") {
    throw new HomepageDemoIdentityError("identity_input_invalid");
  }

  return {
    family: "ipv4",
    normalizedIdentity: `ipv4:${address.toString()}`,
  };
}

function normalizePublicIpv6(
  address: ParsedIpv6Address,
  rawValue: string
): HomepageDemoTrustedClientIpIdentity {
  if (address.isIPv4MappedAddress()) {
    return normalizePublicIpv4(address.toIPv4Address());
  }

  if (rawValue.includes(".") || !isPublicNativeIpv6(address)) {
    throw new HomepageDemoIdentityError("identity_input_invalid");
  }

  return {
    family: "ipv6",
    normalizedIdentity: `ipv6:${formatIpv6Hextets(
      getIpv6Network64Parts(address)
    )}/64`,
  };
}

function isPublicNativeIpv6(address: ParsedIpv6Address): boolean {
  return (
    address.range() === "unicast" &&
    address.match(IPV6_GLOBAL_UNICAST_BASE, 3)
  );
}

function getIpv6Network64Parts(address: ParsedIpv6Address): readonly number[] {
  const networkBytes = address
    .toByteArray()
    .map((byte, index) => (index < 8 ? byte : 0));
  const networkAddress = new ipaddr.IPv6(networkBytes);

  return networkAddress.parts;
}

function formatIpv6Hextets(hextets: readonly number[]): string {
  return hextets
    .map((hextet) => hextet.toString(16).padStart(4, "0"))
    .join(":");
}
