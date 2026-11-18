import { describe, expect, it } from 'vitest';
import { allowedDocument, hostConfig, serviceURL } from './security';

describe('production web-host boundary (pure module)', () => {
  it('requires an explicit production HTTPS host and freezes configuration', () => {
    expect(() => hostConfig(undefined, false, 'ios')).toThrow('EXPO_PUBLIC_WEB_URL is required');
    expect(Object.isFrozen(hostConfig('https://service.example/app', false, 'ios'))).toBe(true);
  });
  it.each([
    'http://service.example',
    'javascript:alert(1)',
    'file:///x',
    'https://u:p@service.example',
    'https://service.example?secret=x',
    'https://service.example/#x',
    ' https://service.example',
    'https://service.example/a/../b',
    'https://service.example/a/%2e%2e/b',
    'https://service.example/a%2fb',
    'https://service.example/a\\b',
  ])('rejects invalid production config %s', (value) => {
    expect(() => hostConfig(value, false, 'ios')).toThrow();
  });
  it('uses platform development defaults only in development', () => {
    expect(serviceURL(hostConfig(undefined, true, 'ios'), '/')).toBe('http://localhost:3000/');
    expect(serviceURL(hostConfig(undefined, true, 'android'), '/')).toBe('http://10.0.2.2:3000/');
  });
  it.each([
    'localhost',
    '127.0.0.1',
    '[::1]',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.1',
    '192.168.0.8',
  ])('permits explicit development loopback/private LAN %s', (host) => {
    expect(serviceURL(hostConfig(`http://${host}:3000`, true, 'ios'), '/')).toBe(
      `http://${host}:3000/`,
    );
  });
  it.each([
    'example.com',
    'localhost.evil.test',
    '172.15.0.1',
    '172.32.0.1',
    '192.169.1.1',
    '0.0.0.0',
    '169.254.1.1',
  ])('rejects insecure public/unspecified development host %s', (host) => {
    expect(() => hostConfig(`http://${host}:3000`, true, 'android')).toThrow();
  });
  const config = hostConfig('https://service.example/app/', false, 'ios');
  it('builds service-relative URLs without dropping the configured path scope', () => {
    expect(serviceURL(config, '/items/3?q=hello#view')).toBe(
      'https://service.example/app/items/3?q=hello#view',
    );
    expect(allowedDocument(config, serviceURL(config, '/'))).toBe(true);
    expect(allowedDocument(config, 'https://service.example/app')).toBe(true);
    expect(allowedDocument(config, 'https://service.example/app/items?q=1')).toBe(true);
  });
  it.each([
    '//evil.test/x',
    'https://evil.test',
    'javascript:alert(1)',
    '/a\\b',
    '/../escape',
    '/%2e%2e/escape',
    '/%252e%252e/escape',
    '/a%2fb',
    '/%255c/evil',
    '/a%00b',
    '/a b',
    '/bad%escape',
  ])('rejects ambiguous/escaping service path %s', (path) => {
    expect(serviceURL(config, path)).toBeNull();
  });
  it.each([
    'https://evil.test/app',
    'https://service.example.evil.test/app',
    'http://service.example/app',
    'https://service.example:444/app',
    'https://u@service.example/app',
    'https://service.example/application',
    'https://service.example/other',
    'https://service.example/app/../other',
    'https://service.example/app/%2e%2e/other',
    'about:blank',
    'data:text/html,hello',
    'intent://x',
    'ziper://web',
    'https://service.example/app%2fother',
  ])('rejects privileged external/out-of-scope document %s', (url) => {
    expect(allowedDocument(config, url)).toBe(false);
  });
});
