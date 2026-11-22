import { style } from '@vanilla-extract/css';
import { vars } from '../../../../styles/theme.css';
import { viewportHeight } from '../../../../styles/viewport';

export const failed = style({
  minHeight: viewportHeight,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[16],
  padding: vars.space[24],
  textAlign: 'center',
});
