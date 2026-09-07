import { hashPassword, verifyPassword } from './password.util';

describe('password utilities', () => {
  it('hashes passwords without storing the original value', async () => {
    const hash = await hashPassword('strong-demo-password');
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain('strong-demo-password');
  });

  it('accepts only the correct password', async () => {
    const hash = await hashPassword('correct-password');
    await expect(verifyPassword('correct-password', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
