import { isValidEmail } from './validators';

describe('validators', () => {
  it('should validate email format', () => {
    expect(isValidEmail('ana@example.com')).toBe(true);
    expect(isValidEmail('a.b+tag@sub.dom.co')).toBe(true);
    expect(isValidEmail('no-es-correo')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});
