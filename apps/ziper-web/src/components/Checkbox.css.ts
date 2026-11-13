import { style } from '@vanilla-extract/css';
import checkedIcon from '../assets/components/checkbox-checked.svg';
import uncheckedIcon from '../assets/components/checkbox-unchecked.svg';
import { typography, vars } from '../styles/theme.css';

export const root = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[8],
  cursor: 'pointer',
});

// 실제 체크박스는 접근성을 위해 남겨 두고 화면에서만 숨긴다.
export const input = style({
  position: 'absolute',
  width: 1,
  height: 1,
  margin: 0,
  opacity: 0,
});

export const box = style({
  flexShrink: 0,
  width: 24,
  height: 24,
  borderRadius: 5.33,
  border: `1px solid ${vars.color.border.subtle}`,
  backgroundColor: vars.color.background,
  backgroundImage: `url("${uncheckedIcon}")`,
  backgroundSize: '100% 100%',
  selectors: {
    [`${input}:checked + &`]: {
      borderColor: vars.palette.gray800,
      backgroundColor: vars.palette.gray800,
      backgroundImage: `url("${checkedIcon}")`,
    },
    [`${input}:focus-visible + &`]: {
      outline: `2px solid ${vars.palette.lime600}`,
      outlineOffset: 2,
    },
    [`${input}:disabled + &`]: { opacity: 0.5 },
  },
});

export const label = style({
  ...typography.body2Medium,
  color: vars.color.text.strong,
});
