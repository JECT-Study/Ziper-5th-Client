import { keyframes, style } from '@vanilla-extract/css';
import { typography, vars } from '../../styles/theme.css';
import { viewportHeight } from '../../styles/viewport';

export const page = style({
  minHeight: viewportHeight,
  maxWidth: 480,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
});

export const body = style({ flex: 1, display: 'flex', flexDirection: 'column' });

// 정렬 칩. 화면보다 길면 가로로 넘긴다.
export const sorts = style({
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  padding: `${vars.space[8]} ${vars.space[16]}`,
  scrollbarWidth: 'none',
  selectors: { '&::-webkit-scrollbar': { display: 'none' } },
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  columnGap: vars.space[12],
  rowGap: vars.space[24],
  padding: `${vars.space[16]} ${vars.space[16]} ${vars.space[24]}`,
});

// 상품 카드
export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[8],
  minWidth: 0,
});

export const imageSection = style({
  overflow: 'hidden',
  border: `1px solid ${vars.color.border.subtle}`,
  borderRadius: vars.radius.s,
});

export const imageArea = style({
  position: 'relative',
  padding: vars.space[8],
  backgroundColor: '#f5f5f5',
});

const plainButton = style({
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
});

export const imageButton = style([
  plainButton,
  {
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    aspectRatio: '149.5 / 108.13',
    overflow: 'hidden',
  },
]);

export const photo = style({ width: '100%', height: '100%', objectFit: 'cover' });

export const fallback = style({ height: '80%', objectFit: 'contain' });

export const noImage = style({
  padding: vars.space[8],
  ...typography.caption2Medium,
  color: vars.color.text.default,
  textAlign: 'center',
});

export const more = style([
  plainButton,
  { position: 'absolute', top: 8, right: 8, display: 'inline-flex', color: vars.color.icon.strong },
]);

export const originalLink = style([
  plainButton,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: vars.space[8],
    backgroundColor: vars.palette.white,
    ...typography.caption2Medium,
    color: vars.color.text.strong,
  },
]);

export const info = style([
  plainButton,
  { display: 'flex', flexDirection: 'column', gap: 5.5, width: '100%' },
]);

export const shop = style({ ...typography.body3Medium, color: vars.color.text.default });

export const title = style({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  wordBreak: 'break-all',
  ...typography.body3Medium,
  color: vars.color.text.strong,
});

export const price = style({ fontSize: 14, fontWeight: 700, color: vars.color.text.strong });

export const tags = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.space[4],
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

// Figma chips_filter 모양이지만 누르는 칩이 아니라 표시용이라 li 로 그린다.
export const tag = style({
  padding: `${vars.space[8]} ${vars.space[16]}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.palette.gray100,
  ...typography.subtitle1Semibold,
  color: vars.color.text.strong,
  whiteSpace: 'nowrap',
});

// 빈 보드
// Figma 빈 보드: 정렬 칩 아래 79px 에서 시작한다(가운데 정렬이 아니다).
export const empty = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[24],
  padding: `79px 19px ${vars.space[24]}`,
  textAlign: 'center',
});

export const emptyText = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[16],
});

export const emptyTitle = style({
  margin: `0 0 ${vars.space[8]}`,
  ...typography.title3Bold,
  color: vars.color.text.strong,
});

export const emptyDescription = style({
  margin: 0,
  ...typography.body3Medium,
  color: '#666666',
  whiteSpace: 'pre-line',
});

export const emptyButton = style({ width: 148 });

export const status = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: vars.space[12],
  padding: vars.space[24],
  ...typography.body3Medium,
  color: vars.color.text.default,
});

export const sentinel = style({ height: 1 });

// 불러오는 동안의 자리
const pulse = keyframes({ '50%': { opacity: 0.5 } });

export const skeleton = style({
  borderRadius: vars.radius.s,
  backgroundColor: vars.palette.gray200,
  animation: `${pulse} 1.2s ease-in-out infinite`,
  '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } },
});

export const skeletonImage = style({ aspectRatio: '165.5 / 157' });

export const skeletonLine = style({ height: 12, borderRadius: 4 });

export const skeletonShort = style({ width: '40%' });

export const skeletonMedium = style({ width: '60%' });
