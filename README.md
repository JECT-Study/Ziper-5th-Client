# Ziper-5th-Client

동일한 웹을 브라우저와 React Native WebView에서 사용하는 pnpm 모노레포입니다.

- `apps/ziper-mobile/`: Expo Router, React Native, Unistyles, Expo UI.
- `apps/ziper-web/`: TanStack Start/Router, React, Vanilla Extract.
- `packages/bridge/`: 버전별 계약, 기능 협상, 웹과 네이티브 구현 선택.

## 개발

Node 24 (`.node-version`)와 고정된 pnpm을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev:web
pnpm dev:mobile
```

상품 상세·상태 관리의 개발 프리뷰와 서버 API 조사 결과는 [JEC-23 안내](docs/jec-23-product-detail.md)를 참고하세요.

웹의 기본 포트는 3000입니다. 네이티브 앱의 개발 주소와 운영 HTTPS 설정은 [모바일 안내](apps/ziper-mobile/README.md)를 참고하세요.

## 검증

```sh
pnpm test
pnpm typecheck:bridge
pnpm typecheck:web
pnpm typecheck:mobile
pnpm lint
pnpm fmt
pnpm check
pnpm build:web
```

브릿지의 사용법과 인증 연결, 보안 및 검증 범위는 [브릿지 문서](packages/bridge/docs/bridge.md)를 참고하세요. 기본 앱에는 인증 SDK나 서버, 가짜 로그인 구현이 포함되어 있지 않습니다.
