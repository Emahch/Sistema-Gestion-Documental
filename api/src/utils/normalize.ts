export function normalizeEmail(email: unknown): string {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function normalizeName(name: unknown): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


