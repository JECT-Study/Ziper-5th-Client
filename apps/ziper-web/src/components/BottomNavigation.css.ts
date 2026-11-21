import { style } from '@vanilla-extract/css';
import { typography, vars } from '../styles/theme.css';

export const root = style({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) clamp(50px, 20%, 74px) minmax(0, 1fr)',
  alignItems: 'center',
  padding: `${vars.space[12]} 0`,
  borderTop: `1px solid ${vars.color.border.subtle}`,
  backgroundColor: vars.color.background,
});

export const group = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  selectors: { '&:nth-child(2)': { gridColumn: 3 } },
});

export const tab = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[4],
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.disabled,
  fontFamily: 'inherit',
});

export const active = style({ color: vars.color.text.strong });

export const label = style({ ...typography.caption2Bold, textAlign: 'center' });

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
});
