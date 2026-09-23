var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/routes.ts
var import_express = require("express");

// server/db.ts
var QGoDatabase = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.salons = /* @__PURE__ */ new Map();
    this.services = /* @__PURE__ */ new Map();
    this.staff = /* @__PURE__ */ new Map();
    this.bookings = /* @__PURE__ */ new Map();
    this.queueEntries = /* @__PURE__ */ new Map();
    this.reviews = /* @__PURE__ */ new Map();
    this.notifications = /* @__PURE__ */ new Map();
    // userId -> notifications
    this.otpStore = /* @__PURE__ */ new Map();
    this.authAccounts = /* @__PURE__ */ new Map();
    this.userRoles = /* @__PURE__ */ new Map();
    // Concurrency Slot Lock Map (key: `${salonId}:${staffId}:${date}:${time}`)
    this.slotLocks = /* @__PURE__ */ new Map();
    // key -> bookingId
    // Queue sequence tracker (key: `${salonId}:${date}` -> counter)
    this.queueSequences = /* @__PURE__ */ new Map();
    if (process.env.ENABLE_DEMO_DATA === "true") {
      this.seedDefaultData();
    }
  }
  seedDefaultData() {
    const defaultHours = [
      { dayOfWeek: 0, dayName: "Sunday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 1, dayName: "Monday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 2, dayName: "Tuesday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 3, dayName: "Wednesday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 4, dayName: "Thursday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 5, dayName: "Friday", openTime: "06:00", closeTime: "23:00", isOpen: true },
      { dayOfWeek: 6, dayName: "Saturday", openTime: "06:00", closeTime: "23:00", isOpen: true }
    ];
    const turf1 = {
      id: "biz_grand_arena_turf",
      ownerId: "usr_owner_demo",
      name: "Grand Arena Sports Turf & Box Cricket",
      businessCategory: "sports_turf",
      category: "\u26BD Sports / Turf",
      description: "FIFA-approved 7-A-Side AstroTurf with high-mast floodlights, box cricket netting, locker rooms, and refreshments.",
      logoUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&h=200&fit=crop",
      coverUrl: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1200&h=600&fit=crop",
      address: "100 Feet Road, Near Metro Pillar 42, Indiranagar",
      city: "Bengaluru",
      lat: 12.9784,
      lng: 77.6408,
      phone: "+91 98765 43210",
      verified: true,
      isPublished: true,
      status: "live",
      setupStep: 8,
      enableQueue: false,
      bookingMode: "resource_slot",
      bookingSettings: {
        advanceBookingDays: 14,
        minNoticeMinutes: 30,
        cancellationAllowed: true,
        cancellationDeadlineHours: 2,
        refundPercentage: 70,
        reminderMinutesBefore: 30,
        customerChoosesStaff: false,
        bufferMinutes: 0
      },
      resources: [
        { id: "res_pitch_a", salonId: "biz_grand_arena_turf", name: "Pitch A (Full 7v7 Football)", type: "7-a-side", capacity: 16, pricePerHour: 1400, isActive: true },
        { id: "res_pitch_b", salonId: "biz_grand_arena_turf", name: "Pitch B (Box Cricket & 5v5)", type: "Cricket", capacity: 12, pricePerHour: 1e3, isActive: true }
      ],
      joinCode: "TURF01",
      pin: "1234",
      workingHours: defaultHours,
      holidays: [],
      rating: 4.9,
      reviewCount: 38,
      queueLength: 0,
      estimatedWaitMinutes: 0,
      startingPrice: 1e3,
      facilities: ["Floodlights", "Dressing Room", "Drinking Water", "Parking", "Equipment Rental"],
      photos: [
        "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&h=500&fit=crop",
        "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop"
      ],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const salon1 = {
      id: "biz_elite_cuts_salon",
      ownerId: "usr_owner_demo2",
      name: "Elite Cuts & Barber Lounge",
      businessCategory: "barber_shop",
      category: "\u{1F487} Barber Shop",
      description: "Premium haircuts, beard styling, hot towel shave, and scalp detox with live queue tracking.",
      logoUrl: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&h=200&fit=crop",
      coverUrl: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=600&fit=crop",
      address: "24 Anna Salai, T. Nagar",
      city: "Chennai",
      lat: 13.0418,
      lng: 80.2341,
      phone: "+91 91234 56789",
      verified: true,
      isPublished: true,
      status: "live",
      setupStep: 8,
      enableQueue: true,
      bookingMode: "appointment",
      bookingSettings: {
        advanceBookingDays: 7,
        minNoticeMinutes: 15,
        cancellationAllowed: true,
        cancellationDeadlineHours: 1,
        refundPercentage: 80,
        reminderMinutesBefore: 30,
        customerChoosesStaff: true,
        bufferMinutes: 5
      },
      joinCode: "ELITE1",
      pin: "5678",
      workingHours: defaultHours,
      holidays: [],
      rating: 4.8,
      reviewCount: 94,
      queueLength: 2,
      estimatedWaitMinutes: 25,
      startingPrice: 250,
      facilities: ["Air Conditioned", "Free WiFi", "Complimentary Beverage", "Card & UPI"],
      photos: [
        "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&h=500&fit=crop",
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=500&fit=crop"
      ],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.salons.set(turf1.id, turf1);
    this.salons.set(salon1.id, salon1);
    this.services.set("srv_football_7v7", {
      id: "srv_football_7v7",
      salonId: turf1.id,
      name: "Football 7v7 (1 Hour Slot)",
      price: 1400,
      durationMinutes: 60,
      category: "Football",
      description: "Full astro-turf field with floodlights and bibs included",
      isActive: true
    });
    this.services.set("srv_box_cricket", {
      id: "srv_box_cricket",
      salonId: turf1.id,
      name: "Box Cricket (1 Hour Slot)",
      price: 1e3,
      durationMinutes: 60,
      category: "Cricket",
      description: "Fully netted box cricket arena with bats and balls provided",
      isActive: true
    });
    this.services.set("srv_signature_haircut", {
      id: "srv_signature_haircut",
      salonId: salon1.id,
      name: "Signature Haircut & Wash",
      nameTa: "\u0BAE\u0BC1\u0B9F\u0BBF \u0BA4\u0BBF\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD",
      price: 350,
      durationMinutes: 30,
      category: "Haircut",
      description: "Precision cut, wash, head massage, and styling",
      isActive: true
    });
    this.services.set("srv_royal_shave", {
      id: "srv_royal_shave",
      salonId: salon1.id,
      name: "Royal Hot Towel Shave",
      nameTa: "\u0BA4\u0BBE\u0B9F\u0BBF \u0BA4\u0BBF\u0BB0\u0BC1\u0BA4\u0BCD\u0BA4\u0BAE\u0BCD",
      price: 250,
      durationMinutes: 20,
      category: "Beard",
      description: "Hot towel prep, organic lather shave, and cold splash balm",
      isActive: true
    });
    this.staff.set("stf_alex_master", {
      id: "stf_alex_master",
      salonId: salon1.id,
      name: "Alex Vance",
      title: "Master Stylist",
      photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
      status: "available",
      isActive: true,
      serviceIds: ["srv_signature_haircut", "srv_royal_shave"],
      rating: 4.9,
      reviewCount: 42
    });
  }
  // Generate Next Sequential Token (e.g., A001, A002) for a given date
  getNextToken(salonOrId, dateStr) {
    const salonId = typeof salonOrId === "string" ? salonOrId : salonOrId.id;
    const date = dateStr || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const key = `${salonId}:${date}`;
    const current = this.queueSequences.get(key) || 0;
    const next = current + 1;
    this.queueSequences.set(key, next);
    const padded = next.toString().padStart(3, "0");
    return `A${padded}`;
  }
  getNextTokenNumber(salonOrId, dateStr) {
    return this.getNextToken(salonOrId, dateStr);
  }
  // Atomic Slot Locking for Double-Booking Prevention (Staff & Resource/Turf slots)
  tryAcquireSlotLock(salonId, staffOrResourceId, date, time, bookingId) {
    const key = `${salonId}:${staffOrResourceId}:${date}:${time}`;
    if (this.slotLocks.has(key)) {
      return false;
    }
    this.slotLocks.set(key, bookingId);
    return true;
  }
  releaseSlotLock(salonId, staffOrResourceId, date, time) {
    const key = `${salonId}:${staffOrResourceId}:${date}:${time}`;
    this.slotLocks.delete(key);
  }
  isSlotLocked(salonId, staffOrResourceId, date, time) {
    const key = `${salonId}:${staffOrResourceId}:${date}:${time}`;
    return this.slotLocks.has(key);
  }
  // Recalculate Live Queue Positions & Dynamic Wait Times
  recalculateQueue(salonId) {
    const salon = this.salons.get(salonId);
    if (!salon) return;
    const waitingEntries = Array.from(this.queueEntries.values()).filter(
      (e) => e.salonId === salonId && (e.status === "waiting" || e.status === "calling")
    ).sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
    salon.queueLength = waitingEntries.length;
    const activeStaff = Array.from(this.staff.values()).filter(
      (s) => s.salonId === salonId && s.isActive && s.status !== "break"
    );
    const activeStaffCount = Math.max(1, activeStaff.length);
    let totalDuration = 0;
    waitingEntries.forEach((entry, index) => {
      totalDuration += entry.serviceDuration || 30;
      entry.position = index + 1;
      const booking = this.bookings.get(entry.bookingId);
      if (booking) {
        booking.queuePosition = index + 1;
        booking.peopleAhead = index;
        booking.estimatedWaitMinutes = Math.max(
          0,
          Math.round(totalDuration / activeStaffCount)
        );
      }
    });
    salon.estimatedWaitMinutes = waitingEntries.length === 0 ? 0 : Math.round(totalDuration / activeStaffCount);
  }
  recalculateQueueStats(salonId) {
    this.recalculateQueue(salonId);
  }
  // Get aggregated Analytics for an owner (100% computed from real DB data)
  getAnalytics(salonId) {
    const bookingsList = Array.from(this.bookings.values()).filter(
      (b) => b.salonId === salonId
    );
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayBookings = bookingsList.filter(
      (b) => b.createdAt.startsWith(today) || b.scheduledDate === today
    );
    const completed = todayBookings.filter((b) => b.status === "completed");
    const waiting = todayBookings.filter(
      (b) => b.status === "confirmed" || b.status === "checked_in"
    );
    const cancelled = todayBookings.filter((b) => b.status === "cancelled");
    const noShow = todayBookings.filter((b) => b.status === "no_show");
    const todayRevenue = completed.reduce((sum, b) => sum + (b.amount || 0), 0);
    const hours = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00"
    ];
    const hourlyTraffic = hours.map((hour) => {
      const hPrefix = hour.split(":")[0];
      const count = todayBookings.filter(
        (b) => b.scheduledTime ? b.scheduledTime.startsWith(hPrefix) : false
      ).length;
      return { hour, count };
    });
    const servicePopularity = Array.from(this.services.values()).filter((s) => s.salonId === salonId).map((srv) => {
      const count = bookingsList.filter((b) => b.serviceId === srv.id).length;
      return {
        name: srv.name,
        count,
        revenue: count * srv.price
      };
    }).sort((a, b) => b.count - a.count);
    const staffPerformance = Array.from(this.staff.values()).filter((st) => st.salonId === salonId).map((st) => {
      const staffCompleted = bookingsList.filter(
        (b) => b.staffId === st.id && b.status === "completed"
      ).length;
      return {
        name: st.name,
        completedCount: staffCompleted,
        rating: st.rating || 0,
        revenue: staffCompleted * 250
      };
    });
    return {
      todayBookingsCount: todayBookings.length,
      todayCompletedCount: completed.length,
      todayWaitingCount: waiting.length,
      todayCancelledCount: cancelled.length,
      todayNoShowCount: noShow.length,
      todayRevenue,
      averageWaitTimeMinutes: 0,
      hourlyTraffic,
      servicePopularity,
      staffPerformance
    };
  }
};
var db = new QGoDatabase();

// packages/shared/types/index.ts
var MASTER_CATEGORIES = [
  { id: "barber_shop", label: "\u{1F487} Barber Shop" },
  { id: "unisex_salon", label: "\u{1F487} Unisex Salon" },
  { id: "beauty_parlour", label: "\u{1F485} Beauty Parlour" },
  { id: "spa", label: "\u{1F486} Spa" },
  { id: "doctor_clinic", label: "\u{1F3E5} Doctor Clinic" },
  { id: "dental_clinic", label: "\u{1F9B7} Dental Clinic" },
  { id: "diagnostic_lab", label: "\u{1F9EA} Diagnostic Lab" },
  { id: "swimming_pool", label: "\u{1F3CA} Swimming Pool" },
  { id: "hotel_resort", label: "\u{1F3E8} Hotel / Resort" },
  { id: "sports_turf", label: "\u26BD Sports / Turf" },
  { id: "custom_other", label: "\u{1F4CB} Custom / Other" }
];
function isTurfBusiness(category, businessCategoryID, bookingMode) {
  if (bookingMode === "resource_slot") return true;
  if (businessCategoryID === "sports_turf" || businessCategoryID === "swimming_pool") return true;
  if (!category) return false;
  const cat = category.toLowerCase();
  return cat === "sports_turf" || cat === "swimming_pool" || cat.includes("turf") || cat.includes("sports arena") || cat.includes("badminton") || cat.includes("cricket") || cat.includes("football") || cat.includes("pool") || cat.includes("box cricket");
}

// server/routes.ts
var import_google_auth_library = require("google-auth-library");
var import_crypto = __toESM(require("crypto"), 1);

// packages/shared/src/time.ts
function timeToMinutes(time) {
  if (!time) return 0;
  const [rawHours, rawMinutes] = time.split(":").map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 0;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  return hours * 60 + minutes;
}
function minutesToTime(totalMinutes) {
  const normalized = (totalMinutes % 1440 + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function format12Hour(time) {
  if (!time) return "";
  const [rawHours, rawMinutes] = time.split(":").map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 0;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}
function isMinuteInInterval(minuteOfDay, startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === endMinutes) {
    return true;
  }
  if (endMinutes > startMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }
  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}

// server/lib/firebaseAdmin.ts
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
var import_storage = require("firebase-admin/storage");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var projectId = process.env.FIREBASE_PROJECT_ID || "";
var storageBucket = process.env.FIREBASE_STORAGE_BUCKET || void 0;
var hasExplicitCredentialSource = Boolean(
  process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
);
function getCredential() {
  if (!hasExplicitCredentialSource && process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS !== "true") {
    return void 0;
  }
  try {
    return (0, import_app.applicationDefault)();
  } catch (error) {
    console.error("[FIREBASE] Could not load application default credentials:", error);
    return void 0;
  }
}
var credential = getCredential();
var isFirebaseConfigured = Boolean(credential && projectId);
var firebaseApp;
if (isFirebaseConfigured) {
  firebaseApp = (0, import_app.getApps)()[0] || (0, import_app.initializeApp)({
    credential,
    projectId,
    storageBucket
  });
}
var firebaseAdmin = firebaseApp ? (0, import_firestore.getFirestore)(firebaseApp) : null;
var firebaseAuth = firebaseApp ? (0, import_auth.getAuth)(firebaseApp) : null;
var firebaseStorage = firebaseApp ? (0, import_storage.getStorage)(firebaseApp) : null;
function getFirebaseStatus() {
  return {
    configured: isFirebaseConfigured,
    projectId: projectId || null
  };
}

// server/businessPersistence.ts
var BUSINESS_COLLECTION = "qgo_businesses";
var CATEGORY_COLLECTION = "qgo_business_categories";
var USER_COLLECTION = "qgo_users";
var STATE_COLLECTION = "qgo_state";
var STATE_DOCUMENT = "current";
var FIREBASE_CATEGORIES = [
  ["barber_shop", "Barber Shop", "Haircuts, grooming, beard styling, and barber services."],
  ["unisex_salon", "Unisex Salon", "Hair, beauty, and grooming services for everyone."],
  ["beauty_parlour", "Beauty Parlour", "Beauty, makeup, skincare, and personal-care services."],
  ["spa", "Spa", "Massage, wellness, relaxation, and spa treatments."],
  ["doctor_clinic", "Doctor Clinic", "Consultations and healthcare services."],
  ["dental_clinic", "Dental Clinic", "Dental consultations and oral-care services."],
  ["diagnostic_lab", "Diagnostic Lab", "Medical tests, scans, and diagnostic services."],
  ["swimming_pool", "Swimming Pool", "Swimming pools, coaching, and pool facilities."],
  ["hotel_resort", "Hotel / Resort", "Hotels, resorts, stays, and hospitality services."],
  ["sports_turf", "Sports / Turf", "Sports grounds, turfs, courts, and resource-slot bookings."],
  ["custom_other", "Custom/Other", "Any other business category entered by the owner."]
];
async function ensureFirebaseCategories() {
  if (!firebaseAdmin || !isFirebaseConfigured) return;
  try {
    const batch = firebaseAdmin.batch();
    FIREBASE_CATEGORIES.forEach(([id, name, description]) => {
      batch.set(firebaseAdmin.collection(CATEGORY_COLLECTION).doc(id), {
        id,
        name,
        description,
        isActive: true,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    console.error("[FIREBASE] Could not initialize business categories:", error);
  }
}
async function loadPersistedSalons() {
  if (!firebaseAdmin || !isFirebaseConfigured) return [];
  try {
    const snapshot = await firebaseAdmin.collection(BUSINESS_COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data().payload).filter((salon) => salon && typeof salon.id === "string");
  } catch (error) {
    console.error("[FIREBASE] Could not load business snapshots:", error);
    return [];
  }
}
async function saveSalonSnapshot(salon) {
  if (!firebaseAdmin || !isFirebaseConfigured) return;
  try {
    await firebaseAdmin.collection(BUSINESS_COLLECTION).doc(salon.id).set({
      id: salon.id,
      ownerId: salon.ownerId,
      category: salon.businessCategory || salon.category || null,
      name: salon.name,
      payload: salon,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
  } catch (error) {
    console.error(`[FIREBASE] Could not save business snapshot ${salon.id}:`, error);
  }
}
async function loadPersistedUsers() {
  if (!firebaseAdmin || !isFirebaseConfigured) return [];
  try {
    const snapshot = await firebaseAdmin.collection(USER_COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data().payload).filter((user) => user && typeof user.id === "string");
  } catch (error) {
    console.error("[FIREBASE] Could not load user records:", error);
    return [];
  }
}
async function saveUserSnapshot(user) {
  if (!firebaseAdmin || !isFirebaseConfigured) return;
  try {
    await firebaseAdmin.collection(USER_COLLECTION).doc(user.id).set({
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      name: user.name,
      role: user.role,
      payload: user,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
  } catch (error) {
    console.error(`[FIREBASE] Could not save user ${user.id}:`, error);
  }
}
async function syncFirebaseAuthUser(user) {
  if (!firebaseAuth || !isFirebaseConfigured || !user.email) return;
  try {
    let authUser;
    try {
      authUser = await firebaseAuth.getUserByEmail(user.email);
      authUser = await firebaseAuth.updateUser(authUser.uid, {
        displayName: user.name,
        photoURL: user.profileImage
      });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
      authUser = await firebaseAuth.createUser({
        email: user.email,
        emailVerified: true,
        displayName: user.name,
        photoURL: user.profileImage
      });
    }
    await saveUserSnapshot(user);
  } catch (error) {
    console.error(`[FIREBASE] Could not sync auth user ${user.email}:`, error);
    await saveUserSnapshot(user);
  }
}
var STATE_MAPS = [
  "users",
  "salons",
  "services",
  "staff",
  "bookings",
  "queueEntries",
  "reviews",
  "notifications",
  "authAccounts",
  "userRoles"
];
async function loadDatabaseSnapshot(target) {
  if (!firebaseAdmin || !isFirebaseConfigured) return false;
  try {
    const snapshot = await firebaseAdmin.collection(STATE_COLLECTION).doc(STATE_DOCUMENT).get();
    const payload = snapshot.data()?.payload;
    if (!payload) return false;
    STATE_MAPS.forEach((name) => {
      const entries = payload[name];
      if (Array.isArray(entries)) target[name] = new Map(entries);
    });
    return true;
  } catch (error) {
    console.error("[FIREBASE] Could not load application state:", error);
    return false;
  }
}
async function saveDatabaseSnapshot(source) {
  if (!firebaseAdmin || !isFirebaseConfigured) return;
  try {
    const payload = Object.fromEntries(
      STATE_MAPS.map((name) => [name, Array.from(source[name].entries())])
    );
    await firebaseAdmin.collection(STATE_COLLECTION).doc(STATE_DOCUMENT).set({
      payload,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    console.error("[FIREBASE] Could not save application state:", error);
  }
}

// server/routes.ts
var googleClientIds = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_IDS,
  process.env.VITE_GOOGLE_CLIENT_ID
].flatMap((value) => (value || "").split(",")).map((value) => value.trim()).filter(Boolean);
var googleClientId = googleClientIds[0];
var googleClient = new import_google_auth_library.OAuth2Client(googleClientId);
var sessionSecret = process.env.QGO_SESSION_SECRET || import_crypto.default.randomBytes(32).toString("hex");
var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
var isDevOtpEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_OTP === "true";
var ADMIN_EMAIL = "cjkishore35@gmail.com";
function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}
function signSessionPayload(encodedPayload) {
  return import_crypto.default.createHmac("sha256", sessionSecret).update(encodedPayload).digest("base64url");
}
function issueSessionToken(userId, role) {
  const now = Date.now();
  const payload = {
    sid: import_crypto.default.randomUUID(),
    uid: userId,
    role,
    iat: now,
    exp: now + SESSION_TTL_MS
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload);
  return `qgo_session.${encodedPayload}.${signature}`;
}
function verifySessionToken(rawToken) {
  const parts = rawToken.split(".");
  if (parts.length !== 3 || parts[0] !== "qgo_session") {
    return null;
  }
  const [, encodedPayload, signature] = parts;
  const expectedSignature = signSessionPayload(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !import_crypto.default.timingSafeEqual(provided, expected)) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (!payload.uid || !payload.role || !payload.exp || Date.now() > payload.exp) {
    return null;
  }
  if (!["consumer", "owner", "admin"].includes(payload.role)) {
    return null;
  }
  return payload;
}
function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.replace("Bearer ", "").trim();
}
function normalizeRequestedRole(role) {
  if (role === void 0 || role === null || role === "consumer" || role === "customer") return "consumer";
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return null;
}
function isAdminUser(user) {
  return user.email?.trim().toLowerCase() === ADMIN_EMAIL;
}
function getAuthorizedRoles(user) {
  const roles = /* @__PURE__ */ new Set(["consumer"]);
  if (isAdminUser(user) || user.role === "admin") roles.add("admin");
  Array.from(db.userRoles.values()).filter((r) => r.userId === user.id && r.status === "active").forEach((r) => roles.add(r.role));
  if (Array.from(db.salons.values()).some((s) => s.ownerId === user.id)) {
    roles.add("owner");
  }
  return Array.from(roles);
}
function ensureConsumerRole(userId) {
  const existing = Array.from(db.userRoles.values()).find((r) => r.userId === userId && r.role === "consumer");
  if (!existing) {
    const id = `rm_${import_crypto.default.randomUUID()}`;
    db.userRoles.set(id, {
      id,
      userId,
      role: "consumer",
      status: "active"
    });
  }
}
function ensureOwnerRole(userId, businessId) {
  const existing = Array.from(db.userRoles.values()).find((r) => r.userId === userId && r.role === "owner");
  if (!existing) {
    const id = `rm_${import_crypto.default.randomUUID()}`;
    db.userRoles.set(id, {
      id,
      userId,
      role: "owner",
      status: "active",
      businessId
    });
    return;
  }
  existing.status = "active";
  if (businessId && !existing.businessId) {
    existing.businessId = businessId;
  }
}
function buildAuthenticatedUser(user, activeRole) {
  const authorizedRoles = getAuthorizedRoles(user);
  const ownerSalon = activeRole === "owner" ? Array.from(db.salons.values()).find((s) => s.ownerId === user.id) : void 0;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    role: activeRole,
    activeRole,
    authorizedRoles,
    salonId: ownerSalon?.id,
    createdAt: user.createdAt
  };
}
function requireAuth(req, res, next) {
  const rawToken = getBearerToken(req);
  if (!rawToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const session = verifySessionToken(rawToken);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = db.users.get(session.uid);
  if (!user) {
    return res.status(401).json({ error: "User session not found" });
  }
  const authorizedRoles = getAuthorizedRoles(user);
  if (!authorizedRoles.includes(session.role)) {
    return res.status(403).json({ error: "Session role is no longer authorized" });
  }
  req.auth = {
    userId: session.uid,
    role: session.role,
    sessionId: session.sid,
    user
  };
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== "admin" || !isAdminUser(req.auth.user)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
function requireOwner(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const authorizedRoles = getAuthorizedRoles(req.auth.user);
  if (req.auth.role !== "owner" && !authorizedRoles.includes("owner")) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
function canManageSalon(auth, salonId) {
  if (!auth) return false;
  const salon = db.salons.get(salonId);
  if (!salon) return false;
  return salon.ownerId === auth.userId;
}
function canActOnStaff(auth, salonId, _staffId) {
  return canManageSalon(auth, salonId);
}
function canReadBooking(auth, booking) {
  if (!auth) return false;
  if (booking.customerId === auth.userId) return true;
  return canManageSalon(auth, booking.salonId);
}
function optionalAuth(req) {
  const rawToken = getBearerToken(req);
  if (!rawToken) return void 0;
  const session = verifySessionToken(rawToken);
  if (!session) return void 0;
  const user = db.users.get(session.uid);
  if (!user) return void 0;
  const authorizedRoles = getAuthorizedRoles(user);
  if (!authorizedRoles.includes(session.role)) return void 0;
  return {
    userId: session.uid,
    role: session.role,
    sessionId: session.sid,
    user
  };
}
function forbidden(res) {
  return res.status(403).json({ error: "Forbidden" });
}
function sanitizeSalon(salon, includePrivate = false) {
  if (includePrivate) return salon;
  const { ownerId, pin, ...publicSalon } = salon;
  return publicSalon;
}
function sanitizeStaff(staff, includePrivate = false) {
  if (includePrivate) return staff;
  const { userId, phone, ...publicStaff } = staff;
  return publicStaff;
}
function sanitizeReview(review, includePrivate = false) {
  if (includePrivate) return review;
  const { bookingId, customerId, ...publicReview } = review;
  return publicReview;
}
function sanitizeQueueEntry(entry, includePrivate = false) {
  if (includePrivate) return entry;
  const { bookingId, customerName, customerPhone, ...publicEntry } = entry;
  return publicEntry;
}
function isValidStaffStatus(status) {
  return status === "available" || status === "busy" || status === "break" || status === "off";
}
function isValidBookingStatus(status) {
  return status === "pending" || status === "confirmed" || status === "checked_in" || status === "in_progress" || status === "completed" || status === "cancelled" || status === "no_show";
}
async function verifyGoogleIdentity(tokenToVerify) {
  if (!googleClientIds.length) {
    throw new Error("Google OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID to .env.");
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: tokenToVerify,
      audience: googleClientIds
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error("Google identity is incomplete or email is not verified");
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  } catch (idTokenError) {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(tokenToVerify)}`
    );
    if (!tokenInfoRes.ok) {
      throw new Error("Failed to verify Google identity token. Please try signing in again.");
    }
    const tokenInfo = await tokenInfoRes.json();
    if (!tokenInfo.aud || !googleClientIds.includes(tokenInfo.aud) || !(tokenInfo.sub || tokenInfo.user_id) || !tokenInfo.email) {
      throw new Error("Failed to verify Google identity. Invalid audience or missing claims.");
    }
    if (tokenInfo.email_verified !== true && tokenInfo.email_verified !== "true") {
      throw new Error("Google email is not verified");
    }
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenToVerify}` }
    });
    if (!userinfoRes.ok) {
      throw new Error("Failed to load verified Google profile");
    }
    const userInfo = await userinfoRes.json();
    const sub = userInfo.sub || tokenInfo.sub || tokenInfo.user_id;
    const email = (userInfo.email || tokenInfo.email).toLowerCase();
    if (!sub || email !== tokenInfo.email.toLowerCase()) {
      throw new Error("Google identity verification mismatch");
    }
    return {
      sub,
      email,
      name: userInfo.name,
      picture: userInfo.picture,
      email_verified: userInfo.email_verified
    };
  }
}
var apiRouter = (0, import_express.Router)();
function sendNotification(userId, notification) {
  const userNotifs = db.notifications.get(userId) || [];
  const newNotif = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    read: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  userNotifs.unshift(newNotif);
  db.notifications.set(userId, userNotifs);
}
function enrichPublicSalon(salon) {
  const activeServices = Array.from(db.services.values()).filter((srv) => srv.salonId === salon.id && srv.isActive);
  const startingPrice = activeServices.length > 0 ? Math.min(...activeServices.map((srv) => srv.price)) : void 0;
  const facilities = [
    .../* @__PURE__ */ new Set([
      ...activeServices.map((srv) => String(srv.category)).filter(Boolean),
      salon.category
    ])
  ];
  return {
    ...sanitizeSalon(salon),
    startingPrice,
    facilities,
    photos: [salon.coverUrl, salon.logoUrl].filter(Boolean)
  };
}
function makeQrSignature(bookingId, salonId, qrCodeId) {
  return import_crypto.default.createHmac("sha256", sessionSecret).update(`${bookingId}:${salonId}:${qrCodeId}`).digest("base64url");
}
function isBookingExpired(booking) {
  if (booking.mode === "appointment" && booking.scheduledDate && booking.scheduledTime) {
    const endsAt = /* @__PURE__ */ new Date(`${booking.scheduledDate}T${booking.scheduledTime}:00`);
    endsAt.setMinutes(endsAt.getMinutes() + (booking.serviceDuration || 30));
    return Date.now() > endsAt.getTime();
  }
  const createdAt = new Date(booking.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt > 12 * 60 * 60 * 1e3;
}
function validateBookingForCheckIn(booking, salonId, parsed, expectsSignedQr = false) {
  if (!booking) {
    return {
      ok: false,
      status: 404,
      reason: "INVALID_QR",
      message: "No matching booking found for this QR code."
    };
  }
  if (booking.salonId !== salonId) {
    return {
      ok: false,
      status: 403,
      reason: "WRONG_SALON",
      message: "This booking pass belongs to another shop.",
      booking
    };
  }
  if (expectsSignedQr && parsed?.qrSignature !== booking.qrSignature) {
    return {
      ok: false,
      status: 403,
      reason: "INVALID_SIGNATURE",
      message: "QR signature could not be verified."
    };
  }
  if (booking.status === "checked_in") {
    return {
      ok: false,
      status: 400,
      reason: "ALREADY_CHECKED_IN",
      message: "This booking has already been accepted.",
      booking
    };
  }
  if (booking.status === "cancelled" || booking.status === "no_show" || booking.status === "completed") {
    return {
      ok: false,
      status: 400,
      reason: booking.status.toUpperCase(),
      message: "This booking is not eligible for check-in.",
      booking
    };
  }
  if (isBookingExpired(booking)) {
    return {
      ok: false,
      status: 400,
      reason: "EXPIRED",
      message: "This booking pass has expired.",
      booking
    };
  }
  return { ok: true, status: 200, booking };
}
function elapsedSlotMinutes(startTime, endTime, fallbackMinutes = 60) {
  if (!endTime) return fallbackMinutes;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start ? end - start : end + 1440 - start;
}
function bookingEndMinute(booking, fallbackMinutes = 60) {
  const start = timeToMinutes(booking.scheduledTime || "00:00");
  if (!booking.slotEndTime) return start + (booking.serviceDuration || fallbackMinutes);
  const end = timeToMinutes(booking.slotEndTime);
  return end > start ? end : end + 1440;
}
function getTurfSlotPrice(salon, resource, date, startTime, durationMinutes) {
  const schedule = salon.turfSchedule?.find((item) => item.resourceId === resource?.id) || salon.turfSchedule?.find((item) => !item.resourceId || item.resourceId === "default");
  const dayOfWeek = (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).getUTCDay();
  const dayConfig = schedule?.days?.find((day) => day.dayOfWeek === dayOfWeek);
  const specialDate = schedule?.specialDates?.find((item) => item.date === date) || salon.holidays?.find((item) => item.date === date);
  const activePeriods = (dayConfig?.timePricingPeriods || []).filter((period) => period.isActive !== false);
  const startMinutes = timeToMinutes(startTime);
  const matchingPeriod = activePeriods.find((period) => {
    let periodStart = timeToMinutes(period.startTime);
    let periodEnd = timeToMinutes(period.endTime);
    if (periodEnd <= periodStart) periodEnd += 1440;
    const openMinutes = dayConfig ? timeToMinutes(dayConfig.openTime) : 0;
    if (periodStart < openMinutes) {
      periodStart += 1440;
      periodEnd += 1440;
    }
    const normalizedStart = startMinutes < periodStart ? startMinutes + 1440 : startMinutes;
    return normalizedStart >= periodStart && normalizedStart + durationMinutes <= periodEnd;
  });
  const hourlyPrice = matchingPeriod?.price || specialDate && "price" in specialDate && specialDate.price || (startMinutes >= 18 * 60 || startMinutes < 6 * 60 ? 800 : 600);
  return Math.round(hourlyPrice * (durationMinutes / 60));
}
function classifySlotPeriod(startTime, matchedPeriodName, activePeriods) {
  const namedMatch = matchedPeriodName.toLowerCase();
  if (namedMatch.includes("night") || namedMatch.includes("overnight")) return "night";
  if (namedMatch.includes("day")) return "day";
  const nightPeriod = activePeriods.find((period) => {
    const name = period.name.toLowerCase();
    return name.includes("night") || name.includes("overnight");
  });
  if (nightPeriod && isMinuteInInterval(timeToMinutes(startTime), nightPeriod.startTime, nightPeriod.endTime)) {
    return "night";
  }
  return isMinuteInInterval(timeToMinutes(startTime), "18:00", "06:00") ? "night" : "day";
}
function releaseBookingSlotLock(booking) {
  if (booking.resourceId && booking.scheduledDate && booking.scheduledTime) {
    db.releaseSlotLock(booking.salonId, booking.resourceId, booking.scheduledDate, booking.scheduledTime);
  }
  if (booking.staffId && booking.scheduledDate && booking.scheduledTime) {
    db.releaseSlotLock(booking.salonId, booking.staffId, booking.scheduledDate, booking.scheduledTime);
  }
}
apiRouter.post("/auth/otp/request", (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ error: "Phone number is required" });
  }
  const otp = import_crypto.default.randomInt(1e5, 1e6).toString();
  const expiresAt = Date.now() + 5 * 60 * 1e3;
  db.otpStore.set(phone, { otp, expiresAt, attempts: 0 });
  if (isDevOtpEnabled) {
    console.log(`[AUTH][DEV] OTP for ${phone} is: ${otp}`);
  }
  return res.json({
    success: true,
    message: `OTP sent successfully to ${phone}`,
    cooldownSeconds: 30,
    devOtp: isDevOtpEnabled ? otp : void 0
  });
});
apiRouter.post("/auth/otp/verify", async (req, res) => {
  const { phone, otp, name, requestedRole = "consumer" } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone and OTP are required" });
  }
  const normalizedRole = normalizeRequestedRole(requestedRole);
  if (!normalizedRole) {
    return res.status(403).json({
      error: "Requested role is not authorized for this account.",
      code: "ROLE_NOT_AUTHORIZED"
    });
  }
  if (normalizedRole === "admin") {
    return res.status(403).json({ error: "Admin access uses the authorized Google account.", code: "ROLE_NOT_AUTHORIZED" });
  }
  const stored = db.otpStore.get(phone);
  if (!stored) {
    return res.status(400).json({ error: "No OTP requested for this phone or OTP expired" });
  }
  if (Date.now() > stored.expiresAt) {
    db.otpStore.delete(phone);
    return res.status(400).json({ error: "OTP has expired. Please request a new one" });
  }
  if (stored.attempts >= 5) {
    db.otpStore.delete(phone);
    return res.status(429).json({ error: "Maximum verification attempts exceeded. Please request a new OTP" });
  }
  stored.attempts += 1;
  if (stored.otp !== otp && !(isDevOtpEnabled && otp === "123456")) {
    return res.status(400).json({ error: "Invalid OTP code entered" });
  }
  db.otpStore.delete(phone);
  let user = Array.from(db.users.values()).find((u) => u.phone === phone);
  if (!user) {
    user = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone,
      name: name || "Customer",
      role: normalizedRole,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.users.set(user.id, user);
  }
  ensureConsumerRole(user.id);
  if (normalizedRole === "owner") {
    const existingOwnerRole = Array.from(db.userRoles.values()).find(
      (r) => r.userId === user.id && r.role === "owner"
    );
    if (!existingOwnerRole) {
      const id = `rm_${import_crypto.default.randomUUID()}`;
      db.userRoles.set(id, {
        id,
        userId: user.id,
        role: "owner",
        status: "active"
      });
    }
  }
  user.role = normalizedRole;
  user.activeRole = normalizedRole;
  user.authorizedRoles = getAuthorizedRoles(user);
  await saveUserSnapshot(user);
  const token = issueSessionToken(user.id, normalizedRole);
  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, normalizedRole),
    token
  });
});
apiRouter.post("/auth/google", async (req, res) => {
  const { token, credential: credential2, accessToken, requestedRole = "consumer" } = req.body;
  const tokenToVerify = token || credential2 || accessToken;
  if (!tokenToVerify || typeof tokenToVerify !== "string") {
    return res.status(400).json({ error: "Missing Google credential or access token" });
  }
  try {
    const normalizedRole = normalizeRequestedRole(requestedRole);
    if (!normalizedRole) {
      return res.status(403).json({
        error: "Requested role is not authorized for this account.",
        code: "ROLE_NOT_AUTHORIZED"
      });
    }
    const { email, sub: googleId, name, picture } = await verifyGoogleIdentity(tokenToVerify);
    if (normalizedRole === "admin" && email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "This Google account is not authorized for admin access.", code: "ROLE_NOT_AUTHORIZED" });
    }
    let authAccount = Array.from(db.authAccounts.values()).find(
      (a) => a.provider === "google" && a.providerUserId === googleId
    );
    let user;
    if (authAccount) {
      user = db.users.get(authAccount.userId);
    }
    if (!user) {
      user = Array.from(db.users.values()).find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        user = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          email,
          name: name || "QGo User",
          role: "consumer",
          profileImage: picture,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.users.set(user.id, user);
      }
      if (!authAccount) {
        authAccount = {
          id: `auth_${Date.now()}`,
          userId: user.id,
          provider: "google",
          providerUserId: googleId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.authAccounts.set(authAccount.id, authAccount);
      }
    }
    ensureConsumerRole(user.id);
    if (normalizedRole === "owner") {
      const existingOwnerRole = Array.from(db.userRoles.values()).find(
        (r) => r.userId === user.id && r.role === "owner"
      );
      if (!existingOwnerRole) {
        const id = `rm_${import_crypto.default.randomUUID()}`;
        db.userRoles.set(id, {
          id,
          userId: user.id,
          role: "owner",
          status: "active"
        });
      }
    }
    const authorizedRoles = getAuthorizedRoles(user);
    const activeRole = email.toLowerCase() === ADMIN_EMAIL ? "admin" : normalizedRole;
    user.role = activeRole;
    user.activeRole = activeRole;
    user.authorizedRoles = authorizedRoles;
    await syncFirebaseAuthUser(user);
    const token2 = issueSessionToken(user.id, activeRole);
    return res.json({
      success: true,
      user: buildAuthenticatedUser(user, activeRole),
      token: token2
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(401).json({ error: error?.message || "Failed to authenticate with Google" });
  }
});
apiRouter.get("/auth/google/mobile", (req, res) => {
  const role = req.query.role || "consumer";
  const redirectUri = `${req.protocol}://${req.get("host")}/api/v1/auth/google/mobile-callback`;
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", googleClientId || "");
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "token");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", String(role));
  googleAuthUrl.searchParams.set("prompt", "select_account");
  res.redirect(googleAuthUrl.toString());
});
apiRouter.get("/auth/google/mobile-callback", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Authenticating...</title></head>
      <body>
        <script>
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const role = params.get('state') || 'consumer';

          if (accessToken) {
            // Redirect to the custom URI scheme
            window.location.href = 'qgo://auth/callback?access_token=' + accessToken + '&role=' + role;
          } else {
            document.body.innerText = 'Authentication failed. No token received.';
          }
        </script>
      </body>
    </html>
  `;
  res.send(html);
});
apiRouter.get("/auth/me", requireAuth, (req, res) => {
  const { user, role } = req.auth;
  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, role)
  });
});
apiRouter.post("/auth/switch-role", requireAuth, (req, res) => {
  const requestedRole = normalizeRequestedRole(req.body?.role);
  if (!requestedRole) {
    return res.status(400).json({ error: "Invalid role requested" });
  }
  const user = req.auth.user;
  ensureConsumerRole(user.id);
  if (requestedRole === "owner") {
    const ownerRole = Array.from(db.userRoles.values()).find(
      (r) => r.userId === user.id && r.role === "owner"
    );
    if (!ownerRole) {
      const id = `rm_${import_crypto.default.randomUUID()}`;
      db.userRoles.set(id, {
        id,
        userId: user.id,
        role: "owner",
        status: "active"
      });
    } else if (ownerRole.status !== "active") {
      return res.status(403).json({ error: "Owner role is disabled for this account" });
    }
  }
  const authorizedRoles = getAuthorizedRoles(user);
  if (!authorizedRoles.includes(requestedRole)) {
    return res.status(403).json({ error: "Requested role is not authorized for this account" });
  }
  user.role = requestedRole;
  user.activeRole = requestedRole;
  user.authorizedRoles = authorizedRoles;
  return res.json({
    success: true,
    user: buildAuthenticatedUser(user, requestedRole),
    token: issueSessionToken(user.id, requestedRole)
  });
});
apiRouter.post("/auth/demo", (_req, res) => {
  return res.status(403).json({
    success: false,
    error: "Demo access is not available. Please sign in with Google or OTP."
  });
});
apiRouter.get("/salons", (req, res) => {
  const { search, category, openNow, maxWait } = req.query;
  let salonsList = Array.from(db.salons.values()).filter((s) => s.isPublished);
  salonsList.forEach((s) => {
    db.recalculateQueue(s.id);
    const salonReviews = Array.from(db.reviews.values()).filter((r) => r.salonId === s.id);
    s.reviewCount = salonReviews.length;
    s.rating = salonReviews.length > 0 ? Number(
      (salonReviews.reduce((sum, r) => sum + r.rating, 0) / salonReviews.length).toFixed(1)
    ) : 0;
  });
  if (search && typeof search === "string") {
    const q = search.toLowerCase().trim();
    salonsList = salonsList.filter((s) => {
      const matchSalon = s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const services = Array.from(db.services.values()).filter((srv) => srv.salonId === s.id && srv.isActive);
      const matchService = services.some((srv) => srv.name.toLowerCase().includes(q) || srv.nameTa && srv.nameTa.toLowerCase().includes(q));
      return matchSalon || matchService;
    });
  }
  if (category && category !== "all" && typeof category === "string") {
    const catSearch = category.toLowerCase();
    salonsList = salonsList.filter(
      (s) => s.businessCategory && s.businessCategory.toLowerCase() === catSearch || s.category && s.category.toLowerCase().includes(catSearch)
    );
  }
  if (maxWait && typeof maxWait === "string") {
    const wait = parseInt(maxWait, 10);
    if (!isNaN(wait)) {
      salonsList = salonsList.filter((s) => s.estimatedWaitMinutes <= wait);
    }
  }
  return res.json({
    success: true,
    salons: salonsList.map((s) => enrichPublicSalon(s)),
    count: salonsList.length
  });
});
apiRouter.get("/salons/:id", (req, res) => {
  const { id } = req.params;
  const auth = optionalAuth(req);
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  const includePrivate = canManageSalon(auth, id);
  if (!includePrivate && !salon.isPublished) {
    return res.status(404).json({ error: "Salon not found" });
  }
  db.recalculateQueue(id);
  const services = Array.from(db.services.values()).filter((s) => s.salonId === id && s.isActive);
  const staffList = Array.from(db.staff.values()).filter((s) => s.salonId === id && s.isActive);
  const reviews = Array.from(db.reviews.values()).filter((r) => r.salonId === id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  salon.reviewCount = reviews.length;
  salon.rating = reviews.length > 0 ? Number(
    (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
  ) : 0;
  const waitingEntries = Array.from(db.queueEntries.values()).filter((q) => q.salonId === id && (q.status === "waiting" || q.status === "calling")).sort((a, b) => a.position - b.position);
  return res.json({
    success: true,
    salon: includePrivate ? salon : enrichPublicSalon(salon),
    services,
    staff: staffList.map((s) => sanitizeStaff(s, includePrivate)),
    reviews: reviews.map((r) => sanitizeReview(r, includePrivate)),
    queue: {
      length: waitingEntries.length,
      estimatedWaitMinutes: salon.estimatedWaitMinutes,
      entries: includePrivate ? waitingEntries : []
    }
  });
});
apiRouter.get("/owner/salons", requireAuth, requireOwner, (req, res) => {
  const ownerSalons = Array.from(db.salons.values()).filter((s) => s.ownerId === req.auth.userId);
  ownerSalons.forEach((s) => db.recalculateQueue(s.id));
  return res.json({ success: true, salons: ownerSalons, count: ownerSalons.length });
});
apiRouter.get("/admin/overview", requireAuth, requireAdmin, (_req, res) => {
  const turfSalons = Array.from(db.salons.values()).filter(
    (salon) => isTurfBusiness(salon.category, salon.businessCategory, salon.bookingMode)
  );
  const turfIds = new Set(turfSalons.map((salon) => salon.id));
  const turfBookings = Array.from(db.bookings.values()).filter((booking) => turfIds.has(booking.salonId));
  const activeBookings = turfBookings.filter((booking) => !["cancelled", "completed", "no_show"].includes(booking.status));
  const ownerById = new Map(Array.from(db.users.values()).map((user) => [user.id, user]));
  const businesses = turfSalons.map((salon) => {
    const bookings = turfBookings.filter((booking) => booking.salonId === salon.id);
    const resources = (salon.resources || []).map((resource) => {
      const resourceBookings = bookings.filter((booking) => booking.resourceId === resource.id);
      const activeResourceBookings = resourceBookings.filter((booking) => !["cancelled", "completed", "no_show"].includes(booking.status));
      return {
        id: resource.id,
        name: resource.name,
        pricePerHour: resource.pricePerHour || null,
        bookingCount: resourceBookings.length,
        activeBookingCount: activeResourceBookings.length,
        latestBooking: activeResourceBookings.sort((a, b) => (/* @__PURE__ */ new Date(`${b.scheduledDate || ""}T${b.scheduledTime || "00:00"}`)).getTime() - (/* @__PURE__ */ new Date(`${a.scheduledDate || ""}T${a.scheduledTime || "00:00"}`)).getTime())[0] || null
      };
    });
    const owner = ownerById.get(salon.ownerId);
    return {
      id: salon.id,
      name: salon.name,
      status: salon.status,
      address: salon.address,
      city: salon.city,
      phone: salon.phone,
      lat: salon.lat,
      lng: salon.lng,
      ownerName: owner?.name || "Unknown owner",
      ownerEmail: owner?.email || "No email",
      resources,
      bookingCount: bookings.length,
      activeBookingCount: bookings.filter((booking) => !["cancelled", "completed", "no_show"].includes(booking.status)).length
    };
  });
  const payments = turfBookings.map((booking) => {
    const salon = db.salons.get(booking.salonId);
    const resource = salon?.resources?.find((item) => item.id === booking.resourceId);
    return {
      id: booking.id,
      turfName: salon?.name || booking.salonName,
      resourceName: resource?.name || booking.resourceName || "Turf slot",
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      slotEndTime: booking.slotEndTime,
      durationMinutes: booking.serviceDuration,
      amount: booking.amount,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      refundAmount: booking.refundAmount || 0,
      createdAt: booking.createdAt
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({
    success: true,
    admin: { email: ADMIN_EMAIL },
    stats: {
      turfCount: turfSalons.length,
      activeBookingCount: activeBookings.length,
      bookingCount: turfBookings.length,
      grossAmount: turfBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0)
    },
    businesses,
    payments
  });
});
apiRouter.get("/geocode/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string" || q.trim().length < 2) {
    return res.json({ success: true, results: [] });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
      q.trim()
    )}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "QGo-App/1.0 (https://qgo.app; contact@qgo.app)",
        "Accept-Language": "en"
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Geocoding service unavailable", results: [] });
    }
    const data = await response.json();
    const results = Array.isArray(data) ? data.map((item) => ({
      placeId: item.place_id,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      city: item.address?.city || item.address?.town || item.address?.village || item.address?.suburb || item.address?.state_district || "",
      state: item.address?.state || "",
      country: item.address?.country || ""
    })) : [];
    return res.json({ success: true, results });
  } catch (err) {
    console.error("Geocode search error:", err);
    return res.status(500).json({ error: "Failed to fetch location suggestions", results: [] });
  }
});
apiRouter.get("/geocode/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon query params required" });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(
      lat.toString()
    )}&lon=${encodeURIComponent(lon.toString())}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "QGo-App/1.0 (https://qgo.app; contact@qgo.app)",
        "Accept-Language": "en"
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: "Reverse geocoding unavailable" });
    }
    const data = await response.json();
    const formattedAddress = data.display_name || "";
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || data.address?.state_district || "";
    return res.json({
      success: true,
      address: formattedAddress,
      city,
      lat: parseFloat(data.lat || lat),
      lon: parseFloat(data.lon || lon),
      details: data.address
    });
  } catch (err) {
    console.error("Reverse geocode error:", err);
    return res.status(500).json({ error: "Failed to reverse geocode location" });
  }
});
apiRouter.post("/salons", requireAuth, async (req, res) => {
  const { name, businessType, businessCategory, category, description, logoUrl, coverUrl, address, city, phone, lat, lng } = req.body;
  const ownerId = req.auth.userId;
  if (!name || !address) {
    return res.status(400).json({ error: "Name and address are required" });
  }
  const validIDs = MASTER_CATEGORIES.map((c) => c.id);
  if (businessCategory && !validIDs.includes(businessCategory)) {
    return res.status(400).json({ error: "Invalid business category ID" });
  }
  const id = `salon_${Date.now()}`;
  const joinCode = `SLN${Math.floor(1e4 + Math.random() * 9e4)}`;
  const pin = Math.floor(1e5 + Math.random() * 9e5).toString();
  const newSalon = {
    id,
    ownerId,
    name,
    businessType,
    businessCategory,
    category: category || "Other",
    description: description || "",
    logoUrl: logoUrl || "",
    coverUrl: coverUrl || "",
    address,
    city: city || "",
    lat: typeof lat === "number" ? lat : lat ? parseFloat(lat) : 0,
    lng: typeof lng === "number" ? lng : lng ? parseFloat(lng) : 0,
    phone: phone || "",
    email: req.body.email || "",
    website: req.body.website || "",
    instagram: req.body.instagram || "",
    verified: req.body.verified ?? false,
    isPublished: req.body.isPublished ?? false,
    status: req.body.status || "draft",
    setupStep: req.body.setupStep || 1,
    enableQueue: req.body.enableQueue ?? false,
    bookingMode: req.body.bookingMode || (isTurfBusiness(category) ? "resource_slot" : "appointment"),
    resources: req.body.resources || void 0,
    turfSchedule: req.body.turfSchedule || void 0,
    startingPrice: typeof req.body.startingPrice === "number" ? req.body.startingPrice : void 0,
    bookingSettings: req.body.bookingSettings || {
      advanceBookingDays: 7,
      minNoticeMinutes: 60,
      cancellationAllowed: true,
      cancellationDeadlineHours: 2,
      customerChoosesStaff: false
    },
    joinCode,
    pin,
    rating: 0,
    reviewCount: 0,
    queueLength: 0,
    estimatedWaitMinutes: 0,
    workingHours: req.body.workingHours || [
      { dayOfWeek: 0, dayName: "Sunday", openTime: "09:00", closeTime: "21:00", isOpen: false },
      { dayOfWeek: 1, dayName: "Monday", openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 2, dayName: "Tuesday", openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 3, dayName: "Wednesday", openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 4, dayName: "Thursday", openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 5, dayName: "Friday", openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 6, dayName: "Saturday", openTime: "09:00", closeTime: "21:00", isOpen: true }
    ],
    holidays: req.body.holidays || [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.salons.set(id, newSalon);
  await saveSalonSnapshot(newSalon);
  const user = db.users.get(ownerId);
  if (user) {
    user.salonId = id;
    user.role = "owner";
  }
  const ownerRoleExists = Array.from(db.userRoles.values()).find(
    (r) => r.userId === ownerId && r.role === "owner"
  );
  if (!ownerRoleExists) {
    const roleId = `rm_${import_crypto.default.randomUUID()}`;
    db.userRoles.set(roleId, { id: roleId, userId: ownerId, role: "owner", status: "active", businessId: id });
  }
  return res.status(201).json({ success: true, salon: newSalon });
});
apiRouter.patch("/salons/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  if (salon.ownerId !== req.auth.userId) {
    return forbidden(res);
  }
  const {
    ownerId: _ownerId,
    id: _id,
    pin: _pin,
    verified: _verified,
    rating: _rating,
    reviewCount: _reviewCount,
    queueLength: _queueLength,
    estimatedWaitMinutes: _estimatedWaitMinutes,
    ...safeUpdates
  } = req.body;
  if (safeUpdates.status === "live" || safeUpdates.status === "approved") {
    salon.isPublished = true;
    salon.verified = true;
  }
  if (safeUpdates.status === "draft" || safeUpdates.status === "rejected" || safeUpdates.status === "suspended") {
    salon.isPublished = false;
  }
  Object.assign(salon, safeUpdates);
  const setupStep = Number(safeUpdates.setupStep);
  const totalSteps = isTurfBusiness(salon.category, salon.businessCategory) ? 7 : 8;
  if (setupStep >= totalSteps) {
    salon.status = "approved";
    salon.isPublished = true;
    salon.verified = true;
  }
  await saveSalonSnapshot(salon);
  return res.json({ success: true, salon });
});
apiRouter.post("/salons/:id/upload-image", requireAuth, requireRole("owner"), async (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const { imageData, type } = req.body;
  if (!imageData || !imageData.startsWith("data:image")) {
    return res.status(400).json({ error: "Invalid image data. Must be a base64 data URL." });
  }
  if (imageData.length > 7e6) {
    return res.status(400).json({ error: "Image too large. Please use an image under 5MB." });
  }
  if (type === "logo") {
    salon.logoUrl = imageData;
  } else if (type === "cover") {
    salon.coverUrl = imageData;
  } else if (type === "photo") {
    if (!salon.photos) salon.photos = [];
    salon.photos = [...salon.photos, imageData];
  } else {
    return res.status(400).json({ error: "Invalid type. Use logo, cover, or photo." });
  }
  await saveSalonSnapshot(salon);
  return res.json({ success: true, url: imageData, salon });
});
apiRouter.delete("/salons/:id/photos/:index", requireAuth, requireRole("owner"), async (req, res) => {
  const { id, index } = req.params;
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: "Salon not found" });
  if (!canManageSalon(req.auth, id)) return forbidden(res);
  const idx = parseInt(index, 10);
  if (!salon.photos || idx < 0 || idx >= salon.photos.length) {
    return res.status(400).json({ error: "Invalid photo index" });
  }
  salon.photos = salon.photos.filter((_, i) => i !== idx);
  await saveSalonSnapshot(salon);
  return res.json({ success: true, salon });
});
apiRouter.post("/salons/:id/complete-setup", requireAuth, requireRole("owner"), async (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) return res.status(404).json({ error: "Salon not found" });
  if (!canManageSalon(req.auth, id)) return forbidden(res);
  const {
    turfSchedule,
    workingHours,
    bookingSettings,
    resources,
    services: incomingServices,
    facilities,
    startingPrice,
    status,
    setupStep,
    isPublished
  } = req.body;
  if (Array.isArray(workingHours)) salon.workingHours = workingHours;
  if (Array.isArray(turfSchedule)) salon.turfSchedule = turfSchedule;
  if (bookingSettings && typeof bookingSettings === "object") {
    salon.bookingSettings = { ...salon.bookingSettings, ...bookingSettings };
  }
  if (Array.isArray(resources)) {
    salon.resources = resources.map((r) => ({ ...r, salonId: salon.id }));
  }
  if (Array.isArray(facilities)) salon.facilities = facilities;
  if (typeof startingPrice === "number") salon.startingPrice = startingPrice;
  if (Array.isArray(incomingServices)) {
    Array.from(db.services.values()).filter((s) => s.salonId === id).forEach((s) => {
      s.isActive = false;
    });
    incomingServices.forEach((svc, idx) => {
      const srvId = `srv_${id}_${idx}_${Date.now()}`;
      db.services.set(srvId, {
        id: srvId,
        salonId: id,
        name: svc.name || "Turf Slot",
        price: Number(svc.price) || 0,
        durationMinutes: Number(svc.durationMinutes) || 60,
        category: svc.category || "Turf",
        description: svc.description,
        isActive: true
      });
    });
  }
  const finalStep = setupStep || 7;
  salon.setupStep = finalStep;
  if (finalStep >= 7) {
    salon.status = status || "approved";
    salon.isPublished = isPublished !== false;
    salon.verified = true;
  }
  const user = db.users.get(req.auth.userId);
  if (user) {
    user.salonId = id;
    if (!user.authorizedRoles?.includes("owner")) {
      ensureOwnerRole(user.id, id);
      user.authorizedRoles = getAuthorizedRoles(user);
    }
  }
  console.log(`[SETUP] Business "${salon.name}" (${id}) activated by owner ${req.auth.userId}`);
  await saveSalonSnapshot(salon);
  return res.json({ success: true, salon });
});
apiRouter.post("/salons/:id/services", requireAuth, requireRole("owner"), (req, res) => {
  const { id: salonId } = req.params;
  const { name, nameTa, price, durationMinutes, category, description } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  if (!name || !price || !durationMinutes) {
    return res.status(400).json({ error: "Name, price, and duration are required" });
  }
  const srvId = `srv_${Date.now()}`;
  const service = {
    id: srvId,
    salonId,
    name,
    nameTa,
    price: Number(price),
    durationMinutes: Number(durationMinutes),
    category: category || "Hair",
    description,
    isActive: true
  };
  db.services.set(srvId, service);
  return res.status(201).json({ success: true, service });
});
apiRouter.patch("/services/:id", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  const service = db.services.get(id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (!canManageSalon(req.auth, service.salonId)) {
    return forbidden(res);
  }
  const { id: _id, salonId, ...safeUpdates } = req.body;
  Object.assign(service, safeUpdates);
  return res.json({ success: true, service });
});
apiRouter.delete("/services/:id", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  const service = db.services.get(id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  if (!canManageSalon(req.auth, service.salonId)) {
    return forbidden(res);
  }
  service.isActive = false;
  return res.json({ success: true, message: "Service deactivated" });
});
apiRouter.post("/salons/:id/staff", requireAuth, requireRole("owner"), (req, res) => {
  const { id: salonId } = req.params;
  const { name, title, photoUrl, serviceIds, phone } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  if (!name) {
    return res.status(400).json({ error: "Staff name is required" });
  }
  const validServiceIds = Array.isArray(serviceIds) ? serviceIds.filter((serviceId) => {
    const service = db.services.get(serviceId);
    return service && service.salonId === salonId;
  }) : [];
  const linkedUser = typeof phone === "string" ? Array.from(db.users.values()).find((u) => u.phone === phone) : void 0;
  const stId = `staff_${Date.now()}`;
  const staffMember = {
    id: stId,
    salonId,
    userId: linkedUser?.id,
    name,
    phone: typeof phone === "string" ? phone : void 0,
    title: title || "Stylist",
    photoUrl: photoUrl || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    reviewCount: 0,
    serviceIds: validServiceIds,
    status: "available",
    isActive: true
  };
  db.staff.set(stId, staffMember);
  return res.status(201).json({ success: true, staff: staffMember });
});
apiRouter.patch("/staff/:id/status", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidStaffStatus(status)) {
    return res.status(400).json({ error: "Invalid staff status" });
  }
  const staffMember = db.staff.get(id);
  if (!staffMember) {
    return res.status(404).json({ error: "Staff member not found" });
  }
  if (!canManageSalon(req.auth, staffMember.salonId)) {
    return forbidden(res);
  }
  staffMember.status = status;
  db.recalculateQueueStats(staffMember.salonId);
  return res.json({ success: true, staff: staffMember });
});
function calculateTurfSlotsForDate(salon, queryDate, targetResourceId, requestedDurationMinutes) {
  const resources = salon.resources && salon.resources.length > 0 ? salon.resources.filter((r) => r.isActive) : [{ id: "turf_1", salonId: salon.id, name: "Turf 1", type: "Multi-purpose", isActive: true }];
  const activeResourceId = targetResourceId && targetResourceId !== "all" ? targetResourceId : resources[0]?.id;
  const currentResource = resources.find((r) => r.id === activeResourceId) || resources[0];
  const schedules = salon.turfSchedule || [];
  const resourceSchedule = schedules.find((s) => s.resourceId === activeResourceId) || schedules.find((s) => s.resourceId === "default" || !s.resourceId) || schedules[0];
  const dateObj = /* @__PURE__ */ new Date(queryDate + "T00:00:00Z");
  const dayOfWeek = dateObj.getUTCDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[dayOfWeek];
  const specialDate = resourceSchedule?.specialDates?.find((sd) => sd.date === queryDate) || salon.holidays?.find((h) => {
    const endDate = h.endDate || h.date;
    return queryDate >= h.date && queryDate <= endDate;
  });
  if (specialDate && ("isClosed" in specialDate ? specialDate.isClosed : true)) {
    return {
      isOpen: false,
      message: ("reason" in specialDate ? specialDate.reason : void 0) || "Closed on this special date",
      dayName,
      slots: [],
      resources
    };
  }
  const dayConfig = resourceSchedule?.days?.find((d) => d.dayOfWeek === dayOfWeek);
  const fallbackHours = salon.workingHours?.find((h) => h.dayOfWeek === dayOfWeek);
  const isOpen = dayConfig ? dayConfig.isOpen : fallbackHours ? fallbackHours.isOpen : true;
  if (!isOpen) {
    return {
      isOpen: false,
      message: "Closed on this day",
      dayName,
      slots: [],
      resources
    };
  }
  const openTime = specialDate && "openTime" in specialDate && specialDate.openTime ? specialDate.openTime : dayConfig?.openTime || fallbackHours?.openTime || "06:00";
  const closeTime = specialDate && "closeTime" in specialDate && specialDate.closeTime ? specialDate.closeTime : dayConfig?.closeTime || fallbackHours?.closeTime || "23:00";
  const baseDurationMinutes = specialDate && "slotDurationMinutes" in specialDate && specialDate.slotDurationMinutes ? specialDate.slotDurationMinutes : dayConfig?.slotDurationMinutes || 60;
  const durationMinutes = requestedDurationMinutes && requestedDurationMinutes >= baseDurationMinutes ? Math.min(requestedDurationMinutes, 360) : baseDurationMinutes;
  const defaultPrice = specialDate && "price" in specialDate && specialDate.price ? specialDate.price : dayConfig?.defaultPrice || currentResource?.pricePerHour || salon.startingPrice || 600;
  const bufferMinutes = dayConfig?.bufferMinutes || salon.bookingSettings?.bufferMinutes || 0;
  const breaks = specialDate && "breaks" in specialDate && specialDate.breaks || dayConfig?.breaks || [];
  const peakPricing = dayConfig?.peakPricing || [];
  const timePricingPeriods = dayConfig?.timePricingPeriods || [];
  const customSlots = dayConfig?.customSlots || [];
  const slotOverrides = dayConfig?.slotOverrides || [];
  const disabledSlots = dayConfig?.disabledSlots || [];
  const openMinutes = timeToMinutes(openTime);
  const closeMinutes = timeToMinutes(closeTime);
  const effectiveCloseMinutes = closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes;
  const existingBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === salon.id && b.scheduledDate === queryDate && (b.resourceId === activeResourceId || !b.resourceId && resources.length === 1) && b.status !== "cancelled" && b.status !== "no_show"
  );
  const now = /* @__PURE__ */ new Date();
  const isToday = queryDate === now.toISOString().split("T")[0];
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
  const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;
  const generatedSlots = [];
  const slotStepMinutes = baseDurationMinutes + bufferMinutes;
  for (let startOffset = openMinutes; startOffset < effectiveCloseMinutes; startOffset += slotStepMinutes) {
    let endOffset = startOffset + durationMinutes;
    if (endOffset > effectiveCloseMinutes) {
      break;
    }
    const actualDuration = endOffset - startOffset;
    const startM = startOffset % 1440;
    const endM = endOffset % 1440;
    const startTimeStr = minutesToTime(startM);
    const endTimeStr = minutesToTime(endM);
    const inBreak = breaks.some((brk) => {
      let bStart = timeToMinutes(brk.startTime);
      let bEnd = timeToMinutes(brk.endTime);
      if (bEnd <= bStart) bEnd += 1440;
      if (bStart < openMinutes) {
        bStart += 1440;
        bEnd += 1440;
      }
      return startOffset < bEnd && endOffset > bStart;
    });
    if (inBreak) continue;
    const isExplicitlyDisabled = disabledSlots.includes(startTimeStr) || slotOverrides.some((so) => (so.startTime === startTimeStr || so.slotKey === startTimeStr) && so.isDisabled);
    if (isExplicitlyDisabled) continue;
    let slotPrice = defaultPrice;
    let isPeak = false;
    let validPriceBoundary = true;
    let matchedPeriodName = "Standard";
    const activePeriods = timePricingPeriods.filter((p) => p.isActive !== false);
    if (activePeriods.length > 0) {
      const matchingPeriod = activePeriods.find((tp) => {
        let pStart = timeToMinutes(tp.startTime);
        let pEnd = timeToMinutes(tp.endTime);
        if (pEnd <= pStart) pEnd += 1440;
        if (pStart < openMinutes) {
          pStart += 1440;
          pEnd += 1440;
        }
        return startOffset >= pStart && endOffset <= pEnd;
      });
      if (matchingPeriod) {
        slotPrice = Math.round(matchingPeriod.price * (durationMinutes / 60));
        matchedPeriodName = matchingPeriod.name;
      } else {
        validPriceBoundary = false;
      }
    } else {
      const hourlyPrice = startM >= 18 * 60 || startM < 6 * 60 ? 800 : 600;
      slotPrice = Math.round(hourlyPrice * (durationMinutes / 60));
    }
    if (!validPriceBoundary) continue;
    const override = slotOverrides.find((so) => so.startTime === startTimeStr || so.slotKey === startTimeStr);
    if (override && override.price !== void 0) {
      slotPrice = override.price;
    }
    const isPast = isToday && startM <= currentMinutesToday + minNoticeMinutes || queryDate < now.toISOString().split("T")[0];
    const matchingBooking = existingBookings.find((b) => {
      const bStart = timeToMinutes(b.scheduledTime || "00:00");
      const bEnd = bookingEndMinute(b, actualDuration);
      const slotStart = startOffset;
      const slotEnd = endOffset;
      const normalizedBookingStart = bStart < openMinutes ? bStart + 1440 : bStart;
      const normalizedBookingEnd = bEnd <= normalizedBookingStart ? bEnd + 1440 : bEnd;
      return slotStart < normalizedBookingEnd && slotEnd > normalizedBookingStart;
    });
    const isBooked = Boolean(matchingBooking) || db.isSlotLocked(salon.id, activeResourceId, queryDate, startTimeStr);
    const isBlocked = override?.isDisabled || false;
    let status = "available";
    if (isPast) status = "past";
    else if (isBlocked) status = "blocked";
    else if (isBooked) status = "booked";
    generatedSlots.push({
      id: `${activeResourceId}_${startTimeStr}_${endTimeStr}`,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: actualDuration,
      price: slotPrice,
      isPeak,
      periodType: classifySlotPeriod(startTimeStr, matchedPeriodName, activePeriods),
      available: status === "available",
      isBooked,
      isBlocked,
      status,
      bookingId: matchingBooking?.id,
      customerName: matchingBooking?.customerName,
      customerPhone: matchingBooking?.customerPhone,
      paymentStatus: matchingBooking?.paymentStatus,
      bookingStatus: matchingBooking?.status,
      bookingCreatedAt: matchingBooking?.createdAt,
      resourceId: activeResourceId,
      resourceName: currentResource.name,
      label: matchedPeriodName
    });
  }
  generatedSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  return {
    isOpen: true,
    dayName,
    slots: generatedSlots,
    resources
  };
}
apiRouter.get("/salons/:id/availability", (req, res) => {
  const { id: salonId } = req.params;
  const { service_id, staff_id, resource_id, date, duration_minutes } = req.query;
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: "Salon/Turf not found" });
  }
  const queryDate = date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (isTurfBusiness(salon.category, salon.businessCategory, salon.bookingMode) || salon.turfSchedule?.length || salon.resources?.length) {
    const requestedDuration = Number(duration_minutes);
    const turfResult = calculateTurfSlotsForDate(
      salon,
      queryDate,
      resource_id,
      Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : void 0
    );
    return res.json({
      success: true,
      date: queryDate,
      dayName: turfResult.dayName,
      isOpen: turfResult.isOpen,
      message: turfResult.message,
      slots: turfResult.slots,
      resources: turfResult.resources,
      isTurf: true
    });
  }
  const service = service_id ? db.services.get(service_id) : void 0;
  if (!service || service.salonId !== salonId || !service.isActive) {
    return res.status(400).json({ error: "Valid service_id is required for salon availability" });
  }
  const selectedStaffId = staff_id && staff_id !== "any" ? staff_id : void 0;
  const duration = service.durationMinutes;
  const interval = salon.bookingSettings?.bookingIntervalMinutes || 15;
  const d = /* @__PURE__ */ new Date(queryDate + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const dayHours = salon.workingHours?.find((h) => h.dayOfWeek === dayOfWeek);
  const holiday = salon.holidays?.find((item) => {
    const endDate = item.endDate || item.date;
    return queryDate >= item.date && queryDate <= endDate;
  });
  if (holiday) {
    return res.json({ success: true, isOpen: false, message: holiday.reason || "Closed on this date", slots: [] });
  }
  if (!dayHours || !dayHours.isOpen) {
    return res.json({ success: true, isOpen: false, message: "Closed today", slots: [] });
  }
  const [openH, openM] = dayHours.openTime.split(":").map(Number);
  const [closeH, closeM] = dayHours.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const eligibleStaff = Array.from(db.staff.values()).filter(
    (st) => st.salonId === salonId && st.isActive && st.status !== "off" && (!selectedStaffId || st.id === selectedStaffId) && (st.serviceIds.length === 0 || st.serviceIds.includes(service.id))
  );
  const bookedSlots = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === salonId && b.scheduledDate === queryDate && b.status !== "cancelled" && b.status !== "no_show"
  );
  const now = /* @__PURE__ */ new Date();
  const isToday = queryDate === now.toISOString().split("T")[0];
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
  const slots = [];
  for (let m = openMinutes; m + duration <= closeMinutes; m += interval) {
    if (isToday && m <= currentMinutesToday + 15) continue;
    const timeStr = minutesToTime(m);
    const endMinutes = m + duration;
    const availableStaffForSlot = eligibleStaff.filter((st) => {
      const hasConflict = bookedSlots.some((b) => {
        if (b.staffId !== st.id && b.staffId) return false;
        if (!b.staffId && eligibleStaff.length > 1) return false;
        const bStart = timeToMinutes(b.scheduledTime || "00:00");
        const bEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bStart + (b.serviceDuration || 30);
        return m < bEnd && endMinutes > bStart;
      });
      return !hasConflict;
    });
    const hasBookingConflict = bookedSlots.some((b) => {
      if (b.staffId && selectedStaffId && b.staffId !== selectedStaffId) return false;
      const bookedStart = timeToMinutes(b.scheduledTime || "00:00");
      const bookedEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : bookedStart + (b.serviceDuration || 30);
      return m < bookedEnd && endMinutes > bookedStart;
    });
    const isBooked = eligibleStaff.length > 0 && availableStaffForSlot.length === 0 && hasBookingConflict;
    slots.push({
      time: timeStr,
      endTime: minutesToTime(endMinutes),
      available: availableStaffForSlot.length > 0,
      status: isBooked ? "booked" : availableStaffForSlot.length > 0 ? "available" : "unavailable",
      availableStaffCount: availableStaffForSlot.length,
      availableStaffIds: availableStaffForSlot.map((s) => s.id),
      price: service.price
    });
  }
  return res.json({
    success: true,
    date: queryDate,
    dayName: dayHours.dayName,
    isOpen: true,
    slots
  });
});
apiRouter.post("/bookings", requireAuth, requireRole("consumer"), (req, res) => {
  const {
    salonId,
    customerName,
    customerPhone,
    serviceId,
    staffId,
    resourceId,
    mode = "appointment",
    // 'appointment' | 'token'
    scheduledDate,
    scheduledTime,
    slotEndTime,
    price,
    numberOfPlayers,
    notes
  } = req.body;
  if (!salonId || !customerName || !customerPhone) {
    return res.status(400).json({ error: "Missing required booking information" });
  }
  const customerId = req.auth.userId;
  const salon = db.salons.get(salonId);
  if (!salon || !salon.isPublished) {
    return res.status(404).json({ error: "Business not found" });
  }
  const isTurf = isTurfBusiness(salon.category, salon.businessCategory, salon.bookingMode) || Boolean(resourceId) || Boolean(salon.resources?.length);
  if (isTurf) {
    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: "Date and time are required for turf slot bookings" });
    }
    const resources = salon.resources || [{ id: "turf_1", salonId: salon.id, name: "Turf 1", type: "Multi-purpose", isActive: true }];
    const selectedResource = resourceId ? resources.find((r) => r.id === resourceId) : resources[0];
    const targetResourceId = selectedResource ? selectedResource.id : "turf_1";
    const targetResourceName = selectedResource ? selectedResource.name : "Turf 1";
    const advanceBookingDays = salon.bookingSettings?.advanceBookingDays || 30;
    const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;
    const now = /* @__PURE__ */ new Date();
    const isToday = scheduledDate === now.toISOString().split("T")[0];
    const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
    if (isToday && timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
      return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this slot.` });
    }
    const bookingDateObj = /* @__PURE__ */ new Date(`${scheduledDate}T00:00:00Z`);
    const todayDateObj = /* @__PURE__ */ new Date(`${now.toISOString().split("T")[0]}T00:00:00Z`);
    const diffDays = Math.ceil((bookingDateObj.getTime() - todayDateObj.getTime()) / (1e3 * 60 * 60 * 24));
    if (diffDays > advanceBookingDays) {
      return res.status(400).json({ error: `This slot is beyond the allowed advance booking window of ${advanceBookingDays} days.` });
    }
    const bookingId2 = `bk_turf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      targetResourceId,
      scheduledDate,
      scheduledTime,
      bookingId2
    );
    if (!lockAcquired) {
      return res.status(409).json({
        error: "This turf slot was just booked by another customer. Please choose another time or turf.",
        slotTaken: true
      });
    }
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.salonId !== salonId || b.scheduledDate !== scheduledDate) return false;
      if (b.status === "cancelled" || b.status === "no_show") return false;
      if (b.resourceId && b.resourceId !== targetResourceId) return false;
      const reqStart = timeToMinutes(scheduledTime);
      const reqEnd = reqStart + elapsedSlotMinutes(scheduledTime, slotEndTime, 60);
      const bStart = timeToMinutes(b.scheduledTime || "00:00");
      const bEnd = bookingEndMinute(b, 60);
      return reqStart < bEnd && reqEnd > bStart;
    });
    if (existingConflict) {
      db.releaseSlotLock(salonId, targetResourceId, scheduledDate, scheduledTime);
      return res.status(409).json({
        error: `This time slot for ${targetResourceName} is already booked. Please choose another slot.`,
        slotTaken: true
      });
    }
    const startM = timeToMinutes(scheduledTime);
    const durationMinutes = Math.max(15, elapsedSlotMinutes(scheduledTime, slotEndTime, 60));
    const finalPrice = getTurfSlotPrice(salon, selectedResource, scheduledDate, scheduledTime, durationMinutes);
    const tokenNumber2 = db.getNextTokenNumber(salon);
    const qrCodeId2 = `QR-${bookingId2}-${import_crypto.default.randomBytes(6).toString("hex")}`.toUpperCase();
    const qrSignature2 = makeQrSignature(bookingId2, salonId, qrCodeId2);
    const newBooking2 = {
      id: bookingId2,
      salonId,
      salonName: salon.name,
      resourceId: targetResourceId,
      resourceName: targetResourceName,
      customerId,
      customerName,
      customerPhone,
      serviceId: serviceId || "srv_turf_slot",
      serviceName: `${targetResourceName} Slot`,
      serviceDuration: durationMinutes,
      servicePrice: finalPrice,
      numberOfPlayers: Math.max(1, Math.min(50, Number(numberOfPlayers) || 10)),
      mode: "appointment",
      scheduledDate,
      scheduledTime,
      slotEndTime: slotEndTime || minutesToTime(startM + durationMinutes),
      status: "confirmed",
      qrCodeId: qrCodeId2,
      qrSignature: qrSignature2,
      tokenNumber: tokenNumber2,
      notes,
      paymentStatus: "pay_at_shop",
      amount: finalPrice,
      refundPercentage: salon.bookingSettings?.refundPercentage ?? 70,
      cancellationDeadlineHours: salon.bookingSettings?.cancellationDeadlineHours ?? 2,
      reminderMinutesBefore: salon.bookingSettings?.reminderMinutesBefore ?? 30,
      refundStatus: "none",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.bookings.set(bookingId2, newBooking2);
    return res.status(201).json({
      success: true,
      booking: newBooking2,
      qrPayload: {
        bookingId: bookingId2,
        salonId,
        tokenNumber: tokenNumber2,
        qrCodeId: qrCodeId2,
        qrSignature: qrSignature2,
        scheduledDate,
        scheduledTime,
        resourceName: targetResourceName
      }
    });
  }
  if (!serviceId) {
    return res.status(400).json({ error: "Service is required for appointment booking" });
  }
  const service = db.services.get(serviceId);
  if (!service || service.salonId !== salonId || !service.isActive) {
    return res.status(404).json({ error: "Service not found" });
  }
  let assignedStaff;
  if (staffId && staffId !== "any") {
    assignedStaff = db.staff.get(staffId);
    if (!assignedStaff || assignedStaff.salonId !== salonId || !assignedStaff.isActive || assignedStaff.status === "off") {
      return res.status(400).json({ error: "Staff member does not belong to this salon" });
    }
    if (assignedStaff.serviceIds.length > 0 && !assignedStaff.serviceIds.includes(serviceId)) {
      return res.status(400).json({ error: "Staff member is not assigned to this service" });
    }
  } else {
    const availableStaff = Array.from(db.staff.values()).filter(
      (st) => st.salonId === salonId && st.isActive && st.status !== "off" && (st.serviceIds.length === 0 || st.serviceIds.includes(serviceId))
    );
    if (availableStaff.length === 0) {
      return res.status(400).json({ error: "No staff available at this salon" });
    }
    assignedStaff = availableStaff[0];
  }
  const bookingId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  if (mode === "appointment") {
    if (!scheduledDate || !scheduledTime) {
      return res.status(400).json({ error: "Date and time are required for appointment booking" });
    }
    const advanceBookingDays = salon.bookingSettings?.advanceBookingDays || 30;
    const minNoticeMinutes = salon.bookingSettings?.minNoticeMinutes || 0;
    const now = /* @__PURE__ */ new Date();
    const todayStr = now.toISOString().split("T")[0];
    const bookingDateObj = /* @__PURE__ */ new Date(`${scheduledDate}T00:00:00Z`);
    const todayDateObj = /* @__PURE__ */ new Date(`${todayStr}T00:00:00Z`);
    const diffDays = Math.ceil((bookingDateObj.getTime() - todayDateObj.getTime()) / (1e3 * 60 * 60 * 24));
    if (!Number.isFinite(bookingDateObj.getTime()) || diffDays < 0) {
      return res.status(400).json({ error: "Cannot book an appointment in the past" });
    }
    if (diffDays > advanceBookingDays) {
      return res.status(400).json({ error: `This appointment is beyond the allowed advance booking window of ${advanceBookingDays} days.` });
    }
    if (scheduledDate === todayStr) {
      const currentMinutesToday = now.getHours() * 60 + now.getMinutes();
      if (timeToMinutes(scheduledTime) < currentMinutesToday + minNoticeMinutes) {
        return res.status(400).json({ error: `Minimum notice requirement of ${minNoticeMinutes} minutes not met for this appointment.` });
      }
    }
    const holiday = salon.holidays?.find((item) => {
      const endDate = item.endDate || item.date;
      return scheduledDate >= item.date && scheduledDate <= endDate;
    });
    if (holiday) {
      return res.status(400).json({ error: holiday.reason || "This business is closed on the selected date." });
    }
    const lockAcquired = db.tryAcquireSlotLock(
      salonId,
      assignedStaff.id,
      scheduledDate,
      scheduledTime,
      bookingId
    );
    if (!lockAcquired) {
      return res.status(409).json({
        error: "This appointment slot was just booked by another customer. Please choose another time or stylist.",
        slotTaken: true
      });
    }
    const requestedStart = timeToMinutes(scheduledTime);
    const requestedEnd = requestedStart + service.durationMinutes;
    const existingConflict = Array.from(db.bookings.values()).find((b) => {
      if (b.status === "cancelled" || b.status === "no_show") return false;
      if (b.salonId !== salonId || b.scheduledDate !== scheduledDate) return false;
      if (b.staffId && b.staffId !== assignedStaff.id) return false;
      if (!b.staffId && assignedStaff) return false;
      const existingStart = timeToMinutes(b.scheduledTime || "00:00");
      const existingEnd = b.slotEndTime ? timeToMinutes(b.slotEndTime) : existingStart + (b.serviceDuration || 30);
      return requestedStart < existingEnd && requestedEnd > existingStart;
    });
    if (existingConflict) {
      db.releaseSlotLock(salonId, assignedStaff.id, scheduledDate, scheduledTime);
      return res.status(409).json({
        error: "This appointment slot is already booked. Please choose another time or stylist.",
        slotTaken: true
      });
    }
  }
  const tokenNumber = db.getNextTokenNumber(salon);
  const qrCodeId = `QR-${bookingId}-${import_crypto.default.randomBytes(6).toString("hex")}`.toUpperCase();
  const qrSignature = makeQrSignature(bookingId, salonId, qrCodeId);
  let queuePosition = 1;
  let estimatedWaitMinutes = 15;
  let peopleAhead = 0;
  if (mode === "token") {
    const currentQueue = Array.from(db.queueEntries.values()).filter(
      (q) => q.salonId === salonId && (q.status === "waiting" || q.status === "calling")
    );
    queuePosition = currentQueue.length + 1;
    peopleAhead = currentQueue.length;
    estimatedWaitMinutes = Math.max(5, currentQueue.length * 15 + 5);
  }
  const newBooking = {
    id: bookingId,
    salonId,
    salonName: salon.name,
    staffId: assignedStaff?.id,
    staffName: assignedStaff?.name || "Any Stylist",
    customerId,
    customerName,
    customerPhone,
    serviceId,
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    numberOfPlayers: Math.max(1, Math.min(50, Number(numberOfPlayers) || 1)),
    mode,
    scheduledDate: mode === "appointment" ? scheduledDate : void 0,
    scheduledTime: mode === "appointment" ? scheduledTime : void 0,
    slotEndTime: mode === "appointment" && scheduledTime ? minutesToTime(timeToMinutes(scheduledTime) + service.durationMinutes) : void 0,
    status: "confirmed",
    qrCodeId,
    qrSignature,
    tokenNumber,
    queuePosition,
    peopleAhead,
    estimatedWaitMinutes,
    refundPercentage: salon.bookingSettings?.refundPercentage ?? 70,
    cancellationDeadlineHours: salon.bookingSettings?.cancellationDeadlineHours ?? 2,
    reminderMinutesBefore: salon.bookingSettings?.reminderMinutesBefore ?? 30,
    refundStatus: "none",
    joinedQueueAt: (/* @__PURE__ */ new Date()).toISOString(),
    notes,
    paymentStatus: "pay_at_shop",
    amount: service.price,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.bookings.set(bookingId, newBooking);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (mode === "token" || scheduledDate === today) {
    const qeId = `qe_${bookingId}`;
    db.queueEntries.set(qeId, {
      id: qeId,
      bookingId,
      salonId,
      staffId: assignedStaff?.id,
      staffName: assignedStaff?.name,
      tokenNumber,
      position: queuePosition,
      status: "waiting",
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      customerName,
      customerPhone,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      isAppointment: mode === "appointment",
      scheduledTime
    });
    if (assignedStaff) {
      assignedStaff.waitingCount = (assignedStaff.waitingCount || 0) + 1;
    }
  }
  db.recalculateQueueStats(salonId);
  sendNotification(customerId, {
    userId: customerId,
    type: "booking_confirmed",
    title: mode === "appointment" ? "Appointment Confirmed!" : `Token #${tokenNumber.split("-").pop()} Issued`,
    message: mode === "appointment" ? `Your appointment at ${salon.name} for ${service.name} is confirmed for ${scheduledDate} at ${scheduledTime}.` : `You are in line at ${salon.name}. Est. wait: ~${estimatedWaitMinutes} mins.`,
    bookingId
  });
  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: "new_booking",
    title: `New ${mode === "appointment" ? "Appointment" : "Walk-in Token"}`,
    message: `${customerName} booked ${service.name} (${tokenNumber}).`,
    bookingId
  });
  return res.status(201).json({
    success: true,
    booking: newBooking,
    qrPayload: {
      bookingId,
      salonId,
      tokenNumber,
      qrCodeId,
      qrSignature
    }
  });
});
apiRouter.get("/bookings", requireAuth, (req, res) => {
  const { salonId, date, staffId } = req.query;
  let bookingsList = Array.from(db.bookings.values());
  if (salonId && typeof salonId === "string") {
    if (!canManageSalon(req.auth, salonId)) {
      return forbidden(res);
    }
    bookingsList = bookingsList.filter((b) => b.salonId === salonId);
  } else {
    bookingsList = bookingsList.filter((b) => b.customerId === req.auth.userId);
  }
  if (date && typeof date === "string") {
    bookingsList = bookingsList.filter((b) => b.scheduledDate === date || b.createdAt.startsWith(date));
  }
  if (staffId && typeof staffId === "string") {
    const staff = db.staff.get(staffId);
    if (!staff || !bookingsList.every((b) => b.salonId === staff.salonId)) {
      return forbidden(res);
    }
    bookingsList = bookingsList.filter((b) => b.staffId === staffId);
  }
  bookingsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ success: true, bookings: bookingsList });
});
apiRouter.get("/bookings/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (!canReadBooking(req.auth, booking)) {
    return forbidden(res);
  }
  db.recalculateQueueStats(booking.salonId);
  return res.json({
    success: true,
    booking,
    qrPayload: {
      bookingId: booking.id,
      salonId: booking.salonId,
      tokenNumber: booking.tokenNumber,
      qrCodeId: booking.qrCodeId,
      qrSignature: booking.qrSignature
    }
  });
});
apiRouter.patch("/bookings/:id/status", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidBookingStatus(status)) {
    return res.status(400).json({ error: "Invalid booking status" });
  }
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (!canManageSalon(req.auth, booking.salonId)) {
    return forbidden(res);
  }
  booking.status = status;
  if (status === "completed") {
    booking.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    booking.paymentStatus = "paid";
  }
  if (status === "checked_in") {
    booking.checkedInAt = booking.checkedInAt || (/* @__PURE__ */ new Date()).toISOString();
  }
  if (status === "cancelled") {
    releaseBookingSlotLock(booking);
  }
  if (status === "completed" || status === "no_show") {
    releaseBookingSlotLock(booking);
  }
  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    if (status === "completed") qe.status = "served";
    if (status === "cancelled") qe.status = "cancelled";
    if (status === "no_show") qe.status = "no_show";
    if (status === "checked_in") qe.isArriving = true;
  }
  db.recalculateQueueStats(booking.salonId);
  return res.json({ success: true, booking });
});
apiRouter.patch("/bookings/:id/cancel", requireAuth, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (!canReadBooking(req.auth, booking)) {
    return forbidden(res);
  }
  const salon = db.salons.get(booking.salonId);
  const isCustomer = req.auth.userId === booking.customerId;
  if (isCustomer) {
    if (salon && salon.bookingSettings && salon.bookingSettings.cancellationAllowed === false) {
      return res.status(400).json({ error: "Player cancellations are not allowed for this business." });
    }
    if (booking.scheduledDate && booking.scheduledTime) {
      const deadlineHours = booking.cancellationDeadlineHours ?? salon?.bookingSettings?.cancellationDeadlineHours ?? 2;
      const [h, m] = booking.scheduledTime.split(":").map(Number);
      const slotDate = /* @__PURE__ */ new Date(`${booking.scheduledDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      const cutoffTime = slotDate.getTime() - deadlineHours * 60 * 60 * 1e3;
      if (Date.now() >= cutoffTime) {
        return res.status(400).json({
          error: `Cancellation deadline passed (${deadlineHours} hours before slot). Cancellation is no longer permitted.`
        });
      }
    }
  }
  const isOwnerCancel = !isCustomer;
  const refundPct = isOwnerCancel ? 100 : booking.refundPercentage ?? salon?.bookingSettings?.refundPercentage ?? 70;
  const refundAmount = Math.round(booking.amount * refundPct / 100);
  const nonRefundableAmount = booking.amount - refundAmount;
  booking.status = "cancelled";
  booking.cancelledBy = isCustomer ? "customer" : "owner";
  booking.cancellationReason = reason || (isCustomer ? "Customer cancelled" : "Cancelled by owner");
  booking.cancelledAt = (/* @__PURE__ */ new Date()).toISOString();
  booking.refundPercentage = refundPct;
  booking.refundAmount = refundAmount;
  booking.nonRefundableAmount = nonRefundableAmount;
  booking.refundStatus = refundAmount > 0 ? "pending" : "none";
  releaseBookingSlotLock(booking);
  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    qe.status = "cancelled";
  }
  db.recalculateQueueStats(booking.salonId);
  const cancellerLabel = isOwnerCancel ? "QGo Business Owner" : "you";
  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: "cancelled",
    title: isOwnerCancel ? "\u26A0\uFE0F Booking Cancelled by Owner" : "Booking Cancelled",
    message: isOwnerCancel ? `Your booking at ${booking.salonName} on ${booking.scheduledDate} ${booking.scheduledTime} was cancelled by the owner. Full refund: \u20B9${refundAmount} (100%).` : `Your booking at ${booking.salonName} has been cancelled. Refund: \u20B9${refundAmount} (${refundPct}%).`,
    bookingId: id
  });
  if (isCustomer && salon) {
    sendNotification(salon.ownerId, {
      userId: salon.ownerId,
      type: "cancelled",
      title: "Customer Cancelled Booking",
      message: `${booking.customerName} cancelled their booking on ${booking.scheduledDate} at ${booking.scheduledTime}. Refund: \u20B9${refundAmount}.`,
      bookingId: id
    });
  }
  return res.json({
    success: true,
    message: isOwnerCancel ? `Booking cancelled by owner. Customer will receive full refund of \u20B9${refundAmount}.` : "Booking cancelled successfully",
    booking,
    cancelledBy: booking.cancelledBy,
    refund: {
      refundPercentage: refundPct,
      refundAmount,
      nonRefundableAmount,
      refundStatus: booking.refundStatus
    }
  });
});
apiRouter.patch("/bookings/:id/arriving", requireAuth, requireRole("consumer"), (req, res) => {
  const { id } = req.params;
  const booking = db.bookings.get(id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (booking.customerId !== req.auth.userId) {
    return forbidden(res);
  }
  booking.isArriving = true;
  const qe = db.queueEntries.get(`qe_${id}`);
  if (qe) {
    qe.isArriving = true;
  }
  const salon = db.salons.get(booking.salonId);
  if (salon) {
    sendNotification(salon.ownerId, {
      userId: salon.ownerId,
      type: "queue_update",
      title: "Customer Arriving!",
      message: `${booking.customerName} (${booking.tokenNumber}) is arriving at the shop.`,
      bookingId: id
    });
  }
  return res.json({ success: true, message: "Shop notified you are arriving!", booking });
});
apiRouter.get("/queue/:salonId/live", requireAuth, (req, res) => {
  const { salonId } = req.params;
  const { staffId } = req.query;
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  const includePrivate = canManageSalon(req.auth, salonId);
  if (!includePrivate && !salon.isPublished) {
    return res.status(404).json({ error: "Salon not found" });
  }
  db.recalculateQueueStats(salonId);
  let entries = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && q.status !== "cancelled" && q.status !== "served"
  );
  if (staffId && typeof staffId === "string" && staffId !== "all") {
    entries = entries.filter((q) => q.staffId === staffId);
  }
  entries.sort((a, b) => a.position - b.position);
  const staffList = Array.from(db.staff.values()).filter((s) => s.salonId === salonId && s.isActive);
  return res.json({
    success: true,
    salonId,
    queueLength: entries.filter((e) => e.status === "waiting" || e.status === "calling").length,
    estimatedWaitMinutes: salon?.estimatedWaitMinutes || 0,
    entries: entries.map((e) => sanitizeQueueEntry(e, includePrivate)),
    staff: staffList.map((s) => sanitizeStaff(s, includePrivate))
  });
});
apiRouter.post("/queue/:salonId/walk-in", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  const { customerName, customerPhone, serviceId, staffId } = req.body;
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  const service = serviceId ? db.services.get(serviceId) : Array.from(db.services.values()).find((s) => s.salonId === salonId);
  if (!service || !service.isActive) {
    return res.status(400).json({ error: "No service selected" });
  }
  if (service.salonId !== salonId) {
    return res.status(400).json({ error: "Service does not belong to this salon" });
  }
  const staffMember = staffId ? db.staff.get(staffId) : void 0;
  if (staffMember && staffMember.salonId !== salonId) {
    return res.status(400).json({ error: "Staff member does not belong to this salon" });
  }
  if (staffMember && staffMember.serviceIds.length > 0 && !staffMember.serviceIds.includes(service.id)) {
    return res.status(400).json({ error: "Staff member is not assigned to this service" });
  }
  const tokenNumber = db.getNextTokenNumber(salon);
  const bookingId = `bk_walkin_${Date.now()}`;
  const qrCodeId = `QR-${bookingId}-${import_crypto.default.randomBytes(6).toString("hex")}`.toUpperCase();
  const currentWaiting = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && (q.status === "waiting" || q.status === "calling")
  );
  const queueEntry = {
    id: `qe_${bookingId}`,
    bookingId,
    salonId,
    staffId: staffMember?.id,
    staffName: staffMember?.name || "Any Stylist",
    tokenNumber,
    position: currentWaiting.length + 1,
    status: "waiting",
    joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
    customerName: customerName || `Walk-in Guest (${tokenNumber.split("-").pop()})`,
    customerPhone: customerPhone || "At counter",
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    isAppointment: false
  };
  db.queueEntries.set(queueEntry.id, queueEntry);
  const newBooking = {
    id: bookingId,
    salonId,
    salonName: salon.name,
    staffId: staffMember?.id,
    staffName: staffMember?.name || "Any Stylist",
    customerId: `usr_walkin_${Date.now()}`,
    customerName: queueEntry.customerName,
    customerPhone: queueEntry.customerPhone,
    serviceId: service.id,
    serviceName: service.name,
    serviceDuration: service.durationMinutes,
    servicePrice: service.price,
    mode: "token",
    status: "confirmed",
    qrCodeId,
    qrSignature: makeQrSignature(bookingId, salonId, qrCodeId),
    tokenNumber,
    queuePosition: queueEntry.position,
    estimatedWaitMinutes: (currentWaiting.length + 1) * 15,
    joinedQueueAt: (/* @__PURE__ */ new Date()).toISOString(),
    paymentStatus: "pay_at_shop",
    amount: service.price,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.bookings.set(bookingId, newBooking);
  db.recalculateQueueStats(salonId);
  return res.status(201).json({
    success: true,
    message: "Walk-in added to queue",
    queueEntry,
    booking: newBooking
  });
});
apiRouter.post("/queue/:salonId/call-next", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  const { staffId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  if (staffId) {
    const staff2 = db.staff.get(staffId);
    if (!staff2 || staff2.salonId !== salonId) {
      return res.status(400).json({ error: "Staff member does not belong to this salon" });
    }
    if (!canActOnStaff(req.auth, salonId, staffId)) {
      return forbidden(res);
    }
  }
  const entries = Array.from(db.queueEntries.values()).filter((q) => q.salonId === salonId && q.status === "waiting" && (!staffId || q.staffId === staffId || !q.staffId)).sort((a, b) => a.position - b.position);
  if (entries.length === 0) {
    return res.status(404).json({ error: "No customers waiting in queue" });
  }
  const nextEntry = entries[0];
  nextEntry.status = "calling";
  const booking = db.bookings.get(nextEntry.bookingId);
  if (booking) {
    booking.status = "in_progress";
    sendNotification(booking.customerId, {
      userId: booking.customerId,
      type: "next_in_line",
      title: "You're Next! \u{1F389}",
      message: `Please proceed to Chair with ${nextEntry.staffName || "your stylist"}. Token: ${nextEntry.tokenNumber}.`,
      bookingId: booking.id
    });
  }
  const staff = staffId ? db.staff.get(staffId) : void 0;
  if (staff) {
    staff.status = "busy";
    staff.currentServingToken = nextEntry.tokenNumber;
  }
  db.recalculateQueueStats(salonId);
  return res.json({
    success: true,
    message: `Now calling ${nextEntry.customerName} (${nextEntry.tokenNumber})`,
    entry: nextEntry
  });
});
apiRouter.post("/queue/:salonId/mark-served", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  const { queueEntryId, bookingId, staffId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  let entry;
  if (queueEntryId) {
    entry = db.queueEntries.get(queueEntryId);
  } else if (bookingId) {
    entry = db.queueEntries.get(`qe_${bookingId}`);
  }
  if (entry && entry.salonId !== salonId) {
    return forbidden(res);
  }
  if (!entry) {
    return res.status(404).json({ error: "Queue entry not found" });
  }
  if (!canActOnStaff(req.auth, salonId, entry.staffId)) {
    return forbidden(res);
  }
  if (entry) {
    entry.status = "served";
    const booking = db.bookings.get(entry.bookingId);
    if (booking) {
      booking.status = "completed";
      booking.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      booking.paymentStatus = "paid";
      sendNotification(booking.customerId, {
        userId: booking.customerId,
        type: "queue_update",
        title: "Service Completed! \u2728",
        message: `Thank you for visiting ${booking.salonName}. Please leave a rating!`,
        bookingId: booking.id
      });
    }
  }
  if (staffId) {
    const staff = db.staff.get(staffId);
    if (staff && staff.salonId === salonId && canActOnStaff(req.auth, salonId, staff.id)) {
      staff.status = "available";
      staff.currentServingToken = void 0;
    }
  }
  db.recalculateQueueStats(salonId);
  return res.json({ success: true, message: "Customer service marked as completed!" });
});
apiRouter.post("/queue/:salonId/mark-no-show", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  const { queueEntryId, bookingId } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  let entry;
  if (queueEntryId) {
    entry = db.queueEntries.get(queueEntryId);
  } else if (bookingId) {
    entry = db.queueEntries.get(`qe_${bookingId}`);
  }
  if (entry && entry.salonId !== salonId) {
    return forbidden(res);
  }
  if (!entry) {
    return res.status(404).json({ error: "Queue entry not found" });
  }
  if (!canActOnStaff(req.auth, salonId, entry.staffId)) {
    return forbidden(res);
  }
  if (entry) {
    entry.status = "no_show";
    const booking = db.bookings.get(entry.bookingId);
    if (booking) {
      booking.status = "no_show";
      sendNotification(booking.customerId, {
        userId: booking.customerId,
        type: "queue_update",
        title: "Missed Turn",
        message: `Your turn at ${booking.salonName} was passed due to no-show.`,
        bookingId: booking.id
      });
    }
  }
  db.recalculateQueueStats(salonId);
  return res.json({ success: true, message: "Customer marked as no-show" });
});
apiRouter.post("/queue/:salonId/pause", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  const { reason = "Brief queue pause for shift change / break" } = req.body;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  const waiting = Array.from(db.queueEntries.values()).filter(
    (q) => q.salonId === salonId && q.status === "waiting"
  );
  waiting.forEach((w) => {
    const b = db.bookings.get(w.bookingId);
    if (b) {
      sendNotification(b.customerId, {
        userId: b.customerId,
        type: "queue_update",
        title: "Queue Paused Temporarily",
        message: `${b.salonName} has paused the queue briefly: ${reason}. Your position is reserved.`,
        bookingId: b.id
      });
    }
  });
  return res.json({ success: true, message: "Queue paused and waiting customers notified" });
});
apiRouter.post("/queue/:salonId/resume", requireAuth, requireRole("owner"), (req, res) => {
  const { salonId } = req.params;
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  return res.json({ success: true, message: "Queue resumed" });
});
apiRouter.post("/checkin/scan", requireAuth, requireRole("owner"), (req, res) => {
  const { qrData, salonId } = req.body;
  if (!qrData || !salonId) {
    return res.status(400).json({ error: "QR data and salonId are required" });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  let parsed;
  const expectsSignedQr = typeof qrData !== "string" || qrData.trim().startsWith("{");
  try {
    parsed = typeof qrData === "string" ? JSON.parse(qrData) : qrData;
  } catch (e) {
    parsed = { tokenNumber: qrData };
  }
  let booking = Array.from(db.bookings.values()).find((b) => {
    if (parsed.bookingId && b.id === parsed.bookingId) return true;
    if (parsed.qrCodeId && b.qrCodeId === parsed.qrCodeId) return true;
    if (parsed.tokenNumber && b.tokenNumber === parsed.tokenNumber) return true;
    return false;
  });
  if (!booking) {
    return res.status(404).json({
      valid: false,
      reason: "INVALID_QR",
      message: "No matching booking found for this QR code."
    });
  }
  if (booking.salonId !== salonId) {
    return res.status(403).json({
      valid: false,
      reason: "WRONG_SALON",
      message: "This ticket does not belong to this salon."
    });
  }
  if (expectsSignedQr && parsed.qrSignature !== booking.qrSignature) {
    return res.status(403).json({
      valid: false,
      reason: "INVALID_SIGNATURE",
      message: "QR signature could not be verified."
    });
  }
  if (booking.status === "cancelled") {
    return res.status(400).json({
      valid: false,
      reason: "CANCELLED",
      message: "This booking was cancelled by the customer."
    });
  }
  if (booking.status === "no_show") {
    return res.status(400).json({
      valid: false,
      reason: "NO_SHOW",
      message: "This booking was already marked as no-show."
    });
  }
  if (booking.status === "completed") {
    return res.status(400).json({
      valid: false,
      reason: "ALREADY_COMPLETED",
      message: "This service was already completed previously."
    });
  }
  if (booking.status === "checked_in") {
    return res.status(400).json({
      valid: false,
      reason: "ALREADY_CHECKED_IN",
      message: "This booking is already checked in."
    });
  }
  if (isBookingExpired(booking)) {
    return res.status(400).json({
      valid: false,
      reason: "EXPIRED",
      message: "This booking pass has expired.",
      booking
    });
  }
  return res.json({
    valid: true,
    needsAcceptance: true,
    message: `Booking found for ${booking.customerName}. Review details and accept check-in.`,
    booking
  });
  booking.status = "checked_in";
  booking.checkedInAt = (/* @__PURE__ */ new Date()).toISOString();
  const qe = db.queueEntries.get(`qe_${booking.id}`);
  if (qe) {
    qe.isArriving = true;
  }
  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: "checked_in",
    title: "Check-in Verified! \u2705",
    message: `You are successfully checked in at ${booking.salonName}. Please take a seat.`,
    bookingId: booking.id
  });
  return res.json({
    valid: true,
    message: `Welcome ${booking.customerName}! Verified for ${booking.serviceName}.`,
    booking
  });
});
apiRouter.post("/checkin/accept", requireAuth, requireRole("owner"), (req, res) => {
  const { bookingId, salonId } = req.body;
  if (!bookingId || !salonId) {
    return res.status(400).json({ error: "bookingId and salonId are required" });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  const booking = db.bookings.get(bookingId);
  const validation = validateBookingForCheckIn(booking, salonId);
  if (!validation.ok) {
    return res.status(validation.status).json({
      valid: false,
      reason: validation.reason,
      message: validation.message,
      booking: validation.booking
    });
  }
  booking.status = "checked_in";
  booking.checkedInAt = (/* @__PURE__ */ new Date()).toISOString();
  const qe = db.queueEntries.get(`qe_${booking.id}`);
  if (qe) {
    qe.isArriving = true;
  }
  sendNotification(booking.customerId, {
    userId: booking.customerId,
    type: "checked_in",
    title: "Booking Accepted",
    message: `You are checked in at ${booking.salonName}. Enjoy your slot.`,
    bookingId: booking.id
  });
  return res.json({
    valid: true,
    message: `Accepted: ${booking.customerName} is checked in.`,
    booking
  });
});
apiRouter.post("/checkin/manual-code", requireAuth, requireRole("owner"), (req, res) => {
  const { code, salonId } = req.body;
  if (!code || !salonId) {
    return res.status(400).json({ error: "Code and salonId are required" });
  }
  if (!canManageSalon(req.auth, salonId)) {
    return forbidden(res);
  }
  const cleanCode = code.trim().toUpperCase();
  const booking = Array.from(db.bookings.values()).find(
    (b) => b.salonId === salonId && (b.tokenNumber?.endsWith(cleanCode) || b.tokenNumber?.toUpperCase() === cleanCode || b.qrCodeId?.endsWith(cleanCode) || b.id.endsWith(cleanCode.toLowerCase()))
  );
  if (!booking) {
    return res.status(404).json({
      valid: false,
      message: `No active booking found matching code '${cleanCode}'.`
    });
  }
  if (booking.status === "checked_in") {
    return res.status(400).json({
      valid: false,
      message: "This booking is already checked in."
    });
  }
  if (booking.status === "cancelled" || booking.status === "no_show" || booking.status === "completed") {
    return res.status(400).json({
      valid: false,
      message: "This booking is not eligible for check-in."
    });
  }
  if (isBookingExpired(booking)) {
    return res.status(400).json({
      valid: false,
      reason: "EXPIRED",
      message: "This booking pass has expired.",
      booking
    });
  }
  return res.json({
    valid: true,
    needsAcceptance: true,
    message: `Booking found: ${booking.customerName} (${booking.tokenNumber}). Review and accept check-in.`,
    booking
  });
  booking.status = "checked_in";
  booking.checkedInAt = (/* @__PURE__ */ new Date()).toISOString();
  return res.json({
    valid: true,
    message: `Checked in: ${booking.customerName} (${booking.tokenNumber})`,
    booking
  });
});
apiRouter.get("/salons/:id/reviews", (req, res) => {
  const { id } = req.params;
  const auth = optionalAuth(req);
  const includePrivate = canManageSalon(auth, id);
  const reviews = Array.from(db.reviews.values()).filter((r) => r.salonId === id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({ success: true, reviews: reviews.map((r) => sanitizeReview(r, includePrivate)) });
});
apiRouter.post("/reviews", requireAuth, requireRole("consumer"), (req, res) => {
  const { bookingId, salonId, staffId, rating, comment } = req.body;
  if (!bookingId || !salonId || !rating || !comment) {
    return res.status(400).json({ error: "Booking, salon, rating (1-5), and comment are required" });
  }
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }
  const salon = db.salons.get(salonId);
  if (!salon) {
    return res.status(404).json({ error: "Salon not found" });
  }
  const booking = db.bookings.get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  if (booking.customerId !== req.auth.userId || booking.salonId !== salonId) {
    return forbidden(res);
  }
  if (booking.status !== "completed") {
    return res.status(403).json({ error: "Only completed bookings can be reviewed" });
  }
  const staff = staffId ? db.staff.get(staffId) : void 0;
  if (staffId && !staff) {
    return res.status(404).json({ error: "Staff member not found" });
  }
  if (staff && staff.salonId !== salonId) {
    return res.status(400).json({ error: "Staff member does not belong to this salon" });
  }
  if (staffId && booking.staffId && staffId !== booking.staffId) {
    return forbidden(res);
  }
  const existingReview = Array.from(db.reviews.values()).find(
    (r) => r.bookingId === bookingId && r.customerId === req.auth.userId
  );
  if (existingReview) {
    return res.status(409).json({ error: "This booking has already been reviewed" });
  }
  const revId = `rev_${Date.now()}`;
  const review = {
    id: revId,
    bookingId,
    customerId: req.auth.userId,
    customerName: req.auth.user.name || "Verified Customer",
    salonId,
    staffId: staff?.id || booking.staffId,
    staffName: staff?.name || booking.staffName,
    rating: numericRating,
    comment,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.reviews.set(revId, review);
  const allReviews = Array.from(db.reviews.values()).filter((r) => r.salonId === salonId);
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  salon.rating = Math.round(avg * 10) / 10;
  salon.reviewCount = allReviews.length;
  return res.status(201).json({ success: true, review });
});
apiRouter.post("/reviews/:id/response", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  const { response } = req.body;
  const review = db.reviews.get(id);
  if (!review) {
    return res.status(404).json({ error: "Review not found" });
  }
  if (!canManageSalon(req.auth, review.salonId)) {
    return forbidden(res);
  }
  review.ownerResponse = response;
  return res.json({ success: true, review });
});
apiRouter.get("/salons/:id/analytics", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const analytics = db.getAnalytics(id);
  return res.json({ success: true, analytics });
});
apiRouter.get("/salons/:id/analytics/export-csv", requireAuth, requireRole("owner"), (req, res) => {
  const { id } = req.params;
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const bookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);
  let csv = "BookingID,TokenNumber,CustomerName,Phone,Service,Price,Status,Mode,Date,Created\n";
  bookings.forEach((b) => {
    csv += `"${b.id}","${b.tokenNumber || ""}","${b.customerName}","${b.customerPhone}","${b.serviceName}",${b.amount},"${b.status}","${b.mode}","${b.scheduledDate || ""}","${b.createdAt}"
`;
  });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=qgo_report_${id}.csv`);
  return res.send(csv);
});
apiRouter.post("/salons/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  salon.status = "approved";
  salon.isPublished = true;
  salon.verified = true;
  salon.setupStep = 8;
  await saveSalonSnapshot(salon);
  sendNotification(salon.ownerId, {
    userId: salon.ownerId,
    type: "business_approved",
    title: "Business Approved \u{1F389}",
    message: "Your business has been approved. Your QGo business is now live."
  });
  return res.json({
    success: true,
    message: "Business approved successfully",
    salon
  });
});
apiRouter.get("/salons/:id/dashboard-overview", requireAuth, (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const now = /* @__PURE__ */ new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayFormatted = `${todayDayNames[now.getDay()]}, ${now.getDate()} ${now.toLocaleString("default", { month: "short" })}`;
  const allSalonBookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);
  const todayBookings = allSalonBookings.filter(
    (b) => (b.scheduledDate === todayStr || b.createdAt.startsWith(todayStr) && b.mode === "token") && b.status !== "cancelled"
  );
  const todayBookingsCount = todayBookings.length;
  const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const upcomingBookingsCount = allSalonBookings.filter(
    (b) => b.status === "confirmed" && b.scheduledDate && b.scheduledDate >= todayStr
  ).length;
  const completedBookingsCount = allSalonBookings.filter((b) => b.status === "completed").length;
  const cancelledBookingsCount = allSalonBookings.filter((b) => b.status === "cancelled").length;
  const turfSlotsResult = calculateTurfSlotsForDate(salon, todayStr);
  const todaySlots = turfSlotsResult.slots;
  const availableSlotsCount = todaySlots.filter((s) => s.available && !s.isBooked && !s.isBlocked).length;
  return res.json({
    success: true,
    data: {
      todayBookingsCount,
      todayRevenue,
      upcomingBookingsCount,
      availableSlotsCount,
      completedBookingsCount,
      cancelledBookingsCount,
      todayDateStr: todayStr,
      todayFormatted,
      todaySlots
    }
  });
});
apiRouter.get("/salons/:id/customers", requireAuth, (req, res) => {
  const { id } = req.params;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const allBookings = Array.from(db.bookings.values()).filter((b) => b.salonId === id);
  const customerMap = /* @__PURE__ */ new Map();
  for (const b of allBookings) {
    const custId = b.customerId || b.customerPhone;
    if (!customerMap.has(custId)) {
      customerMap.set(custId, {
        customerId: custId,
        name: b.customerName,
        phone: b.customerPhone,
        totalBookings: 0,
        totalSpent: 0,
        cancellationCount: 0
      });
    }
    const c = customerMap.get(custId);
    c.totalBookings += 1;
    if (b.status !== "cancelled") {
      c.totalSpent += b.amount || 0;
    }
    if (b.status === "cancelled") {
      c.cancellationCount += 1;
    }
    const bDate = b.scheduledDate || b.createdAt.split("T")[0];
    if (!c.lastBookingDate || bDate > c.lastBookingDate) {
      c.lastBookingDate = bDate;
    }
    if (b.status === "confirmed" && b.scheduledDate && b.scheduledDate >= (/* @__PURE__ */ new Date()).toISOString().split("T")[0]) {
      if (!c.upcomingBookingDate || b.scheduledDate < c.upcomingBookingDate) {
        c.upcomingBookingDate = b.scheduledDate;
      }
    }
  }
  const customers = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  return res.json({ success: true, customers });
});
apiRouter.get("/salons/:id/revenue-stats", requireAuth, (req, res) => {
  const { id } = req.params;
  const { period = "month", startDate, endDate } = req.query;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const now = /* @__PURE__ */ new Date();
  const todayStr = now.toISOString().split("T")[0];
  let filterStart = "1970-01-01";
  let filterEnd = "2099-12-31";
  if (period === "today") {
    filterStart = todayStr;
    filterEnd = todayStr;
  } else if (period === "week") {
    const weekAgo = /* @__PURE__ */ new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filterStart = weekAgo.toISOString().split("T")[0];
  } else if (period === "month") {
    const monthAgo = /* @__PURE__ */ new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    filterStart = monthAgo.toISOString().split("T")[0];
  } else if (startDate && typeof startDate === "string") {
    filterStart = startDate;
    if (endDate && typeof endDate === "string") filterEnd = endDate;
  }
  const bookings = Array.from(db.bookings.values()).filter((b) => {
    if (b.salonId !== id) return false;
    const bDate = b.scheduledDate || b.createdAt.split("T")[0];
    return bDate >= filterStart && bDate <= filterEnd;
  });
  let grossRevenue = 0;
  let completedRevenue = 0;
  let completedBookingsCount = 0;
  let cancelledBookingsCount = 0;
  let totalRefunds = 0;
  const transactions = bookings.map((b) => {
    if (b.status === "completed") {
      completedBookingsCount += 1;
      completedRevenue += b.amount || 0;
      grossRevenue += b.amount || 0;
    } else if (b.status === "cancelled") {
      cancelledBookingsCount += 1;
      totalRefunds += b.refundAmount || 0;
      grossRevenue += b.amount || 0;
    } else if (b.status === "confirmed" || b.status === "checked_in") {
      grossRevenue += b.amount || 0;
    }
    return {
      bookingId: b.id,
      tokenNumber: b.tokenNumber,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      serviceName: b.serviceName,
      amount: b.amount || 0,
      refundAmount: b.refundAmount,
      status: b.status,
      paymentStatus: b.paymentStatus,
      scheduledDate: b.scheduledDate,
      scheduledTime: b.scheduledTime,
      createdAt: b.createdAt
    };
  });
  const netRevenue = Math.max(0, grossRevenue - totalRefunds);
  return res.json({
    success: true,
    data: {
      grossRevenue,
      completedBookingsCount,
      completedRevenue,
      cancelledBookingsCount,
      totalRefunds,
      netRevenue,
      period,
      transactions: transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  });
});
apiRouter.post("/salons/:id/block-slot", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { date, startTime, endTime, resourceId, reason } = req.body;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const affectedBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === id && b.scheduledDate === date && b.scheduledTime === startTime && b.status !== "cancelled"
  );
  const schedules = salon.turfSchedule || [];
  const schedule = schedules[0];
  if (schedule) {
    const dayOfWeek = (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).getUTCDay();
    const dayConfig = schedule.days?.find((d) => d.dayOfWeek === dayOfWeek);
    if (dayConfig) {
      dayConfig.disabledSlots = dayConfig.disabledSlots || [];
      if (!dayConfig.disabledSlots.includes(startTime)) {
        dayConfig.disabledSlots.push(startTime);
      }
      if (dayConfig.slots) {
        const slotItem = dayConfig.slots.find((s) => s.startTime === startTime);
        if (slotItem) slotItem.status = "blocked";
      }
    }
  }
  await saveSalonSnapshot(salon);
  return res.json({
    success: true,
    message: `Slot ${startTime} on ${date} blocked successfully.`,
    affectedBookings
  });
});
apiRouter.post("/salons/:id/unblock-slot", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { date, startTime, resourceId } = req.body;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const schedules = salon.turfSchedule || [];
  const schedule = schedules[0];
  if (schedule) {
    const dayOfWeek = (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).getUTCDay();
    const dayConfig = schedule.days?.find((d) => d.dayOfWeek === dayOfWeek);
    if (dayConfig) {
      if (dayConfig.disabledSlots) {
        dayConfig.disabledSlots = dayConfig.disabledSlots.filter((t) => t !== startTime);
      }
      if (dayConfig.slots) {
        const slotItem = dayConfig.slots.find((s) => s.startTime === startTime);
        if (slotItem && slotItem.status === "blocked") slotItem.status = "active";
      }
    }
  }
  await saveSalonSnapshot(salon);
  return res.json({
    success: true,
    message: `Slot ${startTime} on ${date} unblocked.`
  });
});
apiRouter.post("/salons/:id/block-date", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { date, reason = "Personal Holiday / Private Event", forceCancelBookings } = req.body;
  const salon = db.salons.get(id);
  if (!salon) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (!canManageSalon(req.auth, id)) {
    return forbidden(res);
  }
  const affectedBookings = Array.from(db.bookings.values()).filter(
    (b) => b.salonId === id && b.scheduledDate === date && b.status !== "cancelled"
  );
  if (affectedBookings.length > 0 && !forceCancelBookings) {
    return res.status(409).json({
      error: `There are ${affectedBookings.length} existing booking(s) on ${date}.`,
      hasConflicts: true,
      affectedBookings
    });
  }
  if (forceCancelBookings && affectedBookings.length > 0) {
    for (const b of affectedBookings) {
      b.status = "cancelled";
      releaseBookingSlotLock(b);
      b.cancellationReason = `Date blocked by owner: ${reason}`;
      b.refundAmount = b.amount;
      b.refundPercentage = 100;
      b.refundStatus = "pending";
      sendNotification(b.customerId, {
        userId: b.customerId,
        type: "cancelled",
        title: "Booking Cancelled (Full Refund)",
        message: `Your booking on ${date} at ${salon.name} was cancelled due to: ${reason}. Full refund of \u20B9${b.amount} has been initiated.`,
        bookingId: b.id
      });
    }
  }
  salon.holidays = salon.holidays || [];
  if (!salon.holidays.some((h) => h.date === date)) {
    salon.holidays.push({ date, reason });
  }
  const schedules = salon.turfSchedule || [];
  if (schedules.length > 0) {
    schedules[0].specialDates = schedules[0].specialDates || [];
    if (!schedules[0].specialDates.some((sd) => sd.date === date)) {
      schedules[0].specialDates.push({ date, reason, isClosed: true });
    }
  }
  await saveSalonSnapshot(salon);
  return res.json({
    success: true,
    message: `Date ${date} blocked successfully.`,
    affectedBookings
  });
});
apiRouter.get("/notifications", requireAuth, (req, res) => {
  const notifs = db.notifications.get(req.auth.userId) || [];
  return res.json({ success: true, notifications: notifs });
});
apiRouter.patch("/notifications/read-all", requireAuth, (req, res) => {
  const notifs = db.notifications.get(req.auth.userId) || [];
  notifs.forEach((n) => n.read = true);
  return res.json({ success: true, message: "All notifications marked as read" });
});
function startNotificationAndSlotScheduler() {
  setInterval(() => {
    try {
      const now = /* @__PURE__ */ new Date();
      const todayStr = now.toISOString().split("T")[0];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      for (const booking of db.bookings.values()) {
        if ((booking.status === "confirmed" || booking.status === "pending") && booking.scheduledDate === todayStr && booking.scheduledTime && !booking.reminderSent) {
          const salon = db.salons.get(booking.salonId);
          const reminderMins = booking.reminderMinutesBefore ?? salon?.bookingSettings?.reminderMinutesBefore ?? 30;
          const startM = timeToMinutes(booking.scheduledTime);
          const diff = startM - nowMinutes;
          if (diff <= reminderMins && diff >= -15) {
            booking.reminderSent = true;
            sendNotification(booking.customerId, {
              userId: booking.customerId,
              type: "reminder",
              title: "Slot Starting Soon!",
              message: `Your booking at ${booking.salonName} (${booking.resourceName || "Turf"}) starts in ${reminderMins} minutes at ${format12Hour(booking.scheduledTime)}. Please arrive on time!`,
              bookingId: booking.id
            });
          }
        }
      }
    } catch (err) {
      console.error("Error in background reminder scheduler:", err);
    }
  }, 3e4);
}

// server.ts
async function startServer() {
  const app = (0, import_express2.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  const isProduction = process.env.NODE_ENV === "production";
  const firebaseStatus = getFirebaseStatus();
  console.log(`[FIREBASE] ${firebaseStatus.configured ? `connected to ${firebaseStatus.projectId}` : "not configured; using in-memory data"}`);
  const restoredState = await loadDatabaseSnapshot(db);
  const persistedSalons = await loadPersistedSalons();
  persistedSalons.forEach((salon) => db.salons.set(salon.id, salon));
  const persistedUsers = await loadPersistedUsers();
  persistedUsers.forEach((user) => db.users.set(user.id, user));
  await ensureFirebaseCategories();
  if (persistedSalons.length > 0) {
    console.log(`[FIREBASE] Loaded ${persistedSalons.length} business snapshot(s)`);
  }
  if (persistedUsers.length > 0) {
    console.log(`[FIREBASE] Loaded ${persistedUsers.length} user record(s)`);
  }
  if (restoredState) {
    console.log("[FIREBASE] Restored application state");
  }
  const configuredOrigins = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.PRODUCTION_FRONTEND_ORIGIN,
    process.env.VITE_DEV_ORIGIN,
    process.env.CAPACITOR_ANDROID_ORIGIN,
    "https://qgo.app",
    "capacitor://localhost",
    process.env.CORS_ORIGINS
  ].flatMap((value) => (value || "").split(",")).map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  function isPrivateLanHost(hostname) {
    return /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  }
  function isAllowedOrigin(origin) {
    if (!origin) return true;
    const normalized = origin.replace(/\/$/, "");
    if (configuredOrigins.includes(normalized)) return true;
    if (!isProduction) {
      try {
        const { hostname, protocol } = new URL(normalized);
        return (protocol === "http:" || protocol === "https:") && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]" || isPrivateLanHost(hostname));
      } catch {
        return false;
      }
    }
    return false;
  }
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(isAllowedOrigin(origin) ? 204 : 403);
    }
    next();
  });
  app.use(import_express2.default.json({ limit: "50mb" }));
  app.use(import_express2.default.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", name: "QGo API", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.use("/api/v1", apiRouter);
  app.use("/api", apiRouter);
  startNotificationAndSlotScheduler();
  const persistenceTimer = setInterval(() => {
    void saveDatabaseSnapshot(db);
  }, 5e3);
  persistenceTimer.unref();
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : void 0
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
  \x1B[32m\u2714\x1B[0m \x1B[1mQGo App is running!\x1B[0m`);
    console.log(`  \x1B[36m\u279C\x1B[0m  \x1B[1mLocal:\x1B[0m   \x1B[36mhttp://localhost:${PORT}/\x1B[0m`);
    console.log(`  \x1B[36m\u279C\x1B[0m  \x1B[1mNetwork:\x1B[0m listening on all interfaces (0.0.0.0:${PORT})
`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start QGo server:", err);
});
//# sourceMappingURL=server.cjs.map
