// Zigzag: product ID from the path and the getPdpBaseInfo record fallback.
// Part of the injected scanner: plain JS sharing the scope set up in ./index.ts.
export const zigzagSource = String.raw`
  const zigzagHosts = hosts.zigzag;
  const zigzagPath = /^\/(?:app\/)?catalog\/products\/(\d+)(?:\/|$)/;
  const zigzagId = zigzagHosts.includes(host) && zigzagPath.exec(location.pathname)?.[1];

  const zigzagPdp = (data, foreignCurrency) => {
    const id = zigzagId;
    if (!id || data?.query?.catalog_product_id !== id) return;
    const queries = data.props?.pageProps?.dehydratedState?.queries;
    if (!Array.isArray(queries)) return;
    for (const entry of queries.slice(0, 32)) {
      const key = entry?.queryKey;
      if (!Array.isArray(key) || key[0] !== 'getPdpBaseInfo' || String(key[1]) !== id) continue;
      const product = entry?.state?.data?.product;
      if (String(product?.id) !== id) continue;
      const prices = product.product_price;
      const display = prices?.display_final_price;
      // The public metadata uses the additional displayed price when the page shows a coupon price.
      const displayed = display?.final_price_additional ?? display?.final_price;
      const currency = displayed?.price_with_currency?.display_currency;
      const amount = typeof displayed?.price === 'number' ? krw(String(displayed.price)) : null;
      const legacy = prices?.final_discount_info?.discount_price;
      const legacyPrice = typeof legacy === 'number' ? krw(String(legacy)) : null;
      // 원~ is the published starting price, not a selected option. Require same-item corroboration.
      const startingPrice = currency === '원~' && !foreignCurrency && amount === legacyPrice;
      const displayedPrice = currency === '원' || startingPrice ? amount : null;
      const blocksLegacyPrice = currency != null && currency !== '원';
      return {
        name: typeof product.name === 'string' ? product.name : '',
        closed: product.sales_status === 'CLOSED',
        displayedPrice,
        blocksLegacyPrice,
        price: displayedPrice ?? (foreignCurrency || blocksLegacyPrice ? null : legacyPrice),
        imageURL: imageUrl(product.product_image_list?.[0]?.url),
      };
    }
  };
`;
