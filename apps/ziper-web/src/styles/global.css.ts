import { globalStyle } from '@vanilla-extract/css';
import { vars } from './theme.css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
});

// 모바일 WebView 는 누른 요소에 회색 강조를 깜빡 띄운다. 누름 상태는 각 컴포넌트가 직접 그린다.
globalStyle('html', {
  WebkitTapHighlightColor: 'transparent',
});

const clickable =
  ':where(a[href], button, summary, select, input:is([type="button"], [type="submit"], [type="reset"], [type="checkbox"], [type="radio"], [type="file"]), [role="button"], [role="link"], [role="tab"])';

globalStyle(`${clickable}:not(:disabled, [aria-disabled="true"])`, { cursor: 'pointer' });
globalStyle(`${clickable}:is(:disabled, [aria-disabled="true"])`, { cursor: 'default' });
globalStyle(
  'label:has(input:is([type="checkbox"], [type="radio"], [type="file"]):enabled:not([aria-disabled="true"]))',
  {
    cursor: 'pointer',
  },
);

globalStyle('body', {
  margin: 0,
  backgroundColor: vars.color.background,
  color: vars.color.text.strong,
  fontFamily: vars.font.family,
  // 앱 WebView 가 노치·홈 인디케이터 영역까지 그리므로 안전 영역만큼 띄운다.
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'env(safe-area-inset-bottom)',
});
