export type QbiLang = 'en' | 'ta';

export const QBI_STRINGS = {
  en: {
    welcomeTitle: 'Hi Buddy!',
    welcomeSub: 'Welcome to QGo',
    welcomeBack: 'Hi Buddy! Good to see you',
    bookedTitle: 'Booked!',
    bookedSub: 'Your slot is confirmed.',
    notBookedTitle: 'Not booked',
    notBookedGeneric: 'Something went wrong and your booking was not confirmed. Please try again.',
    slotFullTitle: 'Slot just got taken',
    slotFullSub: 'Please go back and pick another time.',
    offlineTitle: 'No internet',
    offlineSub: 'Your booking was not confirmed. Check your connection and try again.',
    offlineBanner: "You're offline",
    backOnline: 'Back online',
    retry: 'Try again',
    close: 'Close',
    gotIt: 'Got it',
    nextTip: 'Next',
    emptyBookings: 'Nothing booked yet. Pick a venue to get started!',
  },
  ta: {
    welcomeTitle: 'வணக்கம் நண்பா!',
    welcomeSub: 'QGo-விற்கு வரவேற்கிறோம்',
    welcomeBack: 'வணக்கம் நண்பா! மீண்டும் சந்திப்போம்',
    bookedTitle: 'புக் ஆகிவிட்டது!',
    bookedSub: 'உங்கள் ஸ்லாட் உறுதியாகிவிட்டது.',
    notBookedTitle: 'புக் ஆகவில்லை',
    notBookedGeneric: 'ஏதோ தவறு நடந்தது, உங்கள் புக்கிங் உறுதியாகவில்லை. மீண்டும் முயற்சிக்கவும்.',
    slotFullTitle: 'ஸ்லாட் ஏற்கனவே எடுக்கப்பட்டது',
    slotFullSub: 'திரும்பிச் சென்று வேறு நேரத்தைத் தேர்ந்தெடுக்கவும்.',
    offlineTitle: 'இணைய இணைப்பு இல்லை',
    offlineSub: 'உங்கள் புக்கிங் உறுதியாகவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    offlineBanner: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்',
    backOnline: 'மீண்டும் ஆன்லைன்',
    retry: 'மீண்டும் முயற்சி',
    close: 'மூடு',
    gotIt: 'சரி',
    nextTip: 'அடுத்து',
    emptyBookings: 'இன்னும் புக்கிங் இல்லை. ஒரு வென்யூவைத் தேர்ந்தெடுங்கள்!',
  },
} as const;

export type QbiCopyKey = keyof typeof QBI_STRINGS.en;

export const QBI_TIPS: Record<QbiLang, Record<string, string[]>> = {
  en: {
    home: [
      'Pick a sport, then tap a venue.',
      'Tap the heart on any card to save to Favorites.',
    ],
    turf: [
      'Browse all sports venues and facilities.',
      'Tap a venue to view turf details & slots.',
    ],
    detail: [
      'Review amenities, price, and venue location.',
      'Tap Proceed to Select a Slot to continue.',
    ],
    slot: [
      'Tap an available slot to pick date & time.',
      'Enter Name and Phone, then Confirm & Book Slot.',
    ],
    summary: [
      'Review your booking date, slot time, and rate.',
      'Tap Proceed to Pay to choose your payment method.',
    ],
    payment: [
      'Choose UPI or Card, then tap Complete Order.',
      'Keep the app open while it says Confirming.',
    ],
    ticket: [
      'Show this QR code at the venue entrance.',
      'Tap Download Ticket to save it for offline use.',
    ],
    booking: [
      'Upcoming shows confirmed slots; Past shows finished ones.',
      'Tap View Ticket on any booking to view its QR.',
    ],
    favorites: [
      'Venues you hearted are saved here.',
      'Tap any saved venue to book directly.',
    ],
    profile: [
      'Change theme or language here.',
      'Manage your account and profile settings.',
    ],
  },
  ta: {
    home: [
      'விளையாட்டைத் தேர்ந்தெடுத்து, வென்யூவைத் தட்டவும்.',
      'பிடித்த வென்யூவைச் சேமிக்க இதயக் குறியைத் தட்டவும்.',
    ],
    turf: [
      'அனைத்து விளையாட்டு மைதானங்களையும் பார்க்கவும்.',
      'விவரங்கள் மற்றும் ஸ்லாட்டுகளைக் காண வென்யூவைத் தட்டவும்.',
    ],
    detail: [
      'மைதான வசதிகள் மற்றும் இருப்பிடத்தைச் சரிபார்க்கவும்.',
      'ஸ்லாட் தேர்வு செய்ய Proceed to Select a Slot தட்டவும்.',
    ],
    slot: [
      'கிடைக்கும் நேர ஸ்லாட்டைத் தேர்ந்தெடுக்க தட்டவும்.',
      'பெயர் & எண் உள்ளிட்டு Confirm & Book Slot தட்டவும்.',
    ],
    summary: [
      'தேதி, நேரம் மற்றும் கட்டணத்தைச் சரிபார்க்கவும்.',
      'பணம் செலுத்த Proceed to Pay பொத்தானைத் தட்டவும்.',
    ],
    payment: [
      'UPI அல்லது கார்டைத் தேர்வுசெய்து Complete Order தட்டவும்.',
      'உறுதிப்படுத்தும் வரை செயலியை மூடாமல் வைக்கவும்.',
    ],
    ticket: [
      'நுழைவாயிலில் இந்த QR குறியீட்டைக் காட்டவும்.',
      'ஆஃப்லைனில் பயன்படுத்த Download Ticket தட்டவும்.',
    ],
    booking: [
      'வரவிருக்கும் மற்றும் முடிந்த புக்கிங்குகளை இங்கே காணலாம்.',
      'QR குறியீட்டைக் காண View Ticket தட்டவும்.',
    ],
    favorites: [
      'நீங்கள் சேமித்த வென்யூக்கள் இங்கே தோன்றும்.',
      'நேரடியாக புக் செய்ய வென்யூவைத் தட்டவும்.',
    ],
    profile: [
      'தீம் அல்லது மொழியை இங்கே மாற்றிக் கொள்ளலாம்.',
      'உங்கள் கணக்கு மற்றும் அமைப்புகளை நிர்வகிக்கவும்.',
    ],
  },
};

export function resolveLang(lang?: string | null): QbiLang {
  // Qbi defaults to English by default across mobile and web
  if (lang === 'ta') {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('qgo_qbi_lang') === 'ta') {
        return 'ta';
      }
    } catch {}
    return 'en';
  }
  return 'en';
}

export function t(lang: string | null | undefined, key: QbiCopyKey): string {
  const l = resolveLang(lang);
  return QBI_STRINGS[l][key] || QBI_STRINGS.en[key] || '';
}

export function getTips(lang: string | null | undefined, screenId: string | null | undefined): string[] {
  if (!screenId) return [];
  const l = resolveLang(lang);
  const dict = QBI_TIPS[l] || QBI_TIPS.en;
  return dict[screenId] || QBI_TIPS.en[screenId] || [];
}
