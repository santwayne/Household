import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShares, computeBalances, suggestSettlements, KITTY, toMinor, MoneyError } from '../src/domain/money.js';

const ids = ['a', 'b', 'c'];

test('equal split sums exactly (largest remainder)', () => {
  const s = computeShares(1000, { type: 'equal' }, ids);
  assert.equal(Object.values(s).reduce((x, y) => x + y, 0), 1000);
  assert.deepEqual(Object.values(s).sort(), [333, 333, 334]);
});

test('custom split must add up', () => {
  assert.throws(() => computeShares(1000, { type: 'custom', shares: { a: 5, b: 4 } }, ids), MoneyError);
  const s = computeShares(1000, { type: 'custom', shares: { a: 5, b: 5 } }, ids);
  assert.deepEqual(s, { a: 500, b: 500 });
});

test('percent split and unknown members', () => {
  assert.deepEqual(computeShares(1000, { type: 'percent', percents: { a: 70, b: 30 } }, ids), { a: 700, b: 300 });
  assert.throws(() => computeShares(1000, { type: 'percent', percents: { a: 60, b: 30 } }, ids), MoneyError);
  assert.throws(() => computeShares(1000, { type: 'equal', members: ['zzz'] }, ids), MoneyError);
});

test('balances always sum to zero including kitty, and suggestions settle everything', () => {
  const l = {
    members: ids,
    contributions: [{ member: 'a', amount: toMinor(1000) }],
    purchases: [
      { payer: 'b', amount: toMinor(650), paidFrom: 'member' as const, shares: computeShares(toMinor(650), { type: 'equal' }, ids) },
      { payer: 'c', amount: toMinor(300), paidFrom: 'pool' as const, shares: computeShares(toMinor(300), { type: 'equal' }, ids) },
    ],
    settlements: [],
  };
  const net = computeBalances(l);
  assert.equal(Object.values(net).reduce((x, y) => x + y, 0), 0);
  const after = { ...net };
  for (const t of suggestSettlements(net)) { after[t.from] += t.amount; after[t.to] -= t.amount; }
  for (const v of Object.values(after)) assert.equal(v, 0);
  assert.ok(KITTY in net);
});

test('a settlement moves the balance toward zero', () => {
  const base = { members: ['a', 'b'], contributions: [], purchases: [{ payer: 'a', amount: 1000, paidFrom: 'member' as const, shares: { a: 500, b: 500 } }] };
  assert.equal(computeBalances({ ...base, settlements: [] }).b, -500);
  assert.equal(computeBalances({ ...base, settlements: [{ from: 'b', to: 'a', amount: 500 }] }).b, 0);
});
