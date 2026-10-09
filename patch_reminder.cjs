const fs = require('fs');
let content = fs.readFileSync('c:/projects/QGo/server/routes.ts', 'utf8');

const replacement = `
        }

        // Owner Balance Reminder
        if (
          booking.status === 'confirmed' &&
          booking.balanceAmount && booking.balanceAmount > 0 &&
          booking.scheduledDate === todayStr &&
          booking.slotEndTime &&
          !(booking).balanceReminderSent
        ) {
          const endM = timeToMinutes(booking.slotEndTime);
          if (endM - nowMinutes <= 15 && endM - nowMinutes >= -60) {
            booking.balanceReminderSent = true;
            db.bookings.set(booking.id, booking);
            const salon = db.salons.get(booking.salonId);
            if (salon) {
              sendNotification(salon.ownerId, {
                userId: salon.ownerId,
                title: 'Collect Balance Amount',
                message: \`Balance ₹\${booking.balanceAmount} pending for \${booking.customerName || 'Customer'} — Slot \${format12Hour(booking.scheduledTime)} to \${format12Hour(booking.slotEndTime)}. Please collect the balance.\`,
                type: 'booking_update',
                read: false,
                relatedId: booking.id,
              });
            }
          }
        }
      }
    } catch (err)`;

content = content.replace(/\s+\}\r?\n\s+\}\r?\n\s+\} catch \(err\)/, replacement);

fs.writeFileSync('c:/projects/QGo/server/routes.ts', content);
