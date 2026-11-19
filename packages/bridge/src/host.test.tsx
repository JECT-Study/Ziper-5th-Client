// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { mountWebView } from '../test/webview-fixture';
import { createHandlers } from '../../../apps/ziper-mobile/src/bridge/handlers';
import { createDelegate } from '../../../apps/ziper-mobile/src/bridge/delegate';
import { createHostMiddleware } from '../../../apps/ziper-mobile/src/bridge/middleware';
import { hostConfig } from '../../../apps/ziper-mobile/src/bridge/security';
import { SheetSessions } from '../../../apps/ziper-mobile/src/bridge/sheets';
import { capability, success } from './contract';

const id = 'A'.repeat(21);

async function productionHost() {
  const navigate = vi.fn();
  const config = hostConfig('https://app.example.test', false, 'ios');
  const sheets = new SheetSessions(() => {});
  const handlers = createHandlers({
    config,
    platform: 'ios',
    appVersion: '1',
    active: () => true,
    navigate,
    back: () => false,
    setDepth: () => {},
    sheets,
  });
  const host = await mountWebView({}, () => false, {
    delegate: createDelegate(handlers.invoke),
    middleware: createHostMiddleware(() => config),
  });
  const client = host.web.linkBridge({ throwOnError: true });
  onTestFinished(() => {
    client.dispose();
    handlers.dispose();
    host.close();
  });
  return { navigate, client, sheets, flush: host.flush };
}

describe('production native declarations, middleware and protocol boundary', () => {
  it.each([
    '{',
    '[]',
    'null',
    'true',
    JSON.stringify({
      type: 'bridge',
      bridgeId: "';window.attacked=true;//",
      body: { method: 'ping', args: [], eventId: id },
    }),
    JSON.stringify({
      type: 'bridge',
      bridgeId: id,
      body: { method: "ping');window.attacked=true;//", args: [], eventId: id },
    }),
    JSON.stringify({
      type: 'bridge',
      bridgeId: id,
      body: { method: 'ping', args: {}, eventId: id },
    }),
    JSON.stringify({ type: 'requestHydrate', bridgeId: "';window.attacked=true;//" }),
    'x'.repeat(262145),
  ])('rejects malformed or malicious frame %# before execution or injection', async (raw) => {
    const called = vi.fn(async () => 'ok');
    const host = await mountWebView({ ping: called });
    await host.flush();
    const client = host.web.linkBridge({ throwOnError: true });
    await host.flush();
    let wire = raw;
    try {
      const frame = JSON.parse(raw);
      if (frame && typeof frame === 'object' && !Array.isArray(frame))
        wire = JSON.stringify({
          ...frame,
          documentId: (host.window as any).__webviewBridgeDocumentId,
        });
    } catch {
      /* malformed raw bytes must reach the real parser unchanged */
    }
    const before = host.injections.length;
    try {
      await host.sendRaw(wire);
      await host.flush();
      expect(called).not.toHaveBeenCalled();
      expect(host.injections.length).toBe(before);
      expect((host.window as any).attacked).toBeUndefined();
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('quotes exported emitter identifiers and never sends scoped data to another emitter/queue', async () => {
    const host = await mountWebView({});
    const event = "');window.attacked=true;//";
    const emitter = { emit: vi.fn() };
    Object.assign(host.window, { nativeEmitterMap: { [event]: emitter } });
    try {
      host.window.eval(host.native.SAFE_NATIVE_EMITTER_EMIT_BY_BRIDGE_ID(event, event, 'secret'));
      expect(emitter.emit).toHaveBeenCalledWith(event, 'secret');
      expect((host.window as any).attacked).toBeUndefined();
      const queued = JSON.stringify((host.window as any).nativeBatchedEvents);
      const other = { emit: vi.fn() };
      Object.assign(host.window, { nativeEmitter: other, nativeEmitterMap: {} });
      host.window.eval(
        host.native.SAFE_NATIVE_EMITTER_EMIT_BY_BRIDGE_ID(id, 'old', 'handoff-secret'),
      );
      host.window.eval(host.native.SAFE_NATIVE_EMITTER_THROW_BY_BRIDGE_ID(id, 'old', true));
      expect(other.emit).not.toHaveBeenCalled();
      expect(JSON.stringify((host.window as any).nativeBatchedEvents)).toBe(queued);
    } finally {
      host.close();
    }
  });
  it('mounts the actual native declaration, production delegate and security middleware', async () => {
    const { navigate, client } = await productionHost();
    const info: any = await client.callNative('getBridgeInfoV1', []);
    expect(info.value.capabilities).toContain(capability.sheet);
    expect(info.value.capabilities).not.toContain(capability.login('kakao'));
    expect(
      await client.callNative('authLoginV1', [{ provider: 'kakao', transactionId: 't' }]),
    ).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED' } });
    expect(
      await client.callNative('navigationPushV1', [{ path: '/detail', operationId: 'one' }]),
    ).toEqual({ ok: true, value: { handled: true } });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('push', '/detail');
    expect(
      await client.callNative('navigationPushV1', [{ path: '//evil.test', operationId: 'evil' }]),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(await client.callNative('getBridgeInfoV1', [null] as never)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
  });
  it('round-trips the native sheet selection through the real declaration and host middleware', async () => {
    const { client, sheets, flush } = await productionHost();
    const request = {
      title: '작업 선택',
      operationId: 'one',
      actions: [{ id: 'save', label: '저장' }],
    };
    const first = client.callNative('sheetActionsV1', [request]);
    const same = client.callNative('sheetActionsV1', [request]);
    await flush();
    expect(sheets.active).toBe(true);
    expect(sheets.settle(1, 'save')).toBe(true);
    const selected = success({ status: 'selected', actionId: 'save' });
    await expect(Promise.all([first, same])).resolves.toEqual([selected, selected]);
    expect(sheets.active).toBe(false);
  });

  it('drops an old async completion after replacing the same native WebView document', async () => {
    let finish!: (value: string) => void;
    let started = false;
    const host = await mountWebView({
      wait: async () => {
        started = true;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      },
      ping: async () => 'new document',
    });
    const previous = host.web.linkBridge({ throwOnError: true });
    const rejected = expect(previous.callNative('wait', [])).rejects.toThrow('BRIDGE_CLOSED');
    await host.flush();
    expect(started).toBe(true);
    previous.dispose();
    await rejected;
    host.replaceDocument();
    const current = host.web.linkBridge({ throwOnError: true });
    try {
      const before = host.injections.length;
      finish('old-private-handoff');
      await host.flush();
      expect(
        host.injections.slice(before).some((source) => source.includes('old-private-handoff')),
      ).toBe(false);
      expect(await current.callNative('ping', [])).toBe('new document');
      expect((host.window as any).nativeBatchedEvents).toEqual([]);
    } finally {
      current.dispose();
      host.close();
    }
  });
  it('preserves pending work through Android-style same-document history load-start events', async () => {
    let finish!: (value: string) => void;
    const host = await mountWebView({
      wait: async () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    const client = host.web.linkBridge({ throwOnError: true });
    try {
      const pending = client.callNative('wait', []);
      await host.flush();
      host.historyChange();
      finish('same document result');
      expect(await pending).toBe('same document result');
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('keeps two production native hosts and their navigation effects isolated', async () => {
    const first = await productionHost();
    const second = await productionHost();
    await Promise.all([
      first.client.callNative('navigationPushV1', [{ path: '/first', operationId: 'same' }]),
      second.client.callNative('navigationPushV1', [{ path: '/second', operationId: 'same' }]),
    ]);
    expect(first.navigate).toHaveBeenCalledExactlyOnceWith('push', '/first');
    expect(second.navigate).toHaveBeenCalledExactlyOnceWith('push', '/second');
  });
});
