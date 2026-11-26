import { getEmailVerificationStatus, verifyEmailCode } from '@ziper/api';
import { ApiError } from '@ziper/api/http';
import { useMutation } from '@tanstack/react-query';

export type VerifyResult = 'verified' | 'mismatch' | 'locked';

/** 틀린 이유(오입력·잠김)는 실패 응답만으로 알 수 없어 상태를 다시 조회한다. */
export function useVerifyEmailCode() {
  return useMutation({
    mutationFn: async ({ flowId, code }: { flowId: string; code: string }) => {
      try {
        await verifyEmailCode(flowId, { code });
        return 'verified' as VerifyResult;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status >= 500) throw error;
      }
      const { data } = await getEmailVerificationStatus(flowId);
      return (
        data.lockedUntil || data.remainingAttempts <= 0 ? 'locked' : 'mismatch'
      ) as VerifyResult;
    },
  });
}
