export type { UserRole } from '../../packages/shared/src/roles';
import type { UserRole } from '../../packages/shared/src/roles';

export interface User {
  id: string;
  phone?: string;
  email?: string;
  name: string;
  role: UserRole;
  activeRole?: UserRole;
  authorizedRoles?: UserRole[];
  salonId?: string;
  staffId?: string;
  profileImage?: string;
  photoUrl?: string;
  isBlocked?: boolean;
  blockedAt?: string;
  blockedReason?: string;
  settledPayoutAmount?: number;
  lastPayoutDate?: string;
  lastActiveAt?: string | null;
  createdAt: string;
}

export interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'approval' | 'refund' | 'payment' | 'reliability' | 'venue' | 'system';
  title: string;
  message: string;
  targetTab: 'venues' | 'bookings' | 'payments' | 'owners' | 'customers' | 'intimations';
  entityId?: string;
  createdAt: string;
}

export interface AdminOverviewKPIs {
  totalGmv: number;
  qgoNetEarnings: number;
  gstCollected: number;
  totalRefunds: number;
  payoutsDue: number;
  payoutsSettled: number;
  todayBookingsCount: number;
  todayCompletedCount: number;
  todayConfirmedCount: number;
  todayCancelledCount: number;
  todayNoShowCount: number;
  todayCheckInCount: number;
  activeSalonsCount: number;
  activeTurfsCount: number;
  pendingApprovalsCount: number;
  totalCustomersCount: number;
  totalOwnersCount: number;
}

export interface AdminTimeSeriesPoint {
  date: string;
  gmv: number;
  qgoEarnings: number;
  bookings: number;
}

export interface AdminOverviewResponse {
  success: boolean;
  kpis: AdminOverviewKPIs;
  timeSeries: {
    '7d': AdminTimeSeriesPoint[];
    '30d': AdminTimeSeriesPoint[];
    '90d': AdminTimeSeriesPoint[];
  };
  statusBreakdown: Record<string, number>;
  categorySplit: { salon: number; turf: number };
  paymentModeSplit: { paid: number; partially_paid: number; pay_at_shop: number };
  alerts: SystemAlert[];
}

export interface AdminOwnerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  isBlocked?: boolean;
  blockedReason?: string;
  isOnline: boolean;
  lastActiveAt?: string | null;
  categories: string[];
  primaryCategory: 'turf' | 'salon' | 'other';
  averageRating: number;
  venues: Salon[];
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  grossRevenue: number;
  qgoFeeDeducted: number;
  refundsDeducted: number;
  netPayable: number;
  settledPayoutAmount: number;
  pendingPayoutBalance: number;
  lastPayoutDate?: string;
}

export interface AdminCustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  isBlocked?: boolean;
  blockedReason?: string;
  isOnline: boolean;
  lastActiveAt?: string | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  reliabilityScore: number;
  totalSpent: number;
  totalRefundsReceived: number;
  lastBookingDate?: string | null;
}

export interface AdminCustomersResponse {
  success: boolean;
  totalCustomers?: number;
  onlineCustomers?: number;
  activeTodayCustomers?: number;
  customers: AdminCustomerRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminOwnersResponse {
  success: boolean;
  totalOwners?: number;
  onlineOwners?: number;
  categoryCounts?: {
    turf: number;
    salon: number;
    other: number;
  };
  owners: AdminOwnerRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthAccount {
  id: string;
  userId: string;
  provider: 'google';
  providerUserId: string; // e.g. Google subject ID
  createdAt: string;
}

export interface UserRoleMap {
  id: string;
  userId: string;
  role: UserRole;
  status: 'active' | 'disabled';
  businessId?: string; // For owner/staff
  branchId?: string;
}

export interface SalonHours {
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  dayName: string;
  openTime: string; // e.g., "09:00"
  closeTime: string; // e.g., "21:00"
  isOpen: boolean;
}

export interface SalonHoliday {
  date: string; // YYYY-MM-DD (start date)
  endDate?: string; // YYYY-MM-DD (end date for leave ranges; if absent = single day)
  reason: string;
}

export type BusinessStatus =
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'live'
  | 'rejected'
  | 'suspended'
  | 'closed';

export interface BookingSettings {
  advanceBookingDays: number;       // How many days ahead customers can book (e.g. 30)
  minNoticeMinutes: number;          // Minimum notice before appointment (e.g. 30)
  cancellationAllowed: boolean;      // Allow player cancellations (e.g. true)
  cancellationDeadlineHours: number; // Hours before appointment (e.g. 2)
  refundPercentage?: number;         // Cancellation refund percentage: 100, 80, 70, 60, 50, 40, 30, 20, 10, 0 (default 70)
  reminderMinutesBefore?: number;    // Reminder notification before start: 15, 30, 60, 120 (default 30)
  customerChoosesStaff: boolean;
  bufferMinutes?: number;            // Buffer time between slots
}

// ─── TURF & RESOURCE SCHEDULING TYPES ───

export interface TurfResource {
  id: string;
  salonId: string;
  name: string; // e.g. "Turf 1", "Turf 2"
  type: string; // '5-a-side' | '7-a-side' | 'Cricket' | 'Football' | 'Multi-purpose' | 'Badminton' | string
  capacity?: number;
  description?: string;
  photoUrl?: string;
  pricePerHour?: number;
  isActive: boolean;
}

export interface SlotBreak {
  id?: string;
  startTime: string; // "13:00"
  endTime: string;   // "14:00"
  reason?: string;   // "Maintenance / Break"
}

export interface CustomSlot {
  id: string;
  startTime: string; // "06:00"
  endTime: string;   // "07:30"
  durationMinutes: number; // 90
  price: number;     // 700
  label?: string;    // "Early Bird Slot"
  resourceId?: string; // 'all' or specific turf ID
  daysOfWeek?: number[]; // [1,2,3,4,5]
  isActive: boolean;
}

export interface PeakPricingRule {
  id?: string;
  startTime: string; // "17:00"
  endTime: string;   // "22:00"
  price: number;     // 1200
  daysOfWeek?: number[]; // [0,6] for weekend or [1,2,3,4,5] for weekday
}

export interface TimePricingPeriod {
  id: string;
  name: string; // "Day", "Evening", "Peak", "Night", etc.
  startTime: string; // "06:00"
  endTime: string;   // "18:00"
  price: number;     // 600
  isActive?: boolean;
}

export interface SlotOverride {
  slotKey: string; // e.g. "09:00" or "09:00-10:00"
  startTime: string;
  endTime: string;
  price?: number;
  isDisabled?: boolean;
}

export interface TurfSlotItem {
  id: string;
  dayOfWeek: number;
  startTime: string; // e.g. "06:00"
  endTime: string;   // e.g. "08:00"
  durationMinutes: number; // e.g. 120
  price: number;     // e.g. 800
  status: 'active' | 'disabled' | 'blocked';
  source: 'generated' | 'custom';
  isCustomized?: boolean;
  isPeak?: boolean;
  periodType?: 'day' | 'night';
  pricingPeriodName?: string;
  label?: string;
  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';
  advanceAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DaySlotConfig {
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  dayName: string;
  isOpen: boolean;
  openTime: string; // e.g. "06:00"
  closeTime: string; // e.g. "22:00"
  slotDurationMinutes: number; // e.g. 60, 90, 120, etc.
  defaultPrice: number; // e.g. 800
  allowPartialSlot?: boolean; // If true, remainder time before closing can form a partial slot
  bufferMinutes?: number; // e.g. 0
  breaks?: SlotBreak[];
  peakPricing?: PeakPricingRule[];
  timePricingPeriods?: TimePricingPeriod[];
  customSlots?: CustomSlot[];
  slotOverrides?: SlotOverride[];
  disabledSlots?: string[];
  slots?: TurfSlotItem[];
}

export interface SpecialDateOverride {
  date: string; // YYYY-MM-DD
  isClosed: boolean;
  reason?: string; // e.g. "Independence Day"
  openTime?: string;
  closeTime?: string;
  slotDurationMinutes?: number;
  price?: number;
  breaks?: SlotBreak[];
}

export interface TurfAvailabilitySchedule {
  id?: string;
  name?: string; // e.g. "October Schedule"
  validFrom?: string; // e.g. "2026-10-01"
  validTo?: string; // e.g. "2026-10-31"
  resourceId?: string; // 'default' or specific turf ID
  days: DaySlotConfig[];
  specialDates?: SpecialDateOverride[];
}

export interface GeneratedTurfSlot {
  id: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  durationMinutes: number;
  price: number;
  isPeak?: boolean;
  isCustom?: boolean;
  available: boolean;
  isBooked?: boolean;
  isBlocked?: boolean;
  status?: 'available' | 'booked' | 'blocked' | 'disabled' | 'closed' | 'completed';
  bookingId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentStatus?: string;
  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';
  advanceAmount?: number;
  bookingStatus?: string;
  bookingCreatedAt?: string;
  resourceId?: string;
  resourceName?: string;
  periodType?: 'day' | 'night';
  label?: string;
}

export interface DashboardOverviewData {
  todayBookingsCount: number;
  todayRevenue: number;
  upcomingBookingsCount: number;
  availableSlotsCount: number;
  completedBookingsCount: number;
  cancelledBookingsCount: number;
  todayDateStr: string;
  todayFormatted: string;
  todaySlots: GeneratedTurfSlot[];
}

export interface OwnerCustomerSummary {
  customerId: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: string;
  upcomingBookingDate?: string;
  cancellationCount: number;
}

export interface OwnerRevenueData {
  grossRevenue: number;
  completedBookingsCount: number;
  completedRevenue: number;
  cancelledBookingsCount: number;
  totalRefunds: number;
  netRevenue: number;
  period: 'today' | 'week' | 'month' | 'custom' | 'all';
  transactions: {
    bookingId: string;
    tokenNumber?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    amount: number;
    refundAmount?: number;
    status: string;
    paymentStatus: string;
    scheduledDate?: string;
    scheduledTime?: string;
    createdAt: string;
  }[];
}

export function isTurfBusiness(category?: string, bookingMode?: string): boolean {
  if (bookingMode === 'resource_slot') return true;
  if (!category) return false;
  const cat = category.toLowerCase();
  return (
    cat.includes('turf') ||
    cat.includes('sports arena') ||
    cat.includes('badminton') ||
    cat.includes('cricket') ||
    cat.includes('football') ||
    cat.includes('box cricket')
  );
}

export interface Salon {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  phone: string;
  email?: string;
  website?: string;
  instagram?: string;
  verified: boolean;
  isPublished: boolean;
  // Business lifecycle status
  status: BusinessStatus;
  setupStep: number;        // 1–8 wizard progress
  // Feature flags
  enableQueue: boolean;     // Does this business use live walk-in queue?
  bookingMode: 'appointment' | 'staff_appointment' | 'resource_slot' | 'date_room';
  bookingSettings: BookingSettings;
  // Resources & Custom Availability Schedule (for Turfs, Courts, Arenas)
  resources?: TurfResource[];
  turfSchedule?: TurfAvailabilitySchedule[];
  joinCode: string;
  pin: string;
  workingHours: SalonHours[];
  holidays: SalonHoliday[];
  rating: number;
  reviewCount: number;
  queueLength: number;
  estimatedWaitMinutes: number;
  startingPrice?: number;
  distanceKm?: number;
  facilities?: string[];
  photos?: string[];
  // Payout & Settlement Agreements
  payoutCycle?: 'weekly' | 'monthly';
  upiId?: string;
  bankAccountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  payoutAgreementAccepted?: boolean;
  payoutAgreementAcceptedAt?: string;
  createdAt: string;
}

export interface Service {
  id: string;
  salonId: string;
  name: string;
  nameTa?: string;          // Optional alternate/Tamil name
  price: number;
  durationMinutes: number;
  category: string;          // Free-form, set by owner (e.g. Hair, Beard, Court, Room, etc.)
  description?: string;
  isActive: boolean;
}

export interface Staff {
  id: string;
  salonId: string;
  userId?: string;
  name: string;
  phone?: string;
  photoUrl: string;
  title: string; // e.g. "Master Stylist", "Senior Barber"
  rating: number;
  reviewCount: number;
  serviceIds: string[];
  status: 'available' | 'busy' | 'break' | 'off';
  isActive: boolean;
  currentServingToken?: string;
  waitingCount?: number;
}

export type BookingMode = 'appointment' | 'token';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Booking {
  id: string;
  salonId: string;
  salonName: string;
  staffId?: string;
  staffName?: string;
  resourceId?: string;    // Turf / Court ID
  resourceName?: string;  // e.g. "Turf 1 (7-a-side)"
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  numberOfPlayers?: number;
  mode: BookingMode;
  scheduledDate?: string; // YYYY-MM-DD for appointments/turf slots
  scheduledTime?: string; // HH:MM for appointments/turf slots
  slotEndTime?: string;   // HH:MM for turf slots (e.g. "10:00")
  slotId?: string;
  slotStatus?: BookingStatus;
  status: BookingStatus;
  qrCodeId: string;
  qrSignature: string;
  tokenNumber?: string; // e.g. SLN48291-20260821-A014
  queuePosition?: number;
  peopleAhead?: number;
  estimatedWaitMinutes?: number;
  estimatedStartTime?: string;
  joinedQueueAt?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: 'owner' | 'customer' | 'system'; // Who initiated the cancellation
  refundPercentage?: number;
  refundAmount?: number;
  nonRefundableAmount?: number;
  refundStatus?: 'none' | 'pending' | 'completed' | 'rejected';
  cancellationDeadlineHours?: number;
  reminderMinutesBefore?: number;
  reminderSent?: boolean;
  isArriving?: boolean;
  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';
  bookingSource?: 'customer' | 'owner_manual';
  totalAmount?: number;
  paidAmount?: number;
  advanceAmount?: number;
  balanceAmount?: number;
  paymentStatus: 'paid' | 'partially_paid' | 'pay_at_shop' | 'pending' | 'refunded' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'PAID';
  balanceStatus?: 'PENDING' | 'COLLECTED';
  balanceCollected?: boolean;
  balanceCollectedAt?: string;
  balanceCollectedBy?: string;
  balanceReminderSent?: boolean;
  convenienceFee?: number;
  gstAmount?: number;
  paymentId?: string;
  orderId?: string;
  paymentSignature?: string;
  amount: number;
  payoutSettled?: boolean;
  payoutSettlementId?: string;
  payoutSettledAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QueueEntry {
  date?: string;
  id: string;
  bookingId: string;
  salonId: string;
  staffId?: string;
  staffName?: string;
  tokenNumber: string;
  position: number;
  status: 'waiting' | 'calling' | 'in_chair' | 'served' | 'skipped' | 'no_show' | 'cancelled';
  joinedAt: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  isAppointment: boolean;
  scheduledTime?: string;
  isArriving?: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  salonId: string;
  staffId?: string;
  staffName?: string;
  rating: number;
  comment: string;
  ownerResponse?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'queue_update' | 'booking_confirmed' | 'next_in_line' | 'reminder' | 'cancelled' | 'new_booking' | 'checked_in' | 'business_approved' | 'business_rejected';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  bookingId?: string;
  targetAudience?: 'customers' | 'owners' | 'all';
  severity?: 'info' | 'warning' | 'critical';
}

export interface AnalyticsData {
  totalRevenue: number;
  totalBookings: number;
  avgServiceTimeMinutes: number;
  noShowRate: number;
  hourlyTraffic: { hour: string; count: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  staffPerformance: { name: string; servedCount: number; avgMins: number; rating: number }[];
}

export interface AnalyticsSummary {
  todayBookingsCount: number;
  todayCompletedCount: number;
  todayWaitingCount: number;
  todayCancelledCount: number;
  todayNoShowCount: number;
  todayRevenue: number;
  averageWaitTimeMinutes: number;
  hourlyTraffic: { hour: string; count: number }[];
  servicePopularity: { name: string; count: number; revenue: number }[];
  staffPerformance: { name: string; completedCount: number; rating: number; revenue: number }[];
}

export type Language = 'en' | 'ta';

export interface SettlementCalculation {
  salonId: string;
  salonName: string;
  category: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  payoutCycle: 'weekly' | 'monthly';
  upiId?: string;
  bankAccountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  payoutAgreementAccepted?: boolean;
  payoutAgreementAcceptedAt?: string;
  totalBookings: number;
  grossSlotValue: number;
  totalOnlineCollected: number;
  qgoConvenienceFee: number;
  qgoGstCollected: number;
  qgoTotalRetained: number;
  netOwnerPayable: number;
  venueBalanceCollected: number;
  cyclePeriodLabel: string;
  nextPayoutDate: string;
  isPayoutDue: boolean;
  unsettledBookingIds: string[];
  allTimeBookingsCount?: number;
  allTimeGrossSlotValue?: number;
  allTimeQgoFee?: number;
  allTimeQgoRetained?: number;
}

export interface SettlementPayoutRecord {
  id: string;
  salonId: string;
  salonName: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  payoutCycle: 'weekly' | 'monthly';
  amountPaid: number;
  paymentMethod: string;
  utrReference: string;
  notes?: string;
  totalBookingsSettled: number;
  bookingIds: string[];
  settledAt: string;
  settledByAdminId: string;
  settledByAdminName: string;
}

export interface AdminSettlementsResponse {
  success: boolean;
  summary: {
    totalOnlineCollected: number;
    qgoPlatformFee: number;
    gstCollected: number;
    netPayableToOwners: number;
    totalSettledHistorical: number;
    vaultGrossQgoPlatformIncome?: number;
    vaultStatutoryGst?: number;
    vaultEstimatedGatewayCost?: number;
    vaultNetProfit?: number;
    totalPendingPayable?: number;
    totalDisbursedHistorical?: number;
    turfMetrics?: {
      venueCount: number;
      totalBookings: number;
      qgoFeeIncome: number;
      disbursedPayouts: number;
      pendingPayouts: number;
    };
    salonMetrics?: {
      venueCount: number;
      totalBookings: number;
      qgoFeeIncome: number;
      disbursedPayouts: number;
      pendingPayouts: number;
    };
  };
  settlements: SettlementCalculation[];
  payoutHistory: SettlementPayoutRecord[];
}

export interface AdminReminderRecord {
  id: string;
  adminId?: string;
  targetTime: string; // e.g. "12:40 PM" or "12:40"
  targetDate?: string; // e.g. "YYYY-MM-DD"
  scheduledDate?: string; // e.g. "YYYY-MM-DD"
  scheduledTime?: string; // e.g. "12:40"
  targetTimestamp?: number; // epoch ms
  targetMinutesOfDay: number; // 0 to 1439
  title: string;
  note?: string;
  triggered: boolean;
  triggeredAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  notifyPhone: string; // default "9600971886"
  createdAt: string;
}

export interface QbeAutonomousAction {
  type:
    | 'schedule_reminder'
    | 'approve_venues'
    | 'export_excel'
    | 'send_whatsapp'
    | 'auto_reply_reviews'
    | 'demand_analysis'
    | 'broadcast'
    | 'navigate'
    | 'navigate_tab'
    | 'venue_drilldown'
    | 'set_theme'
    | 'set_language'
    | 'safety_guard_refusal';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  trace: string[];
  resultText: string;
  data?: any;
}
