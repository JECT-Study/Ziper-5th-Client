// body 가 safe-area 만큼 위아래 여백을 주므로(global.css.ts), 화면을 채우는 높이는 그만큼 뺀다.
// 그냥 100dvh 를 쓰면 앱 WebView 에서 아래쪽 버튼이 홈 인디케이터 밑으로 밀린다.
export const viewportHeight =
  'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))';
