import { expect, it, vi } from 'vitest';
import { createWindowLimiter } from '../services/api/src/limits.js';
it('bounds anonymous limiter keys and expires per-subject and global capacity', () => {
  const admit = createWindowLimiter(1, 1000, 2);
  expect(admit('a', 1000)).toBe(true);
  expect(admit('a', 1001)).toBe(false);
  expect(admit('b', 1002)).toBe(true);
  const set = vi.spyOn(Map.prototype, 'set');
  for (let index = 0; index < 1000; index++) expect(admit('rejected-' + index, 1003)).toBe(false);
  const count = set.mock.calls.length;
  set.mockRestore();
  expect(count).toBe(0);
  expect(admit('a', 2003)).toBe(true);
  expect(admit('b', 2003)).toBe(true);
  expect(admit('c', 2003)).toBe(false);
});

it('gives a configured shared proxy aggregate capacity without raising other client limits', () => {
  const admit = createWindowLimiter(2, 1000, 6, ['192.168.5.1']);
  expect(admit('203.0.113.8', 1000)).toBe(true);
  expect(admit('203.0.113.8', 1001)).toBe(true);
  expect(admit('203.0.113.8', 1002)).toBe(false);
  for (let i = 0; i < 4; i++) expect(admit('192.168.5.1', 1010 + i)).toBe(true);
  expect(admit('192.168.5.1', 1014)).toBe(false);
  expect(admit('203.0.113.9', 1014)).toBe(false);
  expect(admit('192.168.5.1', 2014)).toBe(true);
});
