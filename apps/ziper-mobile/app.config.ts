import type { ConfigContext, ExpoConfig } from 'expo/config';

// 네이티브 설정에 들어가는 키라서 값이 바뀌면 `expo run:ios` / `expo run:android` 로 다시 빌드해야 한다.
const kakaoNativeAppKey = process.env.KAKAO_NATIVE_APP_KEY ?? '';
const naverUrlScheme = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ios: { ...config.ios, usesAppleSignIn: true },
  // 빌드 번호는 app.json 의 ios.buildNumber 한 곳에서만 올리고, Android 는 같은 값을 따른다.
  android: { ...config.android, versionCode: Number(config.ios?.buildNumber) },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: { extraMavenRepos: ['https://devrepo.kakao.com/nexus/content/groups/public/'] },
        // 개발 빌드의 네트워크 검사기가 카카오 SDK(Alamofire) 통신을 가로채면 iOS 앱이 죽는다.
        ios: { networkInspector: false },
      },
    ],
    ['@react-native-seoul/kakao-login', { kakaoAppKey: kakaoNativeAppKey }],
    ['@react-native-seoul/naver-login', { urlScheme: naverUrlScheme }],
    'expo-apple-authentication',
    ['./plugins/withSocialLoginUrls', { naverScheme: naverUrlScheme }],
  ],
});
