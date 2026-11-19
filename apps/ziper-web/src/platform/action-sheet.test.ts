import { expect, it, vi } from 'vitest';
import { createWebSheets, type WebSheet } from './action-sheet';

const input = {
  title: 'Choose action',
  operationId: 'sheet',
  actions: [{ id: 'save', label: 'Save' }],
};

it('settles once and does not let a stale callback close a new sheet', async () => {
  const present = vi.fn<(sheet: WebSheet | null) => void>();
  const sheets = createWebSheets(present);
  const first = sheets.actions(input);
  const old = present.mock.lastCall![0]!;
  old.settle({ status: 'selected', actionId: 'save' });
  await expect(first).resolves.toEqual({ status: 'selected', actionId: 'save' });
  const second = sheets.actions(input);
  const current = present.mock.lastCall![0]!;
  old.settle({ status: 'cancelled' });
  expect(present.mock.lastCall![0]).toBe(current);
  current.settle({ status: 'cancelled' });
  await expect(second).resolves.toEqual({ status: 'cancelled' });
});

it('rejects invalid input, overlapping requests, abort and disposal; releases the slot on failure', async () => {
  const present = vi.fn<(sheet: WebSheet | null) => void>();
  const sheets = createWebSheets(present);
  await expect(sheets.actions({ ...input, actions: [] })).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
  });
  expect(present).not.toHaveBeenCalled();
  const first = sheets.actions(input);
  await expect(sheets.actions(input)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  present.mock.lastCall![0]!.failToOpen();
  await expect(first).rejects.toMatchObject({ code: 'INTERNAL' });

  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const second = sheets.actions(input, controller.signal);
  controller.abort();
  await expect(second).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  const third = sheets.actions(input);
  sheets.dispose();
  sheets.dispose();
  await expect(third).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  await expect(sheets.actions(input)).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  expect(present.mock.lastCall![0]).toBeNull();
});
