export function matchesMetadata(
  actual: Readonly<Record<string, unknown>> | undefined,
  expected: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!expected) return true;
  if (!actual) return false;
  return Object.entries(expected).every(
    ([key, value]) => Object.hasOwn(actual, key) && Object.is(actual[key], value),
  );
}
