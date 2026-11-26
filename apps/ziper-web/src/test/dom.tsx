import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, vi } from 'vitest';
import { withQuery } from './query';

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(() => root!.unmount());
  root = null;
  container.remove();
  vi.unstubAllGlobals();
});

export async function render(node: ReactNode) {
  root = createRoot(container);
  await act(() => root!.render(withQuery(node)));
  return container;
}

export function field(label: string) {
  const element = [...document.querySelectorAll('label')].find((l) => l.textContent === label);
  return document.querySelector<HTMLInputElement>(
    element ? '#' + CSS.escape(element.htmlFor) : `[aria-label="${label}"]`,
  )!;
}

export function button(text: string) {
  return [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;
}

export async function type(label: string, value: string) {
  const input = field(label);
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export const click = (text: string) => act(async () => button(text).click());
