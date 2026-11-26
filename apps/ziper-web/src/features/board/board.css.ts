import { keyframes, style } from '@vanilla-extract/css';
import { typography, vars } from '../../styles/theme.css';

// Figma "Board preview": 회색 카드 안에 큰 썸네일 1장 + 작은 썸네일 2장.
export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
  padding: vars.space[12],
  borderRadius: vars.radius.l,
  backgroundColor: vars.palette.gray100,
});

export const cardButton = style({
  display: 'block',
  padding: 0,
  border: 'none',
  background: 'none',
  textAlign: 'left',
  color: 'inherit',
});

// 큰 칸 96 : 작은 칸 48.42, 사이 3.58 (Figma 148 폭 기준)
export const collage = style({
  display: 'grid',
  gridTemplateColumns: '96fr 48.42fr',
  gridTemplateRows: '1fr 1fr',
  columnGap: 3.58,
  rowGap: 3.65,
  // 높이를 고정하지 않고 Figma 비율(148 : 119.65)로 둔다. 카드가 넓어져도 썸네일 모양이 그대로다.
  aspectRatio: '148 / 119.65',
});

export const tile = style({
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 10,
  backgroundColor: vars.palette.white,
});

export const tileLarge = style({ gridRow: '1 / span 2' });

// 이미지가 있는 칸은 Figma 처럼 어두운 바탕 위에 깐다.
export const tileFilled = style({ backgroundColor: vars.palette.gray800 });

export const photo = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const fallback = style({ width: '80%', height: '80%', objectFit: 'contain' });

export const info = style({ display: 'flex', flexDirection: 'column' });

export const nameRow = style({ display: 'flex', alignItems: 'center', minWidth: 0 });

export const name = style({
  flex: 1,
  minWidth: 0,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  ...typography.body2Medium,
  color: vars.color.text.strong,
});

export const more = style({
  display: 'inline-flex',
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  color: vars.color.icon.strong,
});

export const count = style({
  margin: 0,
  ...typography.caption2Medium,
  color: vars.color.text.default,
});

// Figma "Create Board Button": 점선 테두리 상자
export const createButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  border: `1px dashed ${vars.palette.gray400}`,
  borderRadius: vars.radius.l,
  backgroundColor: vars.palette.white,
  ...typography.body1Medium,
  color: vars.color.text.disabled,
});

// 홈
export const homeCreate = style({ padding: `${vars.space[8]} ${vars.space[16]}` });

export const homeCreateButton = style({ height: 84 });

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${vars.space[12]} ${vars.space[16]}`,
});

export const sectionTitle = style({
  margin: 0,
  ...typography.title3Bold,
  color: vars.color.text.strong,
});

export const sectionLink = style({
  padding: 0,
  border: 'none',
  background: 'none',
  ...typography.body3Medium,
  color: vars.color.text.default,
});

// 홈 내 보드는 2열로 폭을 채우고, 최대 4개(2×2)만 보여준다. 나머지는 "전체 보기"로 본다.
export const homeList = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: vars.space[8],
  padding: `0 ${vars.space[16]}`,
});

export const status = style({
  margin: 0,
  padding: `${vars.space[8]} ${vars.space[16]}`,
  ...typography.body3Medium,
  color: vars.color.text.default,
});

// 이름 입력 시트
export const sheetBody = style({ padding: `0 ${vars.space[16]}` });

export const sheetFooter = style({ padding: vars.space[16] });

// 불러오는 동안 보여줄 자리. 카드와 같은 크기로 그려서 다 불러와도 화면이 밀리지 않는다.
const pulse = keyframes({ '50%': { opacity: 0.5 } });

export const skeleton = style({
  borderRadius: 10,
  backgroundColor: vars.palette.gray200,
  animation: `${pulse} 1.2s ease-in-out infinite`,
  '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } },
});

export const skeletonName = style({ width: '60%', height: 14, margin: '5px 0', borderRadius: 4 });

export const skeletonCount = style({ width: 24, height: 10, margin: '3px 0', borderRadius: 4 });

// 내 보드 탭
export const tabHeader = style({ borderBottom: `1px solid ${vars.color.divider.default}` });

export const filters = style({
  display: 'flex',
  gap: 6,
  padding: `${vars.space[12]} ${vars.space[16]}`,
});

export const tabGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: `${vars.space[12]} ${vars.space[8]}`,
  padding: `${vars.space[8]} ${vars.space[16]} ${vars.space[24]}`,
});

// 옆 카드와 같은 줄이면 그 높이에 맞춰 늘어나고, 혼자일 때도 카드 비율(172 : 188.65)을 지킨다.
export const tabCreateButton = style({ aspectRatio: '172 / 188.65', ...typography.body2Medium });

export const empty = style({
  gridColumn: '1 / -1',
  margin: 0,
  padding: `${vars.space[24]} 0`,
  ...typography.body3Medium,
  color: vars.color.text.default,
  textAlign: 'center',
});

// 보드 관리 시트 (Figma "상품 관리 동작" 줄)
export const menu = style({
  display: 'flex',
  flexDirection: 'column',
  padding: `0 ${vars.space[16]}`,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  height: 50,
  padding: `0 ${vars.space[8]}`,
  border: 'none',
  background: 'none',
  textAlign: 'left',
  ...typography.subtitle1Semibold,
  color: '#242424',
  selectors: { '& + &': { borderTop: `1px solid ${vars.color.divider.default}` } },
});

export const menuItemDanger = style({ color: vars.color.accent.red });
