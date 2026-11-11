const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { test } = require('node:test');

// Resolve through the actual consumer so npm and pnpm test the same override.
const pwaRequire = createRequire(require.resolve('vite-plugin-pwa'));
const workboxRequire = createRequire(pwaRequire.resolve('workbox-build'));
const resolverRequire = createRequire(workboxRequire.resolve('@rollup/plugin-node-resolve'));
const merge = resolverRequire('deepmerge');

test('npm-audit: malicious target keys cannot poison the merged object prototype', () => {
  const target = JSON.parse('{"__proto__":{"syntheticMarker":"inherited"},"safe":{"left":1}}');
  const result = merge(target, { safe: { right: 2 } });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.syntheticMarker, undefined);
  assert.equal(Object.hasOwn(result, '__proto__'), false);
  assert.deepEqual(result.safe, { left: 1, right: 2 });
  assert.equal({}.syntheticMarker, undefined);
});

test('npm-audit: null-prototype targets and nested sources reject prototype keys', () => {
  const source = JSON.parse('{"__proto__":{"syntheticMarker":"inherited"},"nested":{"__proto__":{"syntheticMarker":"nested"},"safe":true}}');
  const result = merge(Object.create(null), source);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(result.syntheticMarker, undefined);
  assert.equal(Object.getPrototypeOf(result.nested), Object.prototype);
  assert.equal(result.nested.syntheticMarker, undefined);
  assert.equal(result.nested.safe, true);
});

test('npm-audit: the resolver retains deep clone, arrays, symbols and custom merge behavior', () => {
  const symbol = Symbol('synthetic');
  const input = { arrays: [{ left: 1 }], nested: { safe: true }, [symbol]: { left: 1 } };
  const result = merge(input, { arrays: [{ right: 2 }], [symbol]: { right: 2 } });
  assert.deepEqual(result.arrays, [{ left: 1 }, { right: 2 }]);
  assert.notEqual(result.arrays[0], input.arrays[0]);
  assert.notEqual(result.nested, input.nested);
  assert.deepEqual(result[symbol], { left: 1, right: 2 });
  assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
  assert.deepEqual(merge({ a: [1] }, { a: [2] }, { arrayMerge: (_, source) => source }), { a: [2] });
});
