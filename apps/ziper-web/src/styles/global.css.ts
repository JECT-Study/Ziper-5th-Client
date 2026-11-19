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
});
