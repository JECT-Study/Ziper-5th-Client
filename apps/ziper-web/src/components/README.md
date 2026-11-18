# 디자인 시스템

Figma [`[BE] 6팀`](https://www.figma.com/design/aofNB0TCRM7yMND4bLj0ih/-BE--6%ED%8C%80)의 **Design_필수산출물_디자인시스템** 페이지를 웹(`apps/ziper-web`)으로 옮겼습니다.
모든 컴포넌트는 개발 서버의 [`/design-system`](http://localhost:3000/design-system)에서 볼 수 있습니다.

## 어디에 있나요

| 구분                                 | 위치                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| 토큰(색, 글꼴, 간격, 모서리, 그림자) | `src/styles/theme.css.ts`                                           |
| 컴포넌트                             | `src/components/*.tsx` (스타일은 같은 이름의 `.css.ts`)             |
| 아이콘 SVG                           | `src/assets/icons/`                                                 |
| 로고와 컴포넌트 이미지               | `src/assets/brand/`, `src/assets/components/`, `src/assets/social/` |

```ts
import { Button, TextField } from '../components';
import { typography, vars } from '../styles/theme.css';
```

## 토큰

`createGlobalTheme(':root', ...)`로 CSS 변수를 만들고 코드에서는 `vars.*`로 사용합니다.

| 토큰        | Figma 출처                                                                            | 코드                                                                                       |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 기본 팔레트 | Color 프레임 변수 (`colorGray*`, `lime/*`, `red/*`, `blue/*`, `yellow/*`, `orange/*`) | `vars.palette.gray900`, `vars.palette.lime300` …                                           |
| 의미 색     | Color 프레임 변수 (`primary/default`, `text/strong`, `divider/default` …)             | `vars.color.primary.default`, `vars.color.text.strong` …                                   |
| 글꼴        | Typography 프레임 변수 12개 + 컴포넌트에서 쓰는 `Subtitle_1_semibold`                 | `typography.title3Bold` 등을 `style()` 안에 펼쳐서 사용                                    |
| 간격        | Spacing 프레임 설명 "4배수, 16 이하는 2배수 허용"                                     | `vars.space[16]` (키 = px)                                                                 |
| 모서리      | radius 프레임 설명 "4 / 8 / 12 / 16"                                                  | `vars.radius.xs`, `vars.radius.s`, `vars.radius.m`, `vars.radius.l` (시트 24, `full` 포함) |
| 그림자      | 컴포넌트 효과 `shadow/default`                                                        | `vars.shadow.default`                                                                      |

화면 코드에서는 **의미 색(`vars.color`)을 먼저** 쓰고, 맞는 이름이 없을 때만 `vars.palette`를 사용합니다.

## 컴포넌트

| Figma                                                                                   | 코드                      | 주요 props                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Button (Primary, Secondary / Large, Medium, Small / Active, Pressed, Disabled, Loading) | `Button`                  | `variant`, `size`, `loading`, `disabled`, `leftIcon`, `rightIcon`                                              |
| textField (밑줄형, 8가지 상태)                                                          | `TextField`               | `label`, `helperText`, `error`, `success`, `showCounter`+`maxLength`, `onClear`, `trailing`, `type="password"` |
| singleLineTextField (테두리형)                                                          | `TextField variant="box"` | 위와 같음                                                                                                      |
| checkBox                                                                                | `Checkbox`                | 기본 `<input type="checkbox">` 속성 + `children`(문구)                                                         |
| chips_filter                                                                            | `ChipFilter`              | `selected`                                                                                                     |
| segmentedControls                                                                       | `SegmentedControl`        | `items`, `value`, `onChange`                                                                                   |
| divider (SM, MD / default, strong)                                                      | `Divider`                 | `size`, `tone`                                                                                                 |
| header_main                                                                             | `HeaderMain`              | `right`                                                                                                        |
| header_sub                                                                              | `HeaderSub`               | `title`, `onBack`, `right`                                                                                     |
| footer (single, split, stack)                                                           | `Footer`, `ButtonGroup`   | `layout`                                                                                                       |
| modal/default                                                                           | `Modal`                   | `open`, `title`, `description`, `onClose`, `actions`, `actionsLayout`                                          |
| bottomSheet                                                                             | `BottomSheet`             | `open`, `title`, `onClose`, `footer`                                                                           |
| Toast                                                                                   | `Toast`                   | 문구(children)                                                                                                 |
| bottom_navigation                                                                       | `BottomNavigation`        | `active`, `onSelect`, `onAdd` (해당 콜백이 없으면 비활성)                                                      |
| NAVER, kakao, apple 로그인                                                              | `SocialLoginButton`       | `provider`                                                                                                     |
| icon (25개)                                                                             | `Icon`, `Spinner`         | `name`, `size`, `label`                                                                                        |

## 옮긴 방법

1. **토큰**: Figma MCP `get_variable_defs`로 Color와 Typography 프레임에 연결된 변수 값을 읽어 옮겼습니다. Spacing과 radius 프레임에는 연결된 변수가 없어 설명 문구와 견본 크기(2~72px, 4/8/12/16)를 기준으로 만들었습니다.
2. **컴포넌트**: `get_design_context`로 높이, 여백, 모서리, 글꼴, 상태별 색을 읽어 vanilla-extract와 토큰으로 작성했습니다. Pressed, Focused, Disabled처럼 브라우저가 알 수 있는 상태는 `:active`, `:focus-within`, `:disabled`로, Loading, Error, Completed 상태는 props로 표현했습니다.
3. **아이콘**: `download_assets`로 24×24 SVG를 받은 뒤 Figma 캔버스 배경을 제거하고 색을 `currentColor`로 바꿨습니다. `Icon`은 SVG를 CSS 마스크로 칠하므로 부모의 `color`를 따라갑니다.
4. **확인**: `/design-system` 페이지를 375px로 찍어 Figma 스크린샷과 비교했습니다.

## Figma와 다르거나 옮기지 않은 것

- **옮기지 않음**: `[iOS] statusbar_new`, `[iOS] homeindicator_new`, `[iOS] Keyboard`는 기기 화면 요소이므로 앱이나 OS가 그립니다.
- **Button Large Secondary Loading** 배경은 Figma에서 `#ebebeb`(tertiary)이지만, Color 표에 없는 토큰이라 Secondary 기본색으로 맞췄습니다.
- **bottomSheet 손잡이 색** `#f3f4f6`, **카카오 노랑** `#fee500`, **네이버 테두리** `rgba(0,0,0,0.15)`는 Color 표에 없어 각 컴포넌트 스타일에만 적었습니다.
- **status/positive**(`#5cd100`)는 Color 표에 없고 텍스트 필드 완료 도움말에서만 쓰여서 `vars.color.status.positive`로 추가했습니다.
- **Modal, BottomSheet**는 브라우저의 `<dialog>`에서 포커스를 관리합니다. Escape는 `onClose`를 호출하고, 바텀시트는 바깥을 클릭해도 닫힙니다. **Toast**의 표시 위치와 지속 시간은 사용하는 화면에서 정합니다.
- Figma의 버튼 너비 335px는 화면 너비에 맞춘 값이라, Large와 Medium은 부모 너비를 채우도록 했습니다.
