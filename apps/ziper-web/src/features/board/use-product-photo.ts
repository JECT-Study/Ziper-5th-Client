import { useState } from 'react';

export function useProductPhoto(
  { imageFileUrl, imageUrl }: { imageFileUrl?: string | null; imageUrl?: string | null },
  revision = 0,
) {
  const [failure, setFailure] = useState<{ revision: number; urls: ReadonlySet<string> }>();
  const failedUrls = failure?.revision === revision ? failure.urls : undefined;
  const photo = [imageFileUrl, imageUrl].find((url) => url && !failedUrls?.has(url));
  return {
    photo,
    onPhotoError: () => {
      if (photo) {
        setFailure((previous) => ({
          revision,
          urls: new Set([...(previous?.revision === revision ? previous.urls : []), photo]),
        }));
      }
    },
  };
}
