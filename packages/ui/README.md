# @ziper/ui

앱에서 사용하는 디자인 시스템 UI 워크스페이스다. 공통 루트에서 DOM과 RN을 함께 export하지 않는다.

| 진입점                    | 컴포넌트와 소유권                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `@ziper/ui/web`           | HTML `Button`. HTML 이벤트와 submit을 유지한다. 아이콘·스피너는 React 노드로 받을 수 있다.         |
| `@ziper/ui/web/theme.css` | Vanilla Extract `vars`·`typography`. 소스 소비 시 Vanilla Extract를 처리하는 빌드 도구가 필요하다. |
| `@ziper/ui/native`        | RN `Button`. `label`과 `onPress`, RN 접근성 상태를 사용한다. 웹 CSS를 import하지 않는다.           |

두 Button은 `destructive`, `disabled`와 [토큰](../design-tokens/src/tokens.ts)을 공유한다. 네이티브는 시트에서 쓰는 기본 크기의 보조 버튼만 제공한다. 크기·변형·로딩은 실제로 쓰는 웹에서만 제공한다. 웹 화면은 앱의 등록된 SVG를 사용하는 기존 Button 어댑터를 사용하며, 클릭 가능한 요소의 커서는 웹 앱 전역 스타일에서 지정한다. 웹 테마 엔트리는 같은 CSS 변수를 앱과 버튼이 중복 정의하지 않기 위해 유지한다. Footer·Icon·시트와 브릿지는 소유 앱에 남는다.

두 앱의 타입 검사·테스트, Nitro 프로덕션 빌드와 iOS/Android Metro 번들로 패키지 엔트리를 검증한다. [스택과 실기기 재현 절차](../../docs/jec-24-stack.md)를 참고한다.
