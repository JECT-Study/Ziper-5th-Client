import { style, styleVariants } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const root = styleVariants({
  underline: { display: 'flex', flexDirection: 'column', gap: vars.space[8] },
  box: { display: 'flex', flexDirection: 'column', gap: vars.space[8] },
});

export const label = style({
  ...typography.body2Medium,
  color: vars.color.text.default,
});

const fieldBase = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[8],
});

export const field = styleVariants({
  // 입력 줄 아래 4px 띄우고 2px 밑줄. 포커스되면 진해진다.
  underline: [
    fieldBase,
    {
      paddingBottom: vars.space[4],
      borderBottom: `2px solid ${vars.palette.gray150}`,
      selectors: { '&:focus-within': { borderBottomColor: vars.palette.gray600 } },
    },
  ],
  box: [
    fieldBase,
    {
      padding: vars.space[20],
      border: `1px solid ${vars.color.border.subtle}`,
      borderRadius: vars.radius.l,
      backgroundColor: vars.color.background,
      selectors: {
        '&:focus-within': { borderColor: vars.color.border.default },
        '&[data-disabled]': { borderColor: 'transparent', backgroundColor: vars.palette.gray100 },
      },
    },
  ],
});

export const fieldError = styleVariants({
  underline: {
    borderBottomColor: vars.color.status.negative,
    selectors: { '&:focus-within': { borderBottomColor: vars.color.status.negative } },
  },
  box: {
    borderColor: vars.color.status.negative,
    backgroundColor: vars.palette.red100,
    selectors: { '&:focus-within': { borderColor: vars.color.status.negative } },
  },
});

const inputBase = style({
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 'none',
  outline: 'none',
  background: 'none',
  color: vars.color.text.strong,
  fontFamily: 'inherit',
  caretColor: vars.palette.gray800,
  '::placeholder': { color: vars.color.text.disabled },
  ':disabled': { color: vars.color.text.disabled },
  selectors: { '&[aria-invalid="true"]': { caretColor: vars.color.status.negative } },
});

export const input = styleVariants({
  underline: [inputBase, typography.title2Bold],
  box: [inputBase, typography.body2Medium],
});

export const action = style({
  display: 'inline-flex',
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.default,
  cursor: 'pointer',
});

const helperBase = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: vars.space[8],
  ...typography.body3Medium,
});

// box 는 입력칸과 도움말 사이가 4px 이라 root gap(8)에서 4 를 당긴다.
export const helper = styleVariants({
  underline: [helperBase],
  box: [helperBase, { marginTop: `calc(-1 * ${vars.space[4]})` }],
});

export const helperTone = styleVariants({
  default: { color: vars.color.icon.default },
  success: { color: vars.color.status.positive },
  error: { color: vars.color.status.negative },
});

export const counter = styleVariants({
  default: { flexShrink: 0, color: vars.color.icon.default },
  error: { flexShrink: 0, color: vars.color.status.negative },
});
