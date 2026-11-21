// 카카오·네이버 SDK 가 앱으로 돌려주는 로그인 결과 주소를 SDK 에 넘긴다.
// Expo SDK 58 부터 iOS 는 들어오는 주소를 SceneDelegate 로 받는데, 두 SDK 의 플러그인은 예전처럼
// AppDelegate 에만 코드를 넣으려다 실패한다. 그러면 결과가 SDK 에 닿지 않아 로그인 Promise 가 끝나지 않는다.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARK = '// withSocialLoginUrls';

function sceneDelegateCode(naverScheme) {
  return `
  ${MARK}
  override func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    var others = Set<UIOpenURLContext>()
    for context in URLContexts {
      let url = context.url
      if kakao_login.RNKakaoLogins.isKakaoTalkLoginUrl(url) {
        _ = kakao_login.RNKakaoLogins.handleOpen(url)
      } else if url.scheme == "${naverScheme}" {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        if let source = context.options.sourceApplication { options[.sourceApplication] = source }
        _ = NaverThirdPartyLoginConnection.getSharedInstance().application(
          UIApplication.shared, open: url, options: options)
      } else {
        others.insert(context)
      }
    }
    if !others.isEmpty { super.scene(scene, openURLContexts: others) }
  }
`;
}

module.exports = function withSocialLoginUrls(config, { naverScheme }) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName,
        'SceneDelegate.swift',
      );
      let contents = fs.readFileSync(file, 'utf8');
      if (contents.includes(MARK)) return cfg;
      contents = contents.replace(
        'internal import Expo',
        'internal import Expo\nimport kakao_login\nimport NaverThirdPartyLogin',
      );
      const anchor = '  // Extension point for config plugins.';
      if (!contents.includes(anchor))
        throw new Error(
          'withSocialLoginUrls: SceneDelegate.swift 모양이 바뀌었어요. 플러그인을 확인하세요.',
        );
      contents = contents.replace(anchor, `${anchor}\n${sceneDelegateCode(naverScheme)}`);
      fs.writeFileSync(file, contents);
      return cfg;
    },
  ]);
};
