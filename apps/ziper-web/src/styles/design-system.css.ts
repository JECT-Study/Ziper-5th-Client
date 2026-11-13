import { style } from '@vanilla-extract/css';
import { typography, vars } from './theme.css';

export const page = style({ maxWidth: 375, margin: '0 auto', paddingBottom: vars.space[72] });

export const section = style({
  padding: `${vars.space[24]} ${vars.space[16]}`,
  borderBottom: `8px solid ${vars.palette.gray100}`,
});

export const sectionTitle = style({
  margin: `0 0 ${vars.space[16]}`,
  ...typography.title3Bold,
  color: vars.color.text.default,
});

export const stack = style({ display: 'flex', flexDirection: 'column', gap: vars.space[16] });

export const row = style({ display: 'flex', alignItems: 'center', gap: vars.space[8] });

export const icons = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 24px)',
  gap: vars.space[16],
  color: vars.color.icon.strong,
});

export const timer = style({ ...typography.body2Medium, color: vars.color.accent.lime });

export const sheetBody = style({ height: 238 });
