import { useState, useEffect, useCallback } from 'react';
import { BookingDraft, BookingStep, CustomerVenue } from '../types';

export function useBookingFlow() {
  const [selectedVenue, setSelectedVenueState] = useState<CustomerVenue | null>(() => {
    try {
      const saved = sessionStorage.getItem('qgo_venue');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setSelectedVenue = useCallback((venue: CustomerVenue | null) => {
    setSelectedVenueState(venue);
    try {
      if (venue) sessionStorage.setItem('qgo_venue', JSON.stringify(venue));
      else sessionStorage.removeItem('qgo_venue');
    } catch {
      // ignore
    }
  }, []);

  const [bookingStep, setBookingStep] = useState<BookingStep>(() => {
    try {
      const savedStep = sessionStorage.getItem('qgo_bs');
      return savedStep === 'paid' ? 'ticket' : ((savedStep as BookingStep | null) || 'detail');
    } catch {
      return 'detail';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('qgo_bs', bookingStep);
    } catch {
      // ignore
    }
  }, [bookingStep]);

  const [bookingDraft, setBookingDraftState] = useState<BookingDraft>(() => {
    try {
      const saved = sessionStorage.getItem('qgo_draft');
      return saved ? JSON.parse(saved) : { date: '', startTime: '', endTime: '', format: 'Box Cricket', pitches: 1, players: 10 };
    } catch {
      return { date: '', startTime: '', endTime: '', format: 'Box Cricket', pitches: 1, players: 10 };
    }
  });

  const setBookingDraft = useCallback((draft: BookingDraft | ((prev: BookingDraft) => BookingDraft)) => {
    setBookingDraftState((prev) => {
      const next = typeof draft === 'function' ? draft(prev) : draft;
      try {
        sessionStorage.setItem('qgo_draft', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const [createdBooking, setCreatedBookingState] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('qgo_booking');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setCreatedBooking = useCallback((booking: any) => {
    setCreatedBookingState(booking);
    try {
      if (booking) sessionStorage.setItem('qgo_booking', JSON.stringify(booking));
      else sessionStorage.removeItem('qgo_booking');
    } catch {
      // ignore
    }
  }, []);

  const resetBookingFlow = useCallback(() => {
    setSelectedVenue(null);
    setBookingStep('detail');
  }, [setSelectedVenue]);

  return {
    selectedVenue,
    setSelectedVenue,
    bookingStep,
    setBookingStep,
    bookingDraft,
    setBookingDraft,
    createdBooking,
    setCreatedBooking,
    resetBookingFlow,
  };
}
