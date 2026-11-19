/**
 * Client-side Image Processing & Compression Utility
 * - Validates file type (jpeg, png, webp only)
 * - Resizes longest edge to max 900px (mobile-optimised, fewer encode passes)
 * - Compresses with quality 0.65 (target < 350 KB, hard cap 2 MB)
 * - Generates unique non-user-provided filenames
 */

export const MAX_IMAGE_EDGE = 900;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB hard cap
export const TARGET_IMAGE_BYTES = 350 * 1024; // Smaller target → fewer compression passes
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function processImageForUpload(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.');
  }

  // Pre-check raw file size (prevent browser freezing on huge files > 25MB)
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Original file is too large (max 25 MB before compression).');
  }

  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_EDGE) / width);
          width = MAX_IMAGE_EDGE;
        } else {
          width = Math.round((width * MAX_IMAGE_EDGE) / height);
          height = MAX_IMAGE_EDGE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Canvas context unavailable for image compression.'));
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const extension = outputType === 'image/webp' ? 'webp' : 'jpg';

      const createCompressedFile = (quality: number) => {
        canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Failed to compress image.'));
          }

          if (blob.size > TARGET_IMAGE_BYTES && quality > 0.35) {
            createCompressedFile(Math.max(0.35, quality - 0.15));
            return;
          }

          if (blob.size > MAX_IMAGE_BYTES) {
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
            return reject(new Error(`Compressed image exceeds the 2 MB limit (${sizeMb} MB).`));
          }

          // Generate unique non-user-provided filename
          const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            : Math.random().toString(36).slice(2, 12);
          const fileName = `${Date.now()}_${uniqueId}.${extension}`;

          const compressedFile = new File([blob], fileName, { type: outputType });
          resolve(compressedFile);
        },
        outputType,
        quality
        );
      };

      createCompressedFile(0.65);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image file. Please ensure it is a valid JPEG, PNG, or WebP.'));
    };

    img.src = objectUrl;
  });
}
