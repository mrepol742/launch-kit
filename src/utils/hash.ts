/** A small, stable FNV-1a hash. It intentionally does not depend on platform crypto APIs. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Assign a stable identifier to one of 100 buckets (0 through 99). */
export function bucket(value: string): number {
  return stableHash(value) % 100;
}
