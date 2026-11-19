export type BookingDraft = {
  date: string;
  startTime: string;
  endTime: string;
  format: string;
  pitches: number;
  players: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  price?: number;
  paymentType?: 'FULL' | 'ADVANCE' | 'BOTH';
  advanceAmount?: number;
};

export type CustomerVenue = {
  id: string;
  name: string;
  address: string;
  city: string;
  distance: string;
  distanceKm?: number;
  hasValidCoords?: boolean;
  image: string;
  sports: string;
  category?: string;
  rating?: number;
  minPrice?: number;
  salon?: any;
};

export type CustomerTab = 'home' | 'turf' | 'booking' | 'favorites' | 'profile';

export type BookingStep = 'detail' | 'slot' | 'summary' | 'payment' | 'paid' | 'ticket';

export type SportItem = {
  name: string;
  color: string;
  image: string;
};

export type ProfileSubView = 'main' | 'account' | 'refunds' | 'support' | 'privacy' | 'terms';
