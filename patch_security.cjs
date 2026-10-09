const fs = require('fs');

let c = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');

const target = `/bookings/:id/collect-balance', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const bookingId = req.params.id;
  const booking = db.bookings.get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }`;

const replacement = `/bookings/:id/collect-balance', requireAuth, requireRole('owner'), (req: AuthenticatedRequest, res: Response) => {
  const bookingId = req.params.id;
  const booking = db.bookings.get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const salon = db.salons.get(booking.salonId);
  if (!salon || salon.ownerId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Unauthorized to collect balance for this booking' });
  }`;

c = c.replace(target, replacement);

// normalize CRLF
const targetCRLF = target.replace(/\n/g, '\r\n');
const replacementCRLF = replacement.replace(/\n/g, '\r\n');
c = c.replace(targetCRLF, replacementCRLF);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', c);
console.log('Fixed collect-balance security');
