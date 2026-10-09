const fs = require('fs');

// Patch types.ts
let t = fs.readFileSync('c:/projects/QGo/src/types.ts', 'utf8');
t = t.replace(
  `  paymentStatus: 'paid' | 'pending' | 'pay_at_shop';`,
  `  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'pay_at_shop' | 'paid' | 'pending';\n  totalAmount?: number;\n  paidAmount?: number;\n  balanceAmount?: number;\n  balanceStatus?: 'PENDING' | 'COLLECTED';\n  balanceReminderSent?: boolean;`
);
t = t.replace(
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected';`,
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected' | 'booking_update';`
);
fs.writeFileSync('c:/projects/QGo/src/types.ts', t);

// Patch types/index.ts
let t2 = fs.readFileSync('c:/projects/QGo/src/types/index.ts', 'utf8');
t2 = t2.replace(
  `  paymentStatus: 'paid' | 'pending' | 'pay_at_shop';`,
  `  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'pay_at_shop' | 'paid' | 'pending';\n  totalAmount?: number;\n  paidAmount?: number;\n  balanceAmount?: number;\n  balanceStatus?: 'PENDING' | 'COLLECTED';\n  balanceReminderSent?: boolean;`
);
t2 = t2.replace(
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected';`,
  `  type: 'checked_in' | 'cancelled' | 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'new_booking' | 'business_approved' | 'business_rejected' | 'booking_update';`
);
fs.writeFileSync('c:/projects/QGo/src/types/index.ts', t2);
