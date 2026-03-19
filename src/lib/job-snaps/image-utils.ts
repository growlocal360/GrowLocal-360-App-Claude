/**
 * Shared client-side image utilities for job snaps.
 */

/**
 * Resizes an image file to fit within MAX_DIMENSION on its longest side, then
 * returns a base64 string (without the data: prefix) at JPEG quality 0.82.
 *
 * Full-resolution phone photos can be 4–12 MB each. Base64 adds ~33% overhead,
 * so 4 images can easily exceed Vercel's 4.5 MB request body limit. Resizing
 * to ≤1568 px keeps detail sufficient for Claude's vision model while keeping
 * the total payload well under 1 MB.
 */
const MAX_DIMENSION = 1568; // Claude vision optimal max

export function resizeAndEncode(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to encode image'));
        return;
      }
      resolve({ base64, mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = objectUrl;
  });
}
