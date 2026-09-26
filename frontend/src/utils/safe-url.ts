export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  return isSafeExternalUrl(trimmed) ? trimmed : null;
}