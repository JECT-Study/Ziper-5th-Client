import { globalStyle, style } from '@vanilla-extract/css';
import { vars } from '../../styles/theme.css';
import * as textField from '../../components/TextField.css';

// Flow 5 uses a green/Noto palette not present in the shared lime/Pretendard design system.
// Keep these reference-screen values scoped; do not change existing screens.
const colors = {
  green: '#56cf91',
  pale: '#e4f7ee',
  border: '#8de5b3',
  ink: '#177348',
  muted: '#666',
  surface: '#f7f7f7',
  text: '#242424',
};
export const page = style({
  maxWidth: 480,
  minHeight: '100dvh',
  margin: '0 auto',
  paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
  fontFamily: "'Noto Sans KR', " + vars.font.family,
  lineHeight: 1.5,
  color: colors.text,
  background: vars.color.background,
});
globalStyle(`${page} p, ${page} h2`, { margin: 0 });
export const header = style({ height: 58, padding: '0 19px', gap: 8 });
globalStyle(`${header} h1`, {
  position: 'static',
  transform: 'none',
  fontSize: 18,
  lineHeight: '27px',
  color: colors.text,
});
export const iconButton = style({
  display: 'grid',
  placeItems: 'center',
  width: 44,
  height: 44,
  marginRight: -12,
  padding: 0,
  background: 'none',
  border: 0,
  ':disabled': { opacity: 0.4 },
});
export const body = style({ display: 'grid', gap: 16, padding: '0 19px' });
export const imageGroup = style({ display: 'grid', gap: 6, margin: 0 });
export const image = style({
  height: 224,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: colors.pale,
  borderRadius: 14,
  overflow: 'hidden',
  position: 'relative',
});
export const photo = style({ width: '100%', height: '100%', objectFit: 'cover' });
export const template = style({ width: 101, height: 101, objectFit: 'contain' });
export const unavailable = style({ background: '#3d3d3d', color: '#fff' });
export const unavailableIcon = style({
  position: 'absolute',
  top: 42,
  left: '50%',
  transform: 'translateX(-50%)',
});
export const unavailableLabel = style({
  position: 'absolute',
  top: 164,
  height: 30,
  width: '100%',
  textAlign: 'center',
  fontSize: 13,
});
export const caption = style({
  fontSize: 11,
  color: colors.muted,
  lineHeight: '17px',
  overflowWrap: 'anywhere',
});
export const info = style({ display: 'grid', gap: 5 });
export const name = style({
  fontSize: 18,
  fontWeight: 700,
  lineHeight: '27px',
  overflowWrap: 'anywhere',
});
export const priceRow = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 });
export const price = style({ fontSize: 22, lineHeight: '33px', fontWeight: 700 });
export const memo = style({
  padding: 14,
  borderRadius: 13,
  background: colors.surface,
  display: 'grid',
  gap: 5,
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  fontSize: 13,
  lineHeight: '20px',
});
export const chips = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
export const chip = style({
  padding: '6px 11px',
  border: '1px solid #f2f2f2',
  borderRadius: 20,
  background: colors.surface,
  fontSize: 12,
  lineHeight: '18px',
  overflowWrap: 'anywhere',
  maxWidth: '100%',
});
export const boardChip = style([
  chip,
  { background: colors.pale, borderColor: colors.border, color: colors.ink },
]);
export const boards = style({ display: 'grid', gap: 8 });
export const action = style({
  selectors: {
    '&&': {
      height: 52,
      borderRadius: 13,
      fontSize: 15,
      lineHeight: '23px',
      background: colors.green,
      color: colors.text,
    },
    '&&:active:not(:disabled)': { background: '#45bf80' },
    '&&:disabled:not([aria-busy="true"])': { background: '#e5e5e5', color: colors.muted },
  },
});
export const secondary = style([action, { selectors: { '&&': { background: colors.surface } } }]);
export const feedback = style({
  fontSize: 13,
  padding: 12,
  borderRadius: 8,
  background: colors.surface,
  overflowWrap: 'anywhere',
});
export const error = style([feedback, { color: vars.color.text.destructive }]);
export const modal = style({
  selectors: {
    '&&': {
      width: 'calc(100% - 48px)',
      maxWidth: 327,
      top: 'max(16px, calc(50dvh - 126px))',
      margin: '0 auto',
      maxHeight: 'calc(100dvh - 32px)',
      overflowY: 'auto',
      padding: 22,
      gap: 18,
      borderRadius: 21,
      fontFamily: "'Noto Sans KR', " + vars.font.family,
    },
  },
});
globalStyle(`${modal}::backdrop`, { background: 'rgba(0,0,0,0.4)' });
export const modalTitle = style({
  margin: 0,
  textAlign: 'center',
  fontSize: 18,
  fontWeight: 700,
  lineHeight: '27px',
  whiteSpace: 'pre-line',
});
export const buttonRow = style({ display: 'flex', gap: 10 });
export const form = style({ display: 'grid', gap: 8 });
globalStyle(`${form} ${textField.root.box}`, { gap: 6 });
globalStyle(`${form} ${textField.field.box}`, {
  padding: '12px 13px',
  minHeight: 46,
  borderRadius: 13,
  background: colors.surface,
});
globalStyle(`${form} ${textField.label}`, {
  fontSize: 11,
  lineHeight: '16px',
  color: colors.muted,
});
globalStyle(`${form} ${textField.input.box}`, { fontSize: 13, lineHeight: '18px' });
globalStyle(`${form} ${textField.helperTone.default}, ${form} ${textField.counter.default}`, {
  color: colors.muted,
});
export const choice = style({
  selectors: {
    '&&': {
      minHeight: 32,
      height: 'auto',
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      padding: '6px 11px',
      fontSize: 12,
      border: '1px solid #efefef',
      background: colors.surface,
    },
    '&&[aria-pressed="true"]': {
      background: colors.pale,
      color: colors.ink,
      borderColor: colors.border,
    },
  },
});
export const fieldset = style({
  display: 'grid',
  gap: 8,
  border: 0,
  padding: 0,
  margin: 0,
  minWidth: 0,
});
export const legend = style({ fontSize: 14, fontWeight: 700, marginBottom: 8 });
export const select = style({
  fontFamily: 'inherit',
  padding: 10,
  borderRadius: 8,
  border: '1px solid #a2a2a2',
  background: '#fff',
  color: colors.text,
  width: '100%',
});
export const success = style({
  padding: 16,
  borderRadius: 13,
  background: colors.pale,
  display: 'grid',
  gap: 7,
  fontSize: 12,
});
export const successTitle = style({ color: colors.ink, fontSize: 15, fontWeight: 700 });
export const results = style({ display: 'grid', gap: 20 });
export const summary = style({ display: 'flex', justifyContent: 'space-between', fontSize: 13 });
export const resultCard = style({
  border: 0,
  textAlign: 'left',
  color: 'inherit',
  fontFamily: 'inherit',
  padding: 12,
  borderRadius: 21,
  background: colors.surface,
  display: 'grid',
  gap: 12,
  width: '100%',
});
export const resultImage = style({ height: 220 });
export const resultName = style({
  fontSize: 17,
  lineHeight: '26px',
  fontWeight: 700,
  overflowWrap: 'anywhere',
});
export const resultNote = style({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  color: colors.ink,
  fontSize: 12,
});
export const menu = style({ fontFamily: "'Noto Sans KR', " + vars.font.family });
globalStyle(`${menu} h2`, { fontSize: 18, lineHeight: '27px', color: colors.text, marginLeft: 3 });
globalStyle(`${menu}::backdrop`, { background: 'rgba(0,0,0,0.4)' });
globalStyle(`${menu} button[aria-label="닫기"]`, { display: 'none' });
export const menuActions = style({ display: 'grid', gap: 20, padding: '4px 19px 0' });
export const menuAction = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  height: 50,
  padding: 0,
  border: 0,
  background: 'none',
  font: 'inherit',
  fontSize: 15,
  textAlign: 'left',
  color: colors.text,
});
export const menuFooter = style({ padding: '20px 19px 30px' });
export const toast = style({
  position: 'fixed',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'max-content',
  maxWidth: 'calc(100% - 32px)',
  zIndex: 2,
});
