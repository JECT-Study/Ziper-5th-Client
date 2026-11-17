// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createWebSheets } from './action-sheet';

const input = {
  title: 'Choose action',
  operationId: 'sheet',
  actions: [
    { id: 'save', label: 'Save' },
    { id: 'delete', label: 'Delete', destructive: true },
  ],
};
afterEach(() => {
  document.body.replaceChildren();
});

it('opens an accessible modal, selects once, removes it and restores focus', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const focus = vi.spyOn(trigger, 'focus');
  const sheets = createWebSheets(document);
  const result = sheets.actions(input);
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
    input.title,
  );
  const save = dialog.querySelector('button')!;
  expect(document.activeElement).toBe(save);
  save.click();
  save.click();
  sheets.dispose();
  await expect(result).resolves.toEqual({ status: 'selected', actionId: 'save' });
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(focus).toHaveBeenCalledOnce();
});

it('opens and settles without the secure-context-only randomUUID API', async () => {
  const uuid = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    throw new Error('randomUUID unavailable on development HTTP');
  });
  const sheets = createWebSheets(document);
  try {
    const result = sheets.actions(input);
    document.querySelector<HTMLButtonElement>('dialog button')?.click();
    await expect(result).resolves.toEqual({ status: 'selected', actionId: 'save' });
    expect(uuid).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')).toBeNull();
  } finally {
    sheets.dispose();
  }
});

it.each(['cancel', 'escape', 'button', 'close'])(
  'cancels on %s and cleans up exactly once',
  async (mode) => {
    const sheets = createWebSheets(document);
    const promise = sheets.actions(input);
    const dialog = document.querySelector('dialog')!;
    if (mode === 'escape')
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    else if (mode === 'button') (dialog.lastElementChild as HTMLButtonElement).click();
    else dialog.dispatchEvent(new Event(mode, { cancelable: true }));
    await expect(promise).resolves.toEqual({ status: 'cancelled' });
    expect(document.querySelector('dialog')).toBeNull();
    sheets.dispose();
  },
);

it('rejects abort/disposal, detaches abort listeners, and rejects overlapping sheets', async () => {
  const sheets = createWebSheets(document);
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const first = sheets.actions(input, controller.signal);
  await expect(sheets.actions(input)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  controller.abort();
  await expect(first).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  const second = sheets.actions(input);
  sheets.dispose();
  sheets.dispose();
  await expect(second).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  await expect(sheets.actions(input)).rejects.toMatchObject({ code: 'BRIDGE_CLOSED' });
  expect(document.querySelector('dialog')).toBeNull();
});
