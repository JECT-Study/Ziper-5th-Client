import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const root = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 74,
  padding: `${vars.space[12]} 0`,
  paddingBottom: `calc(${vars.space[12]} + env(safe-area-inset-bottom))`,
  borderTop: `1px solid ${vars.color.border.subtle}`,
  backgroundColor: vars.color.background,
});

export const group = style({ display: 'flex' });

export const tab = style({
  width: 75,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[4],
  padding: `0 13px`,
  border: 'none',
  background: 'none',
  color: vars.color.icon.disabled,
  fontFamily: 'inherit',
  cursor: 'pointer',
});

export const active = style({ color: vars.color.text.strong });

export const label = style({ width: 60, ...typography.caption2Bold, textAlign: 'center' });

// 가운데 + 버튼은 바 위로 16px 튀어나온다.
export const add = style({
  position: 'absolute',
  top: -16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.full,
  background: 'none',
  cursor: 'pointer',
});
