import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isNicknameAvailable,
  resendEmailCode,
  sendEmailCode,
  signInWithEmail,
  signInWithOAuthCode,
  signUp,
  signUpWithSocial,
  verifyEmailCode,
} from './authApi';

export const authKeys = {
  all: ['auth'] as const,
  nickname: (nickname: string) => [...authKeys.all, 'nickname-availability', nickname] as const,
};

/**
 * 로그인·가입에 성공하면 이전 사람이 남긴 캐시(보드 등)를 지운다.
 * 로그아웃 없이 세션이 끝난 뒤(재발급 실패) 다른 계정으로 들어와도 섞이지 않게 한다.
 */
function useResetUserData() {
  const queryClient = useQueryClient();
  return () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
}

/** 닉네임 중복 확인. 같은 닉네임을 다시 입력하면 30초 동안은 서버에 다시 묻지 않는다. */
export function useNicknameAvailabilityQuery(nickname: string, enabled: boolean) {
  return useQuery({
    queryKey: authKeys.nickname(nickname),
    queryFn: ({ signal }) => isNicknameAvailable(nickname, signal),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useEmailLoginMutation() {
  const reset = useResetUserData();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signInWithEmail(email, password),
    onSuccess: reset,
  });
}

export function useOAuthCodeLoginMutation() {
  const reset = useResetUserData();
  return useMutation({
    mutationFn: ({
      provider,
      ...input
    }: Parameters<typeof signInWithOAuthCode>[1] & { provider: string }) =>
      signInWithOAuthCode(provider, input),
    onSuccess: ({ status }) => {
      if (status === 'signedIn') reset();
    },
  });
}

export function useSocialSignupMutation() {
  const reset = useResetUserData();
  return useMutation({
    mutationFn: ({
      signupToken,
      marketingAgreed,
    }: {
      signupToken: string;
      marketingAgreed: boolean;
    }) => signUpWithSocial(signupToken, marketingAgreed),
    onSuccess: reset,
  });
}

export function useSendEmailCodeMutation() {
  return useMutation({ mutationFn: sendEmailCode });
}

export function useResendEmailCodeMutation() {
  return useMutation({ mutationFn: resendEmailCode });
}

export function useVerifyEmailCodeMutation() {
  return useMutation({
    mutationFn: ({ flowId, code }: { flowId: string; code: string }) =>
      verifyEmailCode(flowId, code),
  });
}

export function useEmailSignupMutation() {
  const reset = useResetUserData();
  return useMutation({ mutationFn: signUp, onSuccess: reset });
}
