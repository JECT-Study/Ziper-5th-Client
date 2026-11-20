import { logout as kakaoLogout } from '@react-native-seoul/kakao-login';
import NaverLogin from '@react-native-seoul/naver-login';
import { Platform } from 'react-native';
import { BridgeError, type NativeAuthService } from '@ziper/bridge/contract';
import { LoginCanceledError, socialLogin } from '../sdk/socialLogin';

// 백엔드 로그인과 토큰 보관은 웹이 맡는다. 앱은 SDK 토큰만 받아 브릿지의 교환 코드 자리에 담아 넘긴다.
// 웹 쪽 짝: apps/ziper-web/src/features/auth/model/bridgeAuth.ts
export const nativeAuth: NativeAuthService = {
  providers: Platform.OS === 'ios' ? ['naver', 'kakao', 'apple'] : ['naver', 'kakao'],
  async login({ provider }) {
    try {
      const credential = await socialLogin(provider);
      // 백엔드는 Apple 은 ID Token, 카카오·네이버는 Access Token 을 받는다.
      const token =
        credential.provider === 'apple' ? credential.identityToken : credential.accessToken;
      return { status: 'completed', handoffCode: JSON.stringify({ provider, token }) };
    } catch (error) {
      if (error instanceof LoginCanceledError) return { status: 'cancelled' };
      throw new BridgeError('AUTH_FAILED');
    }
  },
  async restore() {
    return { handoffCode: null };
  },
  async adopt() {},
  // SDK 세션도 끊어서 다음 로그인 때 계정을 다시 고를 수 있게 한다. 실패해도 웹 로그아웃은 이어간다.
  async logout() {
    await Promise.allSettled([kakaoLogout(), NaverLogin.logout()]);
  },
};
