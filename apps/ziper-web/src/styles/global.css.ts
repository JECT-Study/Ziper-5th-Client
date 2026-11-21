import { globalStyle } from '@vanilla-extract/css';
import { vars } from './theme.css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
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
