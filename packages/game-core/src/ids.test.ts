import { afterEach, expect, it, vi } from 'vitest';
import { uuid } from './ids';

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => vi.unstubAllGlobals());

it('works in insecure contexts where crypto.randomUUID is missing', () => {
  const real = crypto;
  vi.stubGlobal('crypto', {
    getRandomValues: (a: Uint8Array) => real.getRandomValues(a),
  });
  const ids = new Set(Array.from({ length: 50 }, uuid));
  expect(ids.size).toBe(50);
  for (const id of ids) expect(id).toMatch(V4);
});

it('still returns a valid id with no crypto object at all', () => {
  vi.stubGlobal('crypto', undefined);
  expect(uuid()).toMatch(V4);
});
