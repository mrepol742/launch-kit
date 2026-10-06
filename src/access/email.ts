export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function emailDomain(value: string): string | undefined {
  const normalized = normalizeEmail(value);
  const at = normalized.lastIndexOf("@");
  return at > 0 && at < normalized.length - 1 ? normalized.slice(at + 1) : undefined;
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function normalizeDomain(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("*@") ? normalized.slice(2) : normalized;
}

export function matchesEmail(
  email: string | undefined,
  emails: readonly string[] | undefined,
  domains: readonly string[] | undefined,
): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  const domain = emailDomain(normalized);
  if (
    emails?.some((candidate) => {
      const normalizedCandidate = normalizeEmail(candidate);
      return (
        normalizedCandidate === normalized ||
        (normalizedCandidate.startsWith("*@") &&
          normalizeDomain(normalizedCandidate) === domain)
      );
    })
  )
    return true;
  return Boolean(
    domain && domains?.some((candidate) => normalizeDomain(candidate) === domain),
  );
}
