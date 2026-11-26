import { globalStyle, style, styleVariants } from '@vanilla-extract/css';
import { typography, vars } from '../../styles/theme.css';
import { viewportHeight } from '../../styles/viewport';
import * as textField from '../../components/TextField.css';
import * as chipFilter from '../../components/ChipFilter.css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 480,
  minHeight: viewportHeight,
  margin: '0 auto',
  background: vars.color.background,
});
// Keep the list scrollable without letting long grids push the navigation out of reach.
export const purchasedPage = style([
  page,
  {
    height: viewportHeight,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
  },
]);
export const purchasedScroll = style({
  overflowY: 'auto',
  paddingBottom: 16, // Keep the final control clear of the raised add button.
  scrollPaddingBottom: 16,
});
export const body = style({ display: 'grid', gap: 12, padding: 16 });
globalStyle(`${body} p, ${body} h2`, { margin: 0 });
export const footer = style({
  marginTop: 'auto',
  position: 'sticky',
  bottom: 'env(safe-area-inset-bottom, 0px)',
});
// Keep the success toast above both actions when a return shortcut shares the footer.
globalStyle(`body:has(${footer} > button + button)`, { vars: { '--ziper-toast-offset': '150px' } });

export const iconButton = style({
  display: 'grid',
  placeItems: 'center',
  width: 44,
  height: 44,
  marginRight: -10,
  padding: 0,
  background: 'none',
  color: vars.color.icon.strong,
  border: 0,
  ':disabled': { opacity: 0.4 },
});
export const imageGroup = style({ display: 'grid', gap: 6, margin: 0 });
export const image = style({
  aspectRatio: '4 / 3',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  background: vars.palette.gray150,
  borderRadius: vars.radius.m,
  overflow: 'hidden',
});
export const photo = style({ width: '100%', height: '100%', objectFit: 'cover' });
export const topsTemplate = style({ width: '95%', height: '94%', objectFit: 'cover' });
export const categoryTemplate = style({
  position: 'relative',
  height: '94%',
  aspectRatio: '1',
  overflow: 'hidden',
});
// Preserve the artwork offsets from Figma's 84 × 84 category frames at detail scale.
const percent = (n: number) => `${(n / 84) * 100}%`;
export const categoryArtwork = styleVariants(
  {
    PANTS: [2, -2, 80, 87],
    SKIRT: [-21, -1, 128, 86],
    ACCESSORY: [-21, -5, 126, 94],
    BEAUTY: [7, -8, 70, 100],
  } as const,
  ([left, top, width, height]) => ({
    position: 'absolute',
    left: percent(left),
    top: percent(top),
    width: percent(width),
    height: percent(height),
    objectFit: 'cover',
  }),
);
export const unavailable = style({ background: vars.palette.gray900, color: vars.palette.white });
export const unavailableLabel = style({ ...typography.body2Medium, textAlign: 'center' });
export const caption = style({
  ...typography.body3Medium,
  color: vars.color.text.default,
  overflowWrap: 'anywhere',
});
export const info = style({ display: 'grid', marginTop: 4 });
export const shop = style([caption, typography.body2Medium]);
export const name = style({
  ...typography.title2Bold,
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
});
export const price = style({ ...typography.title1Bold, marginTop: 8 });
export const memo = style({
  ...typography.body3Medium,
  padding: 12,
  borderRadius: vars.radius.m,
  background: vars.palette.lime50,
  display: 'grid',
  gap: 4,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
});
export const chips = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
export const addTag = style([
  chipFilter.base,
  {
    selectors: {
      '&&': { background: vars.color.background, border: `1px solid ${vars.color.border.default}` },
    },
  },
]);
export const chip = style([
  chipFilter.base,
  { overflowWrap: 'anywhere', maxWidth: '100%', whiteSpace: 'normal' },
]);
export const boards = style({ display: 'grid', gap: 8, marginTop: 12 });
export const error = style({
  ...typography.body2Medium,
  padding: 12,
  borderRadius: vars.radius.s,
  background: vars.palette.gray100,
  color: vars.color.text.destructive,
  overflowWrap: 'anywhere',
});
export const editSheet = style({
  selectors: { '&&': { maxHeight: `calc(${viewportHeight} - 20px)` } },
});
export const form = style({ display: 'grid', gap: 16, padding: '0 16px 16px' });
// Prevent focus zoom in iOS Safari/WebView, without altering shared inputs.
globalStyle(`${form} ${textField.input.box}`, { fontSize: 16 });
// Keep the preserved draft legible while a fieldset blocks edits.
globalStyle(`${form} ${textField.input.box}[readonly]:disabled`, {
  color: vars.color.text.default,
  WebkitTextFillColor: vars.color.text.default,
  opacity: 1,
});
export const fieldset = style({
  display: 'grid',
  border: 0,
  padding: 0,
  margin: 0,
  minWidth: 0,
});
// D-1 groups the four edit fields; the board picker follows the memo without an extra gap.
export const editFields = style({ display: 'grid', gap: vars.space[20], minWidth: 0 });
export const imageOptions = style({ marginTop: vars.space[20] });
export const fieldGroup = style({ display: 'grid', gap: 8 });
export const legend = style({ ...typography.body2Medium, color: vars.color.text.default });
export const moreFields = style({ display: 'grid', gap: 12, marginTop: 12 });
export const menuActions = style({ padding: '0 16px' });
export const menuAction = style({
  ...typography.body2Medium,
  display: 'block',
  width: '100%',
  minHeight: 50,
  padding: '0 8px',
  border: 0,
  background: 'none',
  fontFamily: 'inherit',
  textAlign: 'left',
  color: vars.color.text.strong,
  selectors: { '& + &': { borderTop: `1px solid ${vars.palette.gray100}` } },
});
export const successTitle = style(typography.subtitle1Bold);
