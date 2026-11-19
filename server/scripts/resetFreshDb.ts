import dotenv from 'dotenv';
dotenv.config();
import { adminDb } from '../firebaseAdmin';

const COLLECTIONS_TO_CLEAR = [
  'salons',
  'bookings',
  'queueEntries',
  'reviews',
  'services',
  'staff',
  'tickets',
  'supportTickets',
  'paymentOrders',
  'auditLogs',
  'notifications',
  'slotHolds',
  'slotLocks',
  'slotReservations',
  'settlementPayouts',
  'adminReminders',
];

const ADMIN_EMAILS = new Set(['cjkishore35@gmail.com']);

export async function resetFreshDatabase() {
  console.log('[resetFreshDb] Starting clean database reset...');

  for (const collName of COLLECTIONS_TO_CLEAR) {
    try {
      const snap = await adminDb.collection(collName).get();
      if (snap.size === 0) {
        console.log(`[resetFreshDb] ${collName}: already empty (0 docs)`);
        continue;
      }
      const batch = adminDb.batch();
      let count = 0;
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });
      await batch.commit();
      console.log(`[resetFreshDb] Cleared ${count} documents from '${collName}'`);
    } catch (err: any) {
      console.warn(`[resetFreshDb] Error clearing ${collName}:`, err?.message || err);
    }
  }

  // Preserve ONLY Super Admin in 'users' - delete all Customer and Owner accounts
  try {
    const userSnap = await adminDb.collection('users').get();
    const batch = adminDb.batch();
    let deleted = 0;
    userSnap.docs.forEach((doc) => {
      const u = doc.data();
      const isSuperAdmin = (u.role === 'admin' || ADMIN_EMAILS.has(u.email)) && u.role !== 'customer' && u.role !== 'owner';
      if (!isSuperAdmin) {
        batch.delete(doc.ref);
        deleted++;
      }
    });
    if (deleted > 0) {
      await batch.commit();
      console.log(`[resetFreshDb] Cleared ${deleted} test non-admin users (all Customer and Owner accounts deleted; Super Admin preserved)`);
    }
  } catch (err: any) {
    console.warn('[resetFreshDb] Error updating users collection:', err?.message || err);
  }

  // Preserve admin roles in 'userRoles'
  try {
    const roleSnap = await adminDb.collection('userRoles').get();
    const batch = adminDb.batch();
    let deleted = 0;
    roleSnap.docs.forEach((doc) => {
      const r = doc.data();
      if (r.role !== 'admin') {
        batch.delete(doc.ref);
        deleted++;
      }
    });
    if (deleted > 0) {
      await batch.commit();
      console.log(`[resetFreshDb] Cleared ${deleted} non-admin user roles (admin roles preserved)`);
    }
  } catch (err: any) {
    console.warn('[resetFreshDb] Error updating userRoles collection:', err?.message || err);
  }

  console.log('[resetFreshDb] Database reset successfully completed. Ready for fresh clean records.');
}

if (process.argv[1]?.includes('resetFreshDb')) {
  resetFreshDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[resetFreshDb] Fatal error:', err);
      process.exit(1);
    });
}
