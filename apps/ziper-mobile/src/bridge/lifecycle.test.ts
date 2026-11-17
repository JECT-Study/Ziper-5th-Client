import { describe, expect, it, vi } from 'vitest';
import { success, type SheetInput } from '@ziper/bridge/contract';
import { backTarget, interceptNativeBack } from './back';
import { OperationLedger } from './operations';
import { SheetSessions } from './sheets';

const input: SheetInput = {
  title: 'Actions',
  operationId: 'sheet-1',
  actions: [{ id: 'save', label: 'Save' }],
};
describe('bounded per-screen operation ledger', () => {
  it('coalesces pending and completed retries and rejects conflicts across methods/payloads', async () => {
    const ledger = new OperationLedger();
    const action = vi.fn(async () => success({ handled: true }));
    const a = ledger.run('id', 'push:/a', action);
    expect(ledger.run('id', 'push:/a', action)).toBe(a);
    expect(await ledger.run('id', 'replace:/a', action)).toEqual({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    await a;
    expect(await ledger.run('id', 'push:/a', action)).toEqual(success({ handled: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('expires settled entries at TTL and enforces count without evicting pending work', async () => {
    let now = 0;
    const ledger = new OperationLedger(2, 100, () => now);
    const action = vi.fn(async () => success(true));
    await ledger.run('a', 'a', action);
    now = 99;
    await ledger.run('a', 'a', action);
    expect(action).toHaveBeenCalledTimes(1);
    now = 100;
    await ledger.run('a', 'a', action);
    expect(action).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 100; i++) await ledger.run(String(i), String(i), action);
    expect(ledger.size).toBe(2);
    ledger.clear();
    const pending = () => new Promise<ReturnType<typeof success<boolean>>>(() => {});
    ledger.run('pending-a', 'a', pending);
    ledger.run('pending-b', 'b', pending);
    now += 100_000;
    expect(await ledger.run('overflow', 'c', action)).toEqual({
      ok: false,
      error: { code: 'PERMISSION_DENIED' },
    });
    expect(ledger.size).toBe(2);
    ledger.clear();
    expect(ledger.size).toBe(0);
  });
  it('sanitizes unexpected errors', async () => {
    const ledger = new OperationLedger();
    expect(
      await ledger.run('a', 'a', async () => {
        throw new Error('secret');
      }),
    ).toEqual({ ok: false, error: { code: 'INTERNAL' } });
  });
});

describe('screen-scoped sheet promise sessions', () => {
  it('selects once and ignores dismiss/back callbacks from the old session', async () => {
    let token = 0;
    const sheets = new SheetSessions((snapshot) => {
      if (snapshot) token = snapshot.token;
    });
    const first = sheets.open(input);
    const old = token;
    expect(sheets.settle(old, 'unknown')).toBe(false);
    expect(sheets.settle(old, 'save')).toBe(true);
    expect(sheets.settle(old)).toBe(false);
    expect(await first).toEqual(success({ status: 'selected', actionId: 'save' }));
    const second = sheets.open({ ...input, operationId: 'second' });
    expect(sheets.settle(old)).toBe(false);
    expect(sheets.active).toBe(true);
    expect(sheets.cancel()).toBe(true);
    expect(sheets.cancel()).toBe(false);
    expect(await second).toEqual(success({ status: 'cancelled' }));
  });
  it('handles native swipe/back dismissal, rejects concurrent sheets, and settles on unmount', async () => {
    let token = 0;
    const changed = vi.fn((snapshot) => {
      if (snapshot) token = snapshot.token;
    });
    const sheets = new SheetSessions(changed);
    const first = sheets.open(input);
    expect((await sheets.open(input)).ok).toBe(false);
    sheets.settle(token);
    expect(await first).toEqual(success({ status: 'cancelled' }));
    const second = sheets.open(input);
    changed.mockClear();
    sheets.dispose();
    expect(await second).toEqual(success({ status: 'cancelled' }));
    expect(changed).not.toHaveBeenCalled();
    expect(sheets.settle(token, 'save')).toBe(false);
    expect((await sheets.open(input)).ok).toBe(false);
  });
  it('does not dismiss another originating screen', async () => {
    const a = new SheetSessions(() => {}),
      b = new SheetSessions(() => {});
    const first = a.open(input),
      second = b.open(input);
    a.cancel();
    expect(b.active).toBe(true);
    b.dispose();
    await Promise.all([first, second]);
  });
});

describe('hardware/header/swipe policy', () => {
  it.each([
    [true, 3, true, 'sheet'],
    [true, 0, false, 'sheet'],
    [false, 2, true, 'web'],
    [false, 1, false, 'web'],
    [false, 0, true, 'native'],
    [false, 0, false, 'root'],
  ] as const)('orders sheet=%s depth=%s native=%s -> %s', (sheet, depth, native, target) => {
    expect(backTarget(sheet, depth, native)).toBe(target);
    expect(interceptNativeBack(sheet, depth)).toBe(sheet || depth > 0);
  });
});
