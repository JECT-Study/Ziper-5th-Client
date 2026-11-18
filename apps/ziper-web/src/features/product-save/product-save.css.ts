import { globalStyle, style } from '@vanilla-extract/css';
import { typography, vars } from '../../styles/theme.css';

export const shell = style({
  minHeight: '100dvh',
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.background,
});

export const header = style({
  display: 'grid',
  gridTemplateColumns: '56px 1fr 56px',
  alignItems: 'center',
  minHeight: 56,
  borderBottom: `1px solid ${vars.color.divider.strong}`,
});

export const title = style({ ...typography.title2Bold, textAlign: 'center', margin: 0 });

export const close = style({
  display: 'grid',
  placeItems: 'center',
  width: 56,
  height: 56,
  padding: 0,
  border: 0,
  background: 'none',
  color: vars.color.icon.strong,
  cursor: 'pointer',
});

export const body = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '8px 16px 0',
});

export const form = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[20],
  minWidth: 0,
});

export const label = style({
  ...typography.body2Medium,
  color: vars.color.text.default,
  margin: 0,
});

export const group = style({ display: 'grid', gap: vars.space[8], minWidth: 0 });
export const linkField = style({ minWidth: 0 });
globalStyle(`${linkField} input`, { textOverflow: 'ellipsis' });

export const productCard = style({
  minHeight: 105,
  backgroundColor: vars.palette.gray100,
  borderRadius: vars.radius.l,
  display: 'grid',
  gridTemplateColumns: '81px minmax(0, 1fr)',
  gap: vars.space[14],
  alignItems: 'center',
  padding: vars.space[12],
});

export const productImage = style({
  objectFit: 'cover',
  width: 81,
  height: 81,
  borderRadius: vars.radius.m,
  backgroundColor: vars.palette.gray200,
});

export const productInfo = style({ display: 'grid', gap: vars.space[2] });
export const shop = style({ ...typography.body3Medium, color: vars.color.text.default });
export const productName = style({ ...typography.body2Medium, overflowWrap: 'anywhere' });
export const price = style({ ...typography.title2Bold });

export const inline = style({ display: 'flex', alignItems: 'center', gap: vars.space[4] });
export const grow = style({ flex: 1, minWidth: 0 });

export const tags = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[6],
});
export const customTag = style({ display: 'inline-flex', alignItems: 'center' });
export const removeTag = style({
  display: 'grid',
  placeItems: 'center',
  width: 44,
  height: 44,
  border: 0,
  padding: 0,
  background: 'none',
  color: vars.color.icon.default,
  cursor: 'pointer',
});
export const addTag = style({
  background: vars.color.background,
  border: `1px solid ${vars.color.border.default}`,
});

export const boardPanel = style({
  backgroundColor: vars.palette.gray100,
  borderRadius: vars.radius.l,
  padding: '6px 12px 8px',
  minWidth: 0,
});
export const boardList = style({
  maxHeight: 170,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
  listStyle: 'none',
  padding: 0,
  margin: 0,
});
export const boardRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 34,
  gap: vars.space[8],
});
export const boardCheck = style({});
globalStyle(`${boardCheck} > span[aria-hidden]`, { width: 20, height: 20 });
export const boardCount = style({ ...typography.caption2Medium, color: vars.color.text.default });
export const boardActions = style({
  borderTop: `1px solid ${vars.color.divider.strong}`,
  paddingTop: vars.space[8],
  marginTop: vars.space[8],
});
export const addBoard = style({
  display: 'inline-flex',
  gap: vars.space[4],
  alignItems: 'center',
  minHeight: 36,
  border: 0,
  backgroundColor: 'transparent',
  color: vars.color.text.default,
  ...typography.body2Medium,
  cursor: 'pointer',
});

export const imageModes = style({ width: '100%' });
globalStyle(`${imageModes} > button`, { flex: 1 });

export const cardOptions = style({
  display: 'flex',
  gap: vars.space[4],
  overflowX: 'auto',
  scrollbarWidth: 'thin',
  padding: 2,
});
export const cardOption = style({
  flex: '0 0 100px',
  border: `1px solid ${vars.color.border.subtle}`,
  borderRadius: vars.radius.m,
  backgroundColor: vars.color.background,
  color: vars.color.text.default,
  padding: vars.space[6],
  display: 'grid',
  placeItems: 'center',
  gap: vars.space[4],
  ...typography.body3Medium,
  cursor: 'pointer',
  selectors: {
    '&[aria-pressed="true"]': {
      backgroundColor: vars.palette.gray800,
      color: vars.color.text.white,
    },
  },
});
export const template = style({
  width: 84,
  height: 84,
  objectFit: 'contain',
  borderRadius: vars.radius.s,
});
export const feedback = style({
  margin: 0,
  ...typography.body2Medium,
  color: vars.color.text.default,
});
export const error = style({
  margin: 0,
  ...typography.body2Medium,
  color: vars.color.status.negative,
});
export const footer = style({
  marginTop: 'auto',
  paddingTop: vars.space[40],
  paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
});
