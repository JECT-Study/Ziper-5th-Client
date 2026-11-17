// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished } from 'vitest';
import { mountWebView } from '../test/webview-fixture';

const lostCompletion = (source: string) =>
  /\.emit\((["'])[^"']+-[A-Za-z0-9]{21}\1[,)]/.test(source);

const eventCount = (window: any) =>
  Object.values(window.nativeEmitterMap ?? {}).reduce(
    (total: number, emitter: any) =>
      total +
      Object.values(emitter.events).reduce((n: number, callbacks: any) => n + callbacks.length, 0),
    0,
  );

describe('pinned WebView Bridge lifecycle', () => {
  it('restores the test environment if mounting fails', async () => {
    const global = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const before = global.IS_REACT_ACT_ENVIRONMENT;
    const children = [...document.body.childNodes];
    global.IS_REACT_ACT_ENVIRONMENT = false;
    onTestFinished(() => {
      global.IS_REACT_ACT_ENVIRONMENT = before;
      for (const child of Array.from(document.body.childNodes)) {
        if (!children.includes(child)) child.remove();
      }
    });
    const failure = new Error('mount failed');
    const error = await mountWebView({}, () => {
      throw failure;
    }).catch((reason: unknown) => reason);
    expect(error instanceof AggregateError ? error.errors : [error]).toContain(failure);
    expect(global.IS_REACT_ACT_ENVIRONMENT).toBe(false);
    expect([...document.body.childNodes]).toEqual(children);
  });
  it('uses real native and web artifacts for a successful roundtrip', async () => {
    const host = await mountWebView({ ping: async (input: unknown) => input });
    const client = host.web.linkBridge({ throwOnError: true });
    try {
      expect(await client.callNative('ping', [{ value: '실제 왕복' }])).toEqual({
        value: '실제 왕복',
      });
      expect(await client.callNative('ping', [null])).toBeNull();
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('releases ACK and completion listeners on 100 lost-result aborts', async () => {
    let executed = 0;
    const host = await mountWebView(
      {
        ping: async () => {
          executed++;
          return 'done';
        },
      },
      lostCompletion,
    );
    const client = host.web.linkBridge({ throwOnError: true });
    await host.flush();
    const baseline = eventCount(host.window);
    try {
      for (let i = 0; i < 100; i++) {
        const controller = new AbortController();
        const rejected = expect(
          client.callNative('ping', [], { signal: controller.signal }),
        ).rejects.toThrow('deadline');
        await host.flush();
        controller.abort(new Error('deadline'));
        await rejected;
        expect(eventCount(host.window)).toBe(baseline);
      }
      expect(executed).toBe(100);
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('cleans resolver listeners when the original ACK deadline expires', async () => {
    const host = await mountWebView({ ping: async () => new Promise(() => {}) }, () => true);
    const client = host.web.linkBridge({ throwOnError: true, timeout: 5 });
    const baseline = eventCount(host.window);
    try {
      await expect(client.callNative('ping', [])).rejects.toThrow('Timeout');
      expect(eventCount(host.window)).toBe(baseline);
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('aborting an already-aborted signal never dispatches an effect', async () => {
    let executed = 0;
    const host = await mountWebView({ ping: async () => ++executed });
    const client = host.web.linkBridge({ throwOnError: true });
    const controller = new AbortController();
    controller.abort(new Error('closed'));
    try {
      await expect(client.callNative('ping', [], { signal: controller.signal })).rejects.toThrow(
        'closed',
      );
      await host.flush();
      expect(executed).toBe(0);
    } finally {
      client.dispose();
      host.close();
    }
  });
  it('dispose rejects dispatched work and leaves another client operational', async () => {
    let started = false;
    const host = await mountWebView({
      wait: async () => {
        started = true;
        return new Promise(() => {});
      },
      ping: async () => 'alive',
    });
    const first = host.web.linkBridge({ throwOnError: true });
    const second = host.web.linkBridge({ throwOnError: true });
    const rejected = expect(first.callNative('wait', [])).rejects.toThrow('BRIDGE_CLOSED');
    await host.flush();
    expect(started).toBe(true);
    first.dispose();
    first.dispose();
    await rejected;
    try {
      expect(await second.callNative('ping', [])).toBe('alive');
      await expect(first.callNative('ping', [])).rejects.toThrow('BRIDGE_CLOSED');
      expect(Object.keys((host.window as any).nativeEmitterMap)).toHaveLength(1);
    } finally {
      second.dispose();
      host.close();
    }
  });
  it('removes visibility listeners and owned emitters on repeated client recreation', async () => {
    const host = await mountWebView({ ping: async () => 'ok' });
    const add = host.window.document.addEventListener.bind(host.window.document);
    const remove = host.window.document.removeEventListener.bind(host.window.document);
    const visibility = new Set<unknown>();
    host.window.document.addEventListener = ((
      name: string,
      listener: unknown,
      options: unknown,
    ) => {
      if (name === 'visibilitychange') visibility.add(listener);
      return (add as any)(name, listener, options);
    }) as typeof add;
    host.window.document.removeEventListener = ((
      name: string,
      listener: unknown,
      options: unknown,
    ) => {
      if (name === 'visibilitychange') visibility.delete(listener);
      return (remove as any)(name, listener, options);
    }) as typeof remove;
    try {
      for (let i = 0; i < 100; i++) {
        const client = host.web.linkBridge({ throwOnError: true });
        expect(await client.callNative('ping', [])).toBe('ok');
        client.dispose();
        expect(visibility.size).toBe(0);
        expect(Object.keys((host.window as any).nativeEmitterMap)).toHaveLength(0);
      }
    } finally {
      host.close();
    }
  });
});
