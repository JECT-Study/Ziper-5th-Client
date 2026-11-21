import { login as kakaoLogin } from '@react-native-seoul/kakao-login';
import NaverLogin from '@react-native-seoul/naver-login';
import * as AppleAuthentication from 'expo-apple-authentication';

export type LoginProvider = 'kakao' | 'naver' | 'apple';

// 카카오·네이버 SDK 는 인가 코드가 아니라 액세스 토큰을 준다. 백엔드가 이 토큰을 검증한다.
export type LoginCredential =
  | { provider: 'kakao' | 'naver'; accessToken: string }
  | { provider: 'apple'; identityToken: string; authorizationCode: string | null };

export class LoginCanceledError extends Error {}

// 앱을 켤 때가 아니라 처음 네이버 로그인을 누를 때 초기화한다.
let naverReady = false;
function initNaver() {
  if (naverReady) return;
  NaverLogin.initialize({
    appName: 'Ziper',
    consumerKey: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID ?? '',
    consumerSecret: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET ?? '',
    serviceUrlSchemeIOS: process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? '',
  });
  naverReady = true;
}

export async function socialLogin(provider: LoginProvider): Promise<LoginCredential> {
  switch (provider) {
    case 'kakao': {
      // 카카오톡이 설치돼 있으면 카카오톡으로, 없으면 카카오계정 웹 로그인으로 진행된다.
      try {
        const token = await kakaoLogin();
        return { provider, accessToken: token.accessToken };
      } catch (error) {
        // 카카오 SDK 는 취소를 따로 구분해 주지 않아 메시지로 판단한다.
        if (/cancel/i.test((error as Error).message ?? '')) throw new LoginCanceledError();
        throw error;
      }
    }
    case 'naver': {
      initNaver();
      const { isSuccess, successResponse, failureResponse } = await NaverLogin.login();
      if (isSuccess && successResponse)
        return { provider, accessToken: successResponse.accessToken };
      if (failureResponse?.isCancel) throw new LoginCanceledError();
      throw new Error(failureResponse?.message ?? '네이버 로그인에 실패했어요.');
    }
    case 'apple': {
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) throw new Error('Apple 토큰을 받지 못했어요.');
        return {
          provider,
          identityToken: credential.identityToken,
          authorizationCode: credential.authorizationCode,
        };
      } catch (error) {
        if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED')
          throw new LoginCanceledError();
        throw error;
      }
    }
  }
}
