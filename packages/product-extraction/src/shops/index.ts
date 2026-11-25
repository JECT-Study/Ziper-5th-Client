import { ably } from './ably';
import { musinsa } from './musinsa';
import type { Shop } from './shop';
import { zigzag } from './zigzag';

export { ably, ablyAppProductURL, ablyProductRedirectHost } from './ably';
export { musinsa, musinsaAppProductURL } from './musinsa';
export { zigzag } from './zigzag';
export { shopProductURL, type Shop } from './shop';

export const shops: readonly Shop[] = [musinsa, ably, zigzag];
