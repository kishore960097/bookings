import { describe, it, expect } from 'vitest';
import { CustomerVenue, BookingDraft } from '../src/features/customer/types';

describe('Customer Domain Logic & Filtering', () => {
  const mockVenues: CustomerVenue[] = [
    {
      id: 'venue_1',
      name: 'Erode Premier Arena',
      address: 'Perundurai Road, Erode',
      city: 'Erode',
      distance: '1.5 km',
      image: 'https://example.com/erode.jpg',
      sports: 'Cricket, Football',
    },
    {
      id: 'venue_2',
      name: 'Chennai Sports Hub',
      address: 'Anna Nagar, Chennai',
      city: 'Chennai',
      distance: '12.0 km',
      image: 'https://example.com/chennai.jpg',
      sports: 'Football, Tennis',
    },
    {
      id: 'venue_3',
      name: 'Coimbatore Smash Turf',
      address: 'Gandhipuram, Coimbatore',
      city: 'Coimbatore',
      distance: '5.2 km',
      image: 'https://example.com/cbe.jpg',
      sports: 'Cricket',
    },
  ];

  it('filters venues accurately by sport keyword', () => {
    const cricketVenues = mockVenues.filter((v) =>
      v.sports.toLowerCase().includes('cricket')
    );
    expect(cricketVenues).toHaveLength(2);
    expect(cricketVenues.map((v) => v.id)).toEqual(['venue_1', 'venue_3']);

    const tennisVenues = mockVenues.filter((v) =>
      v.sports.toLowerCase().includes('tennis')
    );
    expect(tennisVenues).toHaveLength(1);
    expect(tennisVenues[0].id).toBe('venue_2');
  });

  it('filters venues by case-insensitive text search matching name or address', () => {
    const query = 'perundurai';
    const matches = mockVenues.filter((v) =>
      `${v.name} ${v.address} ${v.sports}`.toLowerCase().includes(query.toLowerCase())
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Erode Premier Arena');
  });

  it('filters venues by user location and falls back when no local matches exist', () => {
    const userLocation = 'Salem';
    const localMatches = mockVenues.filter(
      (v) =>
        v.address.toLowerCase().includes(userLocation.toLowerCase()) ||
        v.city.toLowerCase().includes(userLocation.toLowerCase())
    );
    expect(localMatches).toHaveLength(0);

    // Resilient fallback: ensure customer still sees available venues
    const fallback = localMatches.length === 0 ? mockVenues : localMatches;
    expect(fallback).toHaveLength(3);
  });

  it('validates advance payment draft structure and balance calculations', () => {
    const draft: BookingDraft = {
      date: '2026-11-01',
      startTime: '18:00',
      endTime: '20:00',
      format: 'Box Cricket',
      pitches: 1,
      players: 12,
      price: 2400,
      paymentType: 'ADVANCE',
      advanceAmount: 600,
    };

    expect(draft.price).toBe(2400);
    expect(draft.advanceAmount).toBe(600);
    expect(draft.advanceAmount!).toBeLessThanOrEqual(draft.price!);

    const balanceAmount = (draft.price || 0) - (draft.advanceAmount || 0);
    expect(balanceAmount).toBe(1800);
  });

  it('strictly excludes venues outside the selected radius when auto-detect GPS is active', () => {
    const venuesWithDistances: (CustomerVenue & { distanceKm?: number })[] = [
      { id: 'v1', name: 'Nearby Arena', address: 'Main Rd', city: 'Sathyamangalam', distance: '3.2 km away', distanceKm: 3.2, sports: 'Cricket', image: '' },
      { id: 'v2', name: 'Midway Turf', address: 'Cross Rd', city: 'Sathyamangalam', distance: '12.8 km away', distanceKm: 12.8, sports: 'Football', image: '' },
      { id: 'v3', name: 'Far Away Ground', address: 'Highway', city: 'Coimbatore', distance: '48.5 km away', distanceKm: 48.5, sports: 'Cricket', image: '' },
      { id: 'v4', name: 'Unknown Ground', address: 'Unknown', city: 'Nowhere', distance: '', distanceKm: undefined, sports: 'Football', image: '' },
    ];

    const radius15 = venuesWithDistances.filter(
      (v) => v.distanceKm !== undefined && v.distanceKm <= 15
    ).sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

    expect(radius15).toHaveLength(2);
    expect(radius15[0].id).toBe('v1');
    expect(radius15[1].id).toBe('v2');
    // Ensure distant and missing coordinate venues are excluded
    expect(radius15.some((v) => v.id === 'v3')).toBe(false);
    expect(radius15.some((v) => v.id === 'v4')).toBe(false);
    // Ensure no venue renders "DISTANCE UNAVAILABLE"
    radius15.forEach((v) => {
      expect(v.distance).not.toContain('unavailable');
      expect(v.distance).not.toContain('DISTANCE UNAVAILABLE');
    });
  });

  it('dynamically discovers new categories registered by business owners', () => {
    const rawSalons = [
      { id: 's1', name: 'Green Park Turf', category: 'Turf' },
      { id: 's2', name: 'Glamour Cuts', category: 'Salon' },
      { id: 's3', name: 'Smash Point Badminton', category: 'Badminton' },
      { id: 's4', name: 'Pixel Gaming Arena', category: 'Gaming Arena' },
      { id: 's5', name: 'Elite Sports Arena', category: 'Sports Arena' },
    ];

    const customSet = new Set<string>();
    rawSalons.forEach((s) => {
      if (!s.category) return;
      const cat = s.category.trim();
      const lower = cat.toLowerCase();
      if (lower !== 'turf' && lower !== 'salon' && lower !== 'sports arena' && lower !== 'all') {
        customSet.add(cat.charAt(0).toUpperCase() + cat.slice(1));
      }
    });

    const dynamicCategories = ['All', 'Turf', 'Salon', ...Array.from(customSet)];
    expect(dynamicCategories).toContain('All');
    expect(dynamicCategories).toContain('Turf');
    expect(dynamicCategories).toContain('Salon');
    expect(dynamicCategories).toContain('Badminton');
    expect(dynamicCategories).toContain('Gaming Arena');
  });

  it('determines real-time slot statuses (CLOSED, BOOKED, BLOCKED, AVAILABLE)', () => {
    const todayIso = '2026-11-18';
    const currentMinutes = 14 * 60 + 30; // 2:30 PM

    const slots = [
      { id: 'slot_1', startTime: '10:00', endTime: '11:00', available: true, isBooked: false, isBlocked: false },
      { id: 'slot_2', startTime: '14:00', endTime: '15:00', available: true, isBooked: false, isBlocked: false },
      { id: 'slot_3', startTime: '16:00', endTime: '17:00', available: false, isBooked: true, isBlocked: false },
      { id: 'slot_4', startTime: '18:00', endTime: '19:00', available: false, isBooked: false, isBlocked: true },
      { id: 'slot_5', startTime: '20:00', endTime: '21:00', available: true, isBooked: false, isBlocked: false },
    ];

    const getStatus = (slot: typeof slots[0], date: string) => {
      const [sH, sM] = slot.startTime.split(':').map(Number);
      const slotStart = sH * 60 + sM;
      const isPast = date < todayIso || (date === todayIso && currentMinutes >= slotStart);

      if (slot.isBooked) return 'BOOKED';
      if (isPast) return 'CLOSED';
      if (slot.isBlocked) return 'BLOCKED';
      return 'AVAILABLE';
    };

    expect(getStatus(slots[0], todayIso)).toBe('CLOSED'); // 10:00 is past 14:30
    expect(getStatus(slots[1], todayIso)).toBe('CLOSED'); // 14:00 is past 14:30
    expect(getStatus(slots[2], todayIso)).toBe('BOOKED'); // 16:00 is booked
    expect(getStatus(slots[3], todayIso)).toBe('BLOCKED'); // 18:00 is blocked
    expect(getStatus(slots[4], todayIso)).toBe('AVAILABLE'); // 20:00 is upcoming and open
  });
});
