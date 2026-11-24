import { globalStyle, style } from '@vanilla-extract/css';
import { typography, vars } from './global.css';

// 약관 본문(src/content/terms/*.md)을 읽기 좋게 보여주는 문서 스타일.
export const page = style({
  maxWidth: 720,
  margin: '0 auto',
  padding: `${vars.space[40]} ${vars.space[20]} ${vars.space[64]}`,
  color: vars.color.text.default,
  ...typography.body2Medium,
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
});

export const title = style({
  margin: `0 0 ${vars.space[24]}`,
  ...typography.headline2Bold,
  color: vars.color.text.strong,
});

const body = (selector: string) => `${page} ${selector}`;

globalStyle(body('h2'), {
  margin: `${vars.space[40]} 0 ${vars.space[16]}`,
  ...typography.title2Bold,
  color: vars.color.text.strong,
});

globalStyle(body('h3'), {
  margin: `${vars.space[24]} 0 ${vars.space[8]}`,
  ...typography.title3Bold,
  color: vars.color.text.strong,
});

globalStyle(body('p'), { margin: `${vars.space[8]} 0` });

globalStyle(body(':is(ol, ul)'), {
  margin: `${vars.space[8]} 0`,
  paddingLeft: vars.space[20],
});

globalStyle(body('li'), { margin: `${vars.space[4]} 0` });

globalStyle(body('strong'), { color: vars.color.text.strong });

globalStyle(body('a'), { color: 'inherit', textDecoration: 'underline' });
