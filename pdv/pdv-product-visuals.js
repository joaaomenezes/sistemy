function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[ch]));
    }

    const PRODUCT_IMAGE_CACHE_KEY = 'nexoerp.produtos.imagens';

    function readProductImageCache() {
      try { return JSON.parse(localStorage.getItem(PRODUCT_IMAGE_CACHE_KEY) || '{}') || {}; }
      catch (_) { return {}; }
    }

    let productImageCache = readProductImageCache();

    function productImageOf(p) {
      return p?.imagem || p?.image || p?.foto || productImageCache[p?.id] || '';
    }

    function hasProductImage(p) {
      return !!productImageOf(p);
    }

    function productVisualMarkup(p, size = 'grid') {
      const image = productImageOf(p);
      if (!image) return escapeHtml(p?.emoji || '📦');
      const cls = {
        grid: 'pdv-product-img',
        cart: 'pdv-cart-img',
        pay: 'pdv-pay-img',
        stock: 'pdv-stock-img',
      }[size] || 'pdv-product-img';
      return `<img class="${cls}" src="${escapeHtml(image)}" alt="${escapeHtml(p?.nome || 'Produto')}" loading="lazy">`;
    }
