/**
 * Ticket capture and download utilities for QGo Match Tickets.
 */

export const TICKET_CAPTURE_OPTIONS = {
  pixelRatio: 2,
  backgroundColor: '#FFFFFF',
  cacheBust: true,
} as const;

/**
 * Format ticket image download filename.
 * Produces format: qgo-ticket-<bookingId>.png
 */
export function getTicketFileName(bookingId?: string | null): string {
  const cleanId = String(bookingId || 'ticket').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `qgo-ticket-${cleanId || 'ticket'}.png`;
}

/**
 * Ensures all images inside the ticket (including the QR code)
 * are completed, not tainted by cross-origin restrictions, and decoded.
 */
export async function ensureTicketImagesReady(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      // If image is from another origin and not a data URL or blob, convert to data URL to avoid canvas taint
      if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
        try {
          const url = new URL(img.src, window.location.href);
          if (url.origin !== window.location.origin) {
            const res = await fetch(img.src, { mode: 'cors' });
            const blob = await res.blob();
            await new Promise<void>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  img.src = reader.result;
                }
                resolve();
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch (convErr) {
          console.warn('Could not convert external ticket image to data URL:', convErr);
        }
      }

      // Wait for image loading if not yet complete
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }

      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // ignore decode failure
        }
      }
    })
  );
}
