import { keyframes, style } from '@vanilla-extract/css';

export const icon = style({
  display: 'inline-block',
  flexShrink: 0,
  backgroundColor: 'currentColor',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
});

const rotate = keyframes({ to: { transform: 'rotate(360deg)' } });

export const spin = style({
  display: 'inline-flex',
  animation: `${rotate} 0.8s linear infinite`,
  '@media': { '(prefers-reduced-motion: reduce)': { animationDuration: '2.4s' } },
});
