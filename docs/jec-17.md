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

`agent-browser`에서 Figma 375px 시안을 상태바 44px·홈 인디케이터 34px를 제외한 웹 영역(375 × 893)과 비교했습니다. 자동 추출 화면의 좌우 16px 여백, 81px 상품 이미지, 48px 저장 버튼과 보드 목록 5행을 확인했습니다. 공유 원본 URL은 읽기 전용이라 시안의 지우기 버튼은 표시하지 않으며, 보드 이름 입력에는 취소 버튼을 유지합니다. 카드 도안은 Figma의 그래픽 소스 프레임에서 투명 PNG로 내보냈고, 상품 프리뷰 이미지는 자동 추출 화면에서 잘라 재사용했습니다.

### 반응형

320 × 568부터 1440 × 900까지 7개 뷰포트에서 검증했습니다. 폼 본문만 스크롤하고 제목과 저장 버튼은 화면에 남습니다. 360px 미만에서는 태그·보드 입력 버튼을 다음 줄로 내려 입력 공간을 확보합니다. 태블릿·데스크톱에서는 480px 너비로 가운데 정렬하고, 카드 도안 다섯 개를 한 줄에 표시합니다. 보드 목록과 작은 화면의 카드 도안은 각 영역 안에서만 스크롤됩니다.

뷰포트별 전후 스크린샷·좌표 JSON과 재실행 스크립트는 `artifacts/jec-17/validation/responsive/`에 있습니다. `pnpm dev:web` 실행 후 `bash artifacts/jec-17/validation/responsive/check.sh`로 다시 확인할 수 있습니다.

이 작업 디렉터리에는 `artifacts/jec-17/validation/`에 브라우저 비교 PNG, 자동 추출 레이아웃 JSON, 접근성 스냅샷, 검증 스크립트와 Metro/prebuild 로그를 남겼습니다. 브라우저 세션을 다시 만들려면:

```sh
agent-browser session id --scope worktree --prefix jec17 > artifacts/jec-17/validation/browser-session.txt
bash artifacts/jec-17/validation/browser-preview.sh
```

### 인터랙션·디자인 시스템 점검

414 × 896 휴대폰, 768 × 1024 태블릿, 1280 × 900 데스크톱에서 자동 추출·수동 입력·결과 불명 상태를 확인했습니다. `/design-system`에서는 모달·바텀시트의 키보드 포커스와 Escape, 바깥 클릭, 로딩 버튼의 접근 가능한 이름, 320px 하단 내비게이션을 검증했습니다.

캡처·Figma 참조 PNG·검증 로그는 `artifacts/jec-17/validation/ui-audit/`에 있습니다. 개발 서버에서 `bash artifacts/jec-17/validation/ui-audit/check.sh`로 가격, 태그·보드 추가/취소, 이미지 업로드와 선택 복원, 모달·바텀시트 시나리오를 다시 확인할 수 있습니다.

## 남은 확인

신규 개발용 빌드를 설치한 iOS/Android 기기에서 쇼핑 앱·브라우저의 URL 단독/텍스트 혼합 공유, 앱 종료/실행 중 수신과 뒤로 가기를 확인합니다. 짧은 브라우저 뷰포트로 레이아웃을 점검했지만, 실제 WebView의 키보드·안전 영역 동작은 기기에서 별도로 확인합니다. iOS Share Extension 서명과 App Group이 필요합니다. Prebuild와 Metro export 성공은 네이티브 컴파일·서명이나 기기 검증을 대신하지 않습니다.
