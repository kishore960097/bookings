const fs = require('fs');

let content = fs.readFileSync('c:/projects/QGo/server/db.ts', 'utf8');

const missingMethods = `
  public recalculateQueueStats(salonId: string): void {
    // No-op for now, frontend reads live state
  }

  public isSlotLocked(
    salonId: string,
    staffOrResourceId: string,
    date: string,
    time: string
  ): boolean {
    const key = \`\${salonId}:\${staffOrResourceId}:\${date}:\${time}\`;
    return this.slotLocks.has(key);
  }

  public getNextTokenNumber(salonOrId: any): string {
    const id = typeof salonOrId === 'string' ? salonOrId : salonOrId.id;
    const date = new Date().toISOString().split('T')[0];
    const next = this.getNextQueueNumber(id, date);
    return \`T\${next.toString().padStart(3, '0')}\`;
  }

  public getAnalytics(salonId: string): AnalyticsSummary {
    const bookingsList = Array.from(this.bookings.values()).filter(
      (b) => b.salonId === salonId
    );
    const today = new Date().toISOString().split('T')[0];

    const todayBookings = bookingsList.filter(
      (b) => b.createdAt.startsWith(today) || b.scheduledDate === today
    );

    const completed = todayBookings.filter((b) => b.status === 'completed');
    const waiting = todayBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'checked_in'
    );
    const cancelled = todayBookings.filter((b) => b.status === 'cancelled');
    const noShow = todayBookings.filter((b) => b.status === 'no_show');

    const todayRevenue = completed.reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      todayBookingsCount: todayBookings.length,
      todayCompletedCount: completed.length,
      todayWaitingCount: waiting.length,
      todayCancelledCount: cancelled.length,
      todayNoShowCount: noShow.length,
      todayRevenue,
      averageWaitTimeMinutes: 0,
      hourlyTraffic: [],
      servicePopularity: [],
      staffPerformance: [],
    };
  }
`;

content = content.replace(
  `  // --- Slot Locks ---`,
  `  // --- Slot Locks ---\n` + missingMethods
);

fs.writeFileSync('c:/projects/QGo/server/db.ts', content);
console.log('Patched db.ts missing methods');
