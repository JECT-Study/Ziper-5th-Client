import { BridgeError } from '@ziper/bridge/contract';

export function platformErrorMessage(error: unknown): string | null {
  switch (error instanceof BridgeError ? error.code : undefined) {
    case 'BRIDGE_CLOSED':
      return null;
    case 'BRIDGE_NOT_READY':
      return '앱과 연결하지 못했어요.';
    case 'RESULT_UNKNOWN': // Not safe to retry automatically.
      return '작업 결과를 확인하지 못했어요.';
    default:
      return '요청을 처리하지 못했어요.';
  }
}
