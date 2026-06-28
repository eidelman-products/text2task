const MAX_NORMALIZED_RESULT_DEPTH = 64;
const MAX_NORMALIZED_RESULT_NODES = 20_000;
const MAX_ARRAY_LENGTH = 4_294_967_295;

export type HomepageDemoJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly HomepageDemoJsonValue[]
  | { readonly [key: string]: HomepageDemoJsonValue };

export type HomepageDemoJsonObject = {
  readonly [key: string]: HomepageDemoJsonValue;
};

type RepositoryInputRecord = Readonly<Record<string, unknown>>;
type DataPropertyDescriptor = PropertyDescriptor &
  Readonly<{ value: unknown }>;

type JsonValidationFrame = Readonly<{
  value: unknown;
  depth: number;
  phase: "enter" | "exit";
}>;

export function isHomepageDemoJsonObject(
  value: unknown
): value is HomepageDemoJsonObject {
  return isPlainObject(value) && isJsonValue(value);
}

function isJsonValue(value: unknown): value is HomepageDemoJsonValue {
  const activeObjects = new WeakSet<object>();
  const stack: JsonValidationFrame[] = [
    { value, depth: 0, phase: "enter" },
  ];
  let visitedNodeCount = 0;

  while (stack.length > 0) {
    const frame = stack.pop();

    if (frame === undefined) {
      return false;
    }

    if (frame.phase === "exit") {
      if (frame.value !== null && typeof frame.value === "object") {
        activeObjects.delete(frame.value);
      }

      continue;
    }

    visitedNodeCount += 1;

    if (
      frame.depth > MAX_NORMALIZED_RESULT_DEPTH ||
      visitedNodeCount > MAX_NORMALIZED_RESULT_NODES
    ) {
      return false;
    }

    if (isJsonScalar(frame.value)) {
      continue;
    }

    if (frame.value === null || typeof frame.value !== "object") {
      return false;
    }

    if (activeObjects.has(frame.value)) {
      return false;
    }

    if (isOrdinaryArray(frame.value)) {
      activeObjects.add(frame.value);
      stack.push({
        value: frame.value,
        depth: frame.depth,
        phase: "exit",
      });

      if (!queueJsonArrayChildren(frame.value, frame.depth, stack)) {
        return false;
      }

      continue;
    }

    if (!isPlainObject(frame.value)) {
      return false;
    }

    activeObjects.add(frame.value);
    stack.push({
      value: frame.value,
      depth: frame.depth,
      phase: "exit",
    });

    if (!queueJsonObjectChildren(frame.value, frame.depth, stack)) {
      return false;
    }
  }

  return true;
}

function isJsonScalar(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  return typeof value === "number" && Number.isFinite(value);
}

function queueJsonArrayChildren(
  value: readonly unknown[],
  depth: number,
  stack: JsonValidationFrame[]
): boolean {
  const descriptors = getOwnPropertyDescriptors(value);

  if (descriptors === null) {
    return false;
  }

  const lengthDescriptor = descriptors.length;

  if (!isArrayLengthDescriptor(lengthDescriptor)) {
    return false;
  }

  const arrayLength = lengthDescriptor.value;

  if (arrayLength > MAX_NORMALIZED_RESULT_NODES) {
    return false;
  }

  for (const propertyKey of Reflect.ownKeys(descriptors)) {
    if (typeof propertyKey !== "string") {
      return false;
    }

    if (propertyKey !== "length" && !isArrayIndexKey(propertyKey, arrayLength)) {
      return false;
    }
  }

  for (let index = arrayLength - 1; index >= 0; index -= 1) {
    const descriptor = descriptors[String(index)];

    if (!isEnumerableDataDescriptor(descriptor)) {
      return false;
    }

    stack.push({
      value: descriptor.value,
      depth: depth + 1,
      phase: "enter",
    });
  }

  return true;
}

function isOrdinaryArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) {
    return false;
  }

  try {
    return Object.getPrototypeOf(value) === Array.prototype;
  } catch {
    return false;
  }
}

function queueJsonObjectChildren(
  value: RepositoryInputRecord,
  depth: number,
  stack: JsonValidationFrame[]
): boolean {
  const descriptors = getOwnPropertyDescriptors(value);

  if (descriptors === null) {
    return false;
  }

  for (const propertyKey of Reflect.ownKeys(descriptors)) {
    if (typeof propertyKey !== "string") {
      return false;
    }

    const descriptor = descriptors[propertyKey];

    if (!isEnumerableDataDescriptor(descriptor)) {
      return false;
    }

    stack.push({
      value: descriptor.value,
      depth: depth + 1,
      phase: "enter",
    });
  }

  return true;
}

function isArrayIndexKey(value: string, arrayLength: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return false;
  }

  const index = Number(value);

  return (
    Number.isSafeInteger(index) &&
    index >= 0 &&
    index < arrayLength
  );
}

function isArrayLengthDescriptor(
  descriptor: PropertyDescriptor | undefined
): descriptor is DataPropertyDescriptor & Readonly<{ value: number }> {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === false &&
    "value" in descriptor &&
    descriptor.get === undefined &&
    descriptor.set === undefined &&
    typeof descriptor.value === "number" &&
    Number.isInteger(descriptor.value) &&
    descriptor.value >= 0 &&
    descriptor.value <= MAX_ARRAY_LENGTH
  );
}

function isPlainObject(value: unknown): value is RepositoryInputRecord {
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

function getOwnPropertyDescriptors(
  value: object
): PropertyDescriptorMap | null {
  try {
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
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
