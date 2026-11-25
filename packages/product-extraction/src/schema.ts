import { z } from 'zod';
import { isProductExtractionURL, isShareURL, secureProductURL } from './link';

const selectors = z.array(z.string().min(1).max(200)).max(8);
const shopRule = z.object({
  hosts: z.array(z.string().max(100)).max(12),
  fields: z.object({ title: selectors, price: selectors, image: selectors }),
  imageHosts: z.array(z.string().max(100)).max(12),
  imageStrategy: z.enum(['SERVER_MIRROR', 'CLIENT_UPLOAD']),
});
export const productExtractionRules = z.object({ shops: z.array(shopRule).max(12) });
export type Shops = z.infer<typeof productExtractionRules>['shops'];

// The server allows 200 Unicode code points; an astral character occupies two UTF-16 units.
export const maxExtractedTitleUnits = 400;
export const productMetadata = z
  .object({
    url: z
      .string()
      .refine((value) => secureProductURL(value) !== null && isProductExtractionURL(value)),
    name: z.string().max(maxExtractedTitleUnits),
    price: z.number().int().min(0).max(1_000_000_000).nullable(),
    imageURL: z
      .string()
      .max(2048)
      .refine((value) => isShareURL(value) && /^https:\/\//i.test(value))
      .nullable(),
  })
  .strict();
export type ProductMetadata = z.infer<typeof productMetadata>;
