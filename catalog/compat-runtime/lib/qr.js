// app-hub-v11/lib/qr.js
// QR rendering helper. Uses a CDN QR encoder when available and keeps a visible
// link fallback when script loading is blocked/offline.

let qrLoader = null;

function loadQrLib(runtime = globalThis) {
  if (runtime.QRCode?.toCanvas) return Promise.resolve(runtime.QRCode);
  if (qrLoader) return qrLoader;
  const document = runtime.document;
  if (!document?.createElement) return Promise.resolve(null);
  qrLoader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
    script.async = true;
    script.onload = () => resolve(runtime.QRCode || null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  return qrLoader;
}

export async function renderShareQr(target, value, { runtime = globalThis, size = 180 } = {}) {
  if (!target) return false;
  target.innerHTML = '';
  const document = runtime.document;
  const text = String(value || '');
  if (!text) return false;
  const QRCode = await loadQrLib(runtime);
  if (QRCode?.toCanvas && document?.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    target.append(canvas);
    try {
      await QRCode.toCanvas(canvas, text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
      return true;
    } catch (error) {
      target.innerHTML = '';
    }
  }
  if (document?.createElement) {
    const fallback = document.createElement('div');
    fallback.className = 'qr-fallback';
    fallback.textContent = 'QR unavailable offline; copy the link above.';
    target.append(fallback);
  } else {
    target.textContent = 'QR unavailable offline; copy the link above.';
  }
  return false;
}
