import { style } from '@vanilla-extract/css';
import { typography, vars } from '../../styles/theme.css';

export const intro = style({
  display: 'grid',
  gap: vars.space[8],
  paddingTop: vars.space[20],
  paddingBottom: vars.space[4],
});

export const heading = style({ ...typography.headline2Bold, margin: 0 });
export const description = style({
  ...typography.body2Medium,
  color: vars.color.text.default,
  margin: 0,
});
