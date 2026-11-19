import { style } from '@vanilla-extract/css';
import { buttonHeight } from '@ziper/design-tokens';
import { vars } from '../styles/theme.css';

export const actions = style({
  display: 'grid',
  gap: vars.space[8],
  paddingInline: vars.space[16],
  paddingBlock: vars.space[4],
});
export const action = style({
  selectors: {
    '&&': {
      height: 'auto',
      minHeight: buttonHeight.large,
      paddingBlock: vars.space[8],
      whiteSpace: 'normal',
      wordBreak: 'keep-all',
      overflowWrap: 'anywhere',
    },
  },
});
