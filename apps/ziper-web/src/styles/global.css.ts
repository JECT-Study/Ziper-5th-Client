import { globalStyle } from '@vanilla-extract/css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
});

globalStyle('body', {
  margin: 0,
  backgroundColor: '#f8fafc',
  color: '#0f172a',
  fontFamily: 'system-ui, sans-serif',
});
