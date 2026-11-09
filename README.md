# Ziper-5th-Client

WebView 기반으로 웹과 네이티브를 분리하는 pnpm 모노레포입니다.

- `apps/ziper-mobile/`: Expo, React Native, Unistyles 기반의 모바일 앱입니다.
- `apps/ziper-web/`: TanStack Start, TanStack Router, Vanilla Extract 기반의 웹 앱입니다.

## 개발

Node 24 (`.node-version`)와 `package.json`에 고정된 pnpm을 사용합니다. 의존성 설치 후 기존 개발 명령을 사용합니다.

```sh
pnpm lint
pnpm fmt
pnpm check
pnpm --filter ziper-mobile typecheck
```
