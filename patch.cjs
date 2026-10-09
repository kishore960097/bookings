const fs = require('fs');
let content = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');

// 1. Turf Bookings
content = content.replace(
  `      paymentStatus: 'pay_at_shop',\r\n      amount: finalPrice,\r\n      refundPercentage`,
  `      paymentStatus: paymentType === 'ADVANCE' && advanceAmount > 0 ? 'PARTIALLY_PAID' : (paymentType === 'FULL' ? 'PAID' : 'pay_at_shop'),\r\n      amount: finalPrice,\r\n      totalAmount: finalPrice,\r\n      paidAmount: paymentType === 'ADVANCE' ? advanceAmount : (paymentType === 'FULL' ? finalPrice : 0),\r\n      balanceAmount: paymentType === 'ADVANCE' ? finalPrice - advanceAmount : (paymentType === 'FULL' ? 0 : finalPrice),\r\n      balanceStatus: paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',\r\n      refundPercentage`
);

// 2. Standard Bookings
content = content.replace(
  `    paymentStatus: 'pay_at_shop',\r\n    amount: service.price,\r\n    createdAt: new Date().toISOString(),`,
  `    paymentStatus: paymentType === 'ADVANCE' && advanceAmount > 0 ? 'PARTIALLY_PAID' : (paymentType === 'FULL' ? 'PAID' : 'pay_at_shop'),\r\n    amount: service.price,\r\n    totalAmount: service.price,\r\n    paidAmount: paymentType === 'ADVANCE' ? advanceAmount : (paymentType === 'FULL' ? service.price : 0),\r\n    balanceAmount: paymentType === 'ADVANCE' ? service.price - advanceAmount : (paymentType === 'FULL' ? 0 : service.price),\r\n    balanceStatus: paymentType === 'ADVANCE' || paymentType === 'pay_at_shop' ? 'PENDING' : 'COLLECTED',\r\n    createdAt: new Date().toISOString(),`
);

// 3. Collect Balance Endpoint
const collectBalanceEndpoint = `
apiRouter.post('/bookings/:id/collect-balance', requireAuth, requireRole('owner'), (req, res) => {
  const bookingId = req.params.id;
  const booking = db.bookings.get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.balanceAmount && booking.balanceAmount > 0) {
    booking.paidAmount = (booking.paidAmount || 0) + booking.balanceAmount;
    booking.balanceAmount = 0;
    booking.balanceStatus = 'COLLECTED';
    booking.paymentStatus = 'PAID';
    booking.updatedAt = new Date().toISOString();
    db.bookings.set(bookingId, booking);
    return res.json({ success: true, booking });
  } else {
    return res.status(400).json({ error: 'No balance to collect' });
  }
});

apiRouter.patch('/bookings/:id/cancel', requireAuth, (req, res) => {`;

content = content.replace(
  `apiRouter.patch('/bookings/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {`,
  collectBalanceEndpoint.replace(`(req, res)`, `(req: AuthenticatedRequest, res: Response)`)
);

// 4. req.body Destructuring
content = content.replace(
  `    price,\r\n    numberOfPlayers,\r\n    notes,\r\n  } = req.body;`,
  `    price,\r\n    numberOfPlayers,\r\n    notes,\r\n    paymentType,\r\n    advanceAmount,\r\n  } = req.body;`
);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', content);
console.log("Patched successfully");
