const fs = require('fs');
let content = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');

// Turf booking validation
content = content.replace(
  `    const finalPrice = typeof price === 'number' && price > 0\n      ? price\n      : (selectedResource?.pricePerHour || salon.startingPrice || 800);`,
  `    const finalPrice = typeof price === 'number' && price > 0\n      ? price\n      : (selectedResource?.pricePerHour || salon.startingPrice || 800);\n\n    if (paymentType === 'ADVANCE') {\n      if (!advanceAmount || advanceAmount <= 0) {\n        return res.status(400).json({ error: 'Invalid advance amount.' });\n      }\n      if (advanceAmount > finalPrice) {\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\n      }\n    }`
);

content = content.replace(
  `    const finalPrice = typeof price === 'number' && price > 0\r\n      ? price\r\n      : (selectedResource?.pricePerHour || salon.startingPrice || 800);`,
  `    const finalPrice = typeof price === 'number' && price > 0\r\n      ? price\r\n      : (selectedResource?.pricePerHour || salon.startingPrice || 800);\r\n\r\n    if (paymentType === 'ADVANCE') {\r\n      if (!advanceAmount || advanceAmount <= 0) {\r\n        return res.status(400).json({ error: 'Invalid advance amount.' });\r\n      }\r\n      if (advanceAmount > finalPrice) {\r\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\r\n      }\r\n    }`
);

// Standard booking validation - look for where the booking is assembled.
// In standard booking, amount is service.price.
// We can find `const qrCodeId = `QR-${bookingId}-${crypto.randomBytes(6).toString('hex')}`.toUpperCase();` and replace it
content = content.replace(
  `    const qrCodeId = \`QR-\${bookingId}-\${crypto.randomBytes(6).toString('hex')}\`.toUpperCase();`,
  `    if (paymentType === 'ADVANCE') {\n      if (!advanceAmount || advanceAmount <= 0) {\n        return res.status(400).json({ error: 'Invalid advance amount.' });\n      }\n      if (advanceAmount > service.price) {\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\n      }\n    }\n\n    const qrCodeId = \`QR-\${bookingId}-\${crypto.randomBytes(6).toString('hex')}\`.toUpperCase();`
);
content = content.replace(
  `    const qrCodeId = \`QR-\${bookingId}-\${crypto.randomBytes(6).toString('hex')}\`.toUpperCase();`,
  `    if (paymentType === 'ADVANCE') {\r\n      if (!advanceAmount || advanceAmount <= 0) {\r\n        return res.status(400).json({ error: 'Invalid advance amount.' });\r\n      }\r\n      if (advanceAmount > service.price) {\r\n        return res.status(400).json({ error: 'Advance amount cannot be greater than the total price.' });\r\n      }\r\n    }\r\n\r\n    const qrCodeId = \`QR-\${bookingId}-\${crypto.randomBytes(6).toString('hex')}\`.toUpperCase();`
);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', content);
console.log('Patched');
