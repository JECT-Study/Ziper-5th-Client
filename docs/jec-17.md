# JEC-17 로컬 검증

## 실행

`pnpm dev:web` 실행 후 [자동 추출 프리뷰](http://localhost:3000/share-product?preview=auto) 또는 [수동 입력 프리뷰](http://localhost:3000/share-product?preview=manual)를 엽니다. `unsupported`, `offline`, `auth`, `duplicate`, `failed`, `unknown`으로 예외 화면도 확인할 수 있습니다. 프리뷰는 개발 서버 전용이며 데이터를 저장하지 않습니다.

네이티브에서 받은 링크는 WebView 브릿지로만 전달됩니다. 서버 계약이 아직 없으므로 실제 공유 진입에서는 받은 링크와 안내만 표시하고 저장 버튼을 비활성화합니다. 입력이 가능한 저장 폼은 개발 프리뷰에서 확인합니다. [API 경계](../packages/api/README.md), [모바일 안내](../apps/ziper-mobile/README.md)를 참고하세요.

## 디자인 비교

[Figma 외부 공유 섹션](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih/-BE--6%ED%8C%80?node-id=684-2085)의 로컬 캐시는 `artifacts/jec-17/figma/`에 있으며 Git으로 관리하지 않습니다:

| 파일                 | Figma 노드                |
| -------------------- | ------------------------- |
| `external-share.xml` | `684:2085` 화면·주석 구조 |
| `auto.png`           | `707:7327` 자동 추출      |
| `manual.png`         | `707:7398` 수동 입력      |
| `boards.png`         | `837:10125` 보드 추가     |

`agent-browser`에서 375px 너비로 화면을 캡처해 비교합니다. Figma의 OS 상태바·키보드·홈 인디케이터는 웹에서 재현하지 않습니다. 공유 원본 URL은 이 화면에서 읽기 전용입니다. 카드 도안은 수동 입력 화면에서, 상품 프리뷰 이미지는 자동 추출 화면에서 잘라 재사용했습니다.

이 작업 디렉터리에는 `artifacts/jec-17/validation/`에 브라우저 비교 PNG, 자동 추출 레이아웃 JSON, 접근성 스냅샷, 검증 스크립트와 Metro/prebuild 로그를 남겼습니다. 브라우저 세션을 다시 만들려면:

```sh
agent-browser session id --scope worktree --prefix jec17 > artifacts/jec-17/validation/browser-session.txt
bash artifacts/jec-17/validation/browser-preview.sh
```

## 남은 확인

신규 개발용 빌드를 설치한 iOS/Android 기기에서 쇼핑 앱·브라우저의 URL 단독/텍스트 혼합 공유, 앱 종료/실행 중 수신과 뒤로 가기를 확인합니다. iOS Share Extension 서명과 App Group이 필요합니다. Prebuild와 Metro export 성공은 네이티브 컴파일·서명이나 기기 검증을 대신하지 않습니다.
