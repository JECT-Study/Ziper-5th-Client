import { BridgeError } from '@ziper/bridge/contract';
import { expect, it } from 'vitest';
import { platformErrorMessage } from './platform-error';

it('distinguishes teardown and an uncertain result without exposing debug data', () => {
  expect(platformErrorMessage(new BridgeError('BRIDGE_CLOSED'))).toBeNull();
  expect(platformErrorMessage(new BridgeError('RESULT_UNKNOWN'))).toBe(
    '작업 결과를 확인하지 못했어요.',
  );
  expect(platformErrorMessage(new BridgeError('BRIDGE_NOT_READY'))).toBe('앱과 연결하지 못했어요.');
  expect(platformErrorMessage(new BridgeError('INVALID_REQUEST'))).toBe(
    '요청을 처리하지 못했어요.',
  );
  expect(platformErrorMessage(new Error('private details'))).toBe('요청을 처리하지 못했어요.');
});
