import { SystemClock } from './clock.js';
import { UuidIdGenerator } from './id-generator.js';

describe('production adapters', () => {
  it('SystemClock returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it('UuidIdGenerator produces unique prefixed IDs', () => {
    const ids = new UuidIdGenerator();
    const first = ids.generate('sub');

    expect(first).toMatch(/^sub_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(ids.generate('sub')).not.toBe(first);
  });
});
