import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, ChevronDown, ChevronRight, CircleDollarSign, Compass, Globe2, Heart, Home, Info, LockKeyhole, LogOut, MapPin, Search, SlidersHorizontal, Ticket, UserRound, UserCircle, Headphones, ClipboardCheck, Phone, Star, Receipt, Wallet, CreditCard, ShieldCheck, Zap, Clock, Check, ChevronLeft, Crosshair, IndianRupee, Sun, Moon, QrCode, CheckCircle2, MessageSquare, HelpCircle, AlertCircle, X, ExternalLink, Share2, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useQueue } from '../../context/QueueContext';
import { getTicketFileName, ensureTicketImagesReady, TICKET_CAPTURE_OPTIONS } from './utils/ticketDownload';
import QRCodeLib from 'qrcode';
import { isTurfBusiness, Salon } from '../../types';
import { api, getCachedApiData } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { haptics } from '../../utils/haptics';
import { LiquidBottomNav, CustomerTabKey } from '../../components/navigation/LiquidBottomNav';
import { useQbi, useQbiScreen, classifyBookingFailure, Qbi } from '../../components/qbi';
import { QGoLoader } from '../../components/common/QGoLoader';
import { formatDateTimeIST, formatDateIST, sanitizeCustomerName } from '../../utils/timeFormat';

import { BookingDraft, CustomerVenue, CustomerTab, BookingStep, SportItem } from './types';
import { useCustomerLocation } from './hooks/useCustomerLocation';
import { useCustomerVenues } from './hooks/useCustomerVenues';
import { useBookingFlow } from './hooks/useBookingFlow';
import { ProfileView } from './components/profile';

export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DEFAULT_TURF_PHOTO = 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=800&q=80';

const sports: SportItem[] = [
  { name: 'Football', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=260&q=80' },
  { name: 'Cricket', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=260&q=80' },
  { name: 'Basketball', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=260&q=80' },
  { name: 'Swimming', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=260&q=80' },
];

export function CustomerPage({ onOpenNotifications, onLogout }: { onOpenNotifications?: () => void; onLogout: () => void }) {
  const { user, t, language } = useAuth();

  const [activeTab, setActiveTabState] = useState<CustomerTab>(() => {
    const saved = sessionStorage.getItem('qgo_customer_tab') as any;
    if (saved && ['home', 'turf', 'booking', 'favorites', 'profile'].includes(saved)) {
      return saved;
    }
    return 'home';
  });
  const setActiveTab = (tab: CustomerTab) => {
    setActiveTabState(tab);
    sessionStorage.setItem('qgo_customer_tab', tab);
  };

  useEffect(() => {
    const handleNavEvent = (e: any) => {
      if (e?.detail) {
        setActiveTab(e.detail);
      }
    };
    const handleSelectVenueEvent = (e: any) => {
      if (e?.detail) {
        setSelectedVenue(e.detail);
      }
    };
    window.addEventListener('qgo-navigate-tab', handleNavEvent);
    window.addEventListener('qgo-select-venue', handleSelectVenueEvent);
    return () => {
      window.removeEventListener('qgo-navigate-tab', handleNavEvent);
      window.removeEventListener('qgo-select-venue', handleSelectVenueEvent);
    };
  }, []);

  const {
    userLocation,
    setUserLocation,
    userCoords,
    setUserCoords,
    isAutoDetectActive,
    setAutoDetectActive,
    radiusKm,
    setRadiusKm,
    isLocationModalOpen,
    setIsLocationModalOpen,
    isMapView,
    setIsMapView,
    locationSearch,
    setLocationSearch,
    isLocating,
    locationError,
    handleGetCurrentLocation: rawHandleGetCurrentLocation,
    selectManualLocation,
  } = useCustomerLocation();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<{
    category: string;
    priceRange: 'all' | 'under_500' | '500_1000' | '1000_plus';
    minRating: number;
    sortBy: 'nearest' | 'rating' | 'price_asc';
    timeFilter: 'all' | 'morning' | 'evening';
    radiusKmOverride: number | null;
  }>({
    category: 'All',
    priceRange: 'all',
    minRating: 0,
    sortBy: 'nearest',
    timeFilter: 'all',
    radiusKmOverride: null,
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category && filters.category !== 'All') count++;
    if (filters.priceRange && filters.priceRange !== 'all') count++;
    if (filters.minRating && filters.minRating > 0) count++;
    if (filters.sortBy && filters.sortBy !== 'nearest') count++;
    if (filters.radiusKmOverride !== null && filters.radiusKmOverride !== undefined) count++;
    return count;
  }, [filters]);

  const {
    salons,
    venues,
    loading,
    loadError,
    query,
    setQuery,
    selectedSport,
    setSelectedSport,
    favorites,
    toggleFavorite,
    fetchVenues,
  } = useCustomerVenues({
    userLocation,
    userCoords,
    isAutoDetectActive,
    radiusKm,
    filters,
  });

  const dynamicCategories = useMemo(() => {
    const customSet = new Set<string>();
    salons.forEach((s) => {
      if (!s.category) return;
      const cat = s.category.trim();
      const lower = cat.toLowerCase();
      if (lower !== 'turf' && lower !== 'salon' && lower !== 'sports arena' && lower !== 'all') {
        customSet.add(cat.charAt(0).toUpperCase() + cat.slice(1));
      }
    });
    return ['All', 'Turf', 'Salon', ...Array.from(customSet)];
  }, [salons]);

  const popularCities = useMemo(() => {
    const set = new Set<string>();
    salons.forEach((s) => {
      if (s.city) set.add(s.city.trim());
    });
    ['Pune', 'Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai'].forEach((c) => set.add(c));
    return Array.from(set).slice(0, 10);
  }, [salons]);

  const {
    selectedVenue,
    setSelectedVenue,
    bookingStep,
    setBookingStep,
    bookingDraft,
    setBookingDraft,
    createdBooking,
    setCreatedBooking,
  } = useBookingFlow();

  const [isPersonalizedModalOpen, setIsPersonalizedModalOpen] = useState(false);

  // Extract unique locations from all salons for auto-suggest
  const suggestedLocations = useMemo(() => {
    const locs = new Set<string>();
    salons.forEach((s) => {
      if (s.city) locs.add(s.city.trim());
    });
    const all = Array.from(locs);
    if (!locationSearch) return all;
    return all.filter((l) => l.toLowerCase().includes(locationSearch.toLowerCase()));
  }, [salons, locationSearch]);

  const handleGetCurrentLocation = useCallback(() => {
    rawHandleGetCurrentLocation(suggestedLocations[0]);
  }, [rawHandleGetCurrentLocation, suggestedLocations]);

  useEffect(() => {
  const handleVenueClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const card = target.closest('.customer-venue-card');
      if (!card || target.closest('button')) return;
      const name = card.querySelector('h3')?.textContent;
      const venue = venues.find((item) => item.name === name);
      if (venue) setSelectedVenue(venue);
    };
    document.addEventListener('click', handleVenueClick);
    return () => document.removeEventListener('click', handleVenueClick);
  }, [venues]);

  useEffect(() => {
    const handleLogoutClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.customer-profile-menu .is-danger') || target.closest('[aria-label="Sign out"]')) onLogout();
    };
    document.addEventListener('click', handleLogoutClick);
    return () => document.removeEventListener('click', handleLogoutClick);
  }, [onLogout]);

  useQbiScreen(selectedVenue || isPersonalizedModalOpen ? null : (activeTab === 'turf' ? 'turf' : activeTab === 'home' ? 'home' : null));

  if (selectedVenue) {
    return (
      <div className="w-full min-h-[100dvh] bg-[#F0F0F2] flex justify-center">
        <div className="w-full max-w-[480px] bg-white min-h-[100dvh] relative shadow-sm">
          {bookingStep === 'slot' && <SlotSelectionView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('detail')} onContinue={(draft) => { setBookingDraft(draft); setBookingStep('summary'); }} />}
          {bookingStep === 'summary' && <BookingSummaryView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('slot')} onContinue={(chosenPaymentType) => { const pType = chosenPaymentType || 'FULL'; setBookingDraft({ ...bookingDraft, paymentType: pType, advanceAmount: pType === 'ADVANCE' ? (bookingDraft.advanceAmount || Math.floor((bookingDraft.price || 1600) * 0.2)) : 0 }); setBookingStep('payment'); }} />}
          {bookingStep === 'payment' && <PaymentView venue={selectedVenue} user={user} draft={bookingDraft} onBack={() => setBookingStep('summary')} onPaid={(booking) => { setCreatedBooking(booking); setBookingStep('paid'); window.setTimeout(() => setBookingStep('ticket'), 2500); }} />}
          {bookingStep === 'paid' && <PaidView />}
          {bookingStep === 'ticket' && <TicketView venue={selectedVenue} user={user} booking={createdBooking} draft={bookingDraft} onHome={() => { setSelectedVenue(null); setBookingStep('detail'); }} />}
          {bookingStep === 'detail' && <TurfDetailView venue={selectedVenue} onBack={() => setSelectedVenue(null)} onProceed={() => setBookingStep('slot')} />}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-[#F0F0F2] flex justify-center transition-colors">
      <main className="w-full max-w-[480px] bg-[#F8F8F9] text-[#111111] min-h-[100dvh] pb-[calc(8rem+env(safe-area-inset-bottom,0px))] font-sans relative shadow-sm transition-colors" aria-label="Customer home">
        
        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <div className="flex flex-col w-full relative">
            {/* Header Area: Tone Step, sticky, safe-area-inset-top */}
            <div
              className="sticky top-0 z-40 px-4 pb-3 w-full bg-white border-b border-[#F0F0F2]"
              style={{
                paddingTop: 'max(14px, env(safe-area-inset-top, 14px))',
              }}
            >
              {/* Row 1: Logo + Notifications Bell */}
              <header className="flex justify-between items-center mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-[#E73229] rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
                    <svg width="20" height="20" viewBox="0 0 280 280" fill="currentColor" role="img" aria-label="QGo Logo">
                      <path
                        fillRule="evenodd"
                        d="M206.17,268.40C199.35,265.00 197.67,262.56 189.03,243.50C185.04,234.70 179.18,221.88 176.01,215.00C165.22,191.58 164.00,188.37 164.00,183.45C164.00,169.27 173.12,160.02 187.13,160.01C192.25,160.00 191.64,159.77 219.00,171.75C229.73,176.44 245.02,183.13 253.00,186.62C269.59,193.87 272.98,196.70 275.51,205.38C277.17,211.11 276.86,215.72 274.42,221.50C272.34,226.39 231.86,266.10 226.26,268.74C219.67,271.83 212.83,271.72 206.17,268.40ZM115.50,265.40C89.09,260.44 62.23,245.63 43.22,225.55C8.68,189.06 -1.42,137.47 16.96,91.41C51.41,5.11 163.48,-19.84 231.08,43.75C256.48,67.65 271.98,103.21 272.00,137.62C272.00,151.97 268.24,173.00 265.67,173.00C264.99,173.00 254.11,168.39 241.51,162.75L218.60,152.50L218.44,138.50C218.26,123.62 217.07,117.85 211.71,105.83C201.96,83.99 179.77,66.12 156.20,61.12C149.37,59.68 130.63,59.68 123.80,61.12C96.06,67.01 73.24,87.73 64.46,115.00C60.64,126.87 60.35,145.53 63.80,157.44C70.27,179.80 85.38,197.66 106.08,207.44C118.56,213.34 124.53,214.51 141.65,214.43L156.80,214.36L158.88,218.93C160.01,221.44 164.75,231.83 169.40,242.00C174.06,252.19 177.48,260.89 177.01,261.37C172.65,265.84 132.05,268.50 115.50,265.40Z"
                      />
                    </svg>
                  </div>
                  <span className="text-[20px] font-bold text-[#0A0A0A] tracking-tight">QGo</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="relative p-2 rounded-full hover:bg-[#F0F0F2] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                    onClick={onOpenNotifications}
                    aria-label="Notifications"
                    title="Notifications"
                  >
                    <Bell size={20} className="text-[#0A0A0A]" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#E73229] rounded-full" />
                  </button>
                </div>
              </header>

              {/* Row 2: Location selector on left + subtle GPS Active badge on right */}
              <div className="flex justify-between items-center mb-2.5">
                <div className="flex flex-col">
                  <p className="text-[11px] font-bold text-[#767676] tracking-wider mb-0.5 uppercase">Your Location</p>
                  <button 
                    type="button"
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all active:scale-[0.98] min-h-[40px] text-left p-0 bg-transparent border-0"
                    onClick={() => {
                      haptics.selection();
                      setIsLocationModalOpen(true);
                    }}
                    aria-label={`Current location: ${userLocation}. Tap to change.`}
                  >
                    <MapPin size={16} className="text-[#E73229] shrink-0" />
                    <h2 className="text-[17px] font-bold text-[#0A0A0A] tracking-tight truncate max-w-[210px] sm:max-w-[260px]">{userLocation}</h2>
                    <ChevronDown size={14} className="text-[#767676] mt-0.5 shrink-0" />
                  </button>
                </div>
                {isAutoDetectActive && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700 shrink-0 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>GPS Active ({radiusKm} km)</span>
                  </div>
                )}
              </div>

              {/* Row 3: Search field + Filter button with equal heights (44px) */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#767676] pointer-events-none" />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search venues, sports..." 
                    className="w-full h-[44px] bg-[#F0F0F2] rounded-xl pl-10 pr-4 text-[13px] font-medium text-[#0A0A0A] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#E73229] transition-all duration-150 placeholder:text-[#767676]"
                    aria-label="Search venues and sports"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    setIsFilterModalOpen(true);
                  }}
                  className="w-[44px] h-[44px] bg-[#F0F0F2] hover:bg-[#EAEAEA] rounded-xl flex items-center justify-center text-[#0A0A0A] transition-all active:scale-[0.96] shrink-0 cursor-pointer relative"
                  aria-label="Filters"
                >
                  <SlidersHorizontal size={18} strokeWidth={2} />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#E73229] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Available Venues Section */}
            <div className="px-5 mb-6 mt-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A] tracking-tight">Available Venues</h2>
                </div>
              </div>
              
              {/* Radius Pills (Active when Auto Detect is ON) */}
              {isAutoDetectActive && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 pt-1 select-none">
                  <span className="text-xs font-semibold text-[#5C5C5C] shrink-0 flex items-center gap-1">
                    <Compass size={13} className="text-[#E73229]" />
                    Radius:
                  </span>
                  {[5, 10, 15, 25].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadiusKm(r)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        radiusKm === r
                          ? 'bg-[#E73229] text-white shadow-sm'
                          : 'bg-[#F0F0F2] text-[#5C5C5C] hover:bg-[#EAEAEA]'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              )}

              {/* Dynamic Category Chips */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 pt-1 snap-x select-none">
                {dynamicCategories.map((cat) => {
                  const isSelected =
                    cat === 'All'
                      ? (!filters.category || filters.category === 'All') && (selectedSport === 'All' || selectedSport === 'All Sports')
                      : (filters.category || selectedSport || '').toLowerCase() === cat.toLowerCase();

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        haptics.selection();
                        setSelectedSport(cat);
                        setFilters((prev) => ({ ...prev, category: cat }));
                      }}
                      className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold min-h-[40px] snap-start transition-all active:scale-[0.97] cursor-pointer ${
                        isSelected
                          ? 'bg-[#E73229] text-white shadow-sm shadow-[#E73229]/20'
                          : 'bg-[#F0F0F2] text-[#5C5C5C] hover:bg-[#EAEAEA]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Venues List: Distinct Loading, Error, and Empty states */}
              <div className="flex flex-col gap-4 mt-2">
                {/* State 1: Loader on initial load */}
                {loading && venues.length === 0 && (
                  <QGoLoader variant="container" minHeight="280px" text="Locating sports turfs near you…" />
                )}

                {/* State 2: Error state */}
                {!loading && loadError && (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-2xl border border-[#F0F0F2]">
                    <Qbi mood="oops" size={72} animate={false} />
                    <h3 className="text-base font-bold text-[#0A0A0A] mt-3 tracking-tight">
                      Unable to load venues
                    </h3>
                    <p className="text-xs text-[#5C5C5C] mt-1 max-w-xs leading-relaxed">
                      Please check your connection and try again.
                    </p>
                    <button
                      type="button"
                      onClick={fetchVenues}
                      className="mt-4 px-5 py-2.5 rounded-full bg-[#E73229] hover:bg-[#D42B22] text-white text-xs font-bold min-h-[44px] transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* State 3: Empty state with Qbi mascot illustration & clear CTAs */}
                {!loading && !loadError && venues.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-white rounded-2xl border border-[#F0F0F2]">
                    <Qbi mood="waiting" size={72} animate={false} />
                    <h3 className="text-base font-bold text-[#0A0A0A] mt-3 tracking-tight">
                      No venues found
                    </h3>
                    <p className="text-xs text-[#5C5C5C] mt-1 max-w-xs leading-relaxed">
                      {isAutoDetectActive
                        ? `No turfs or salons found within ${radiusKm} km of ${userLocation || 'your location'}.`
                        : query
                        ? `No venues matched "${query}".`
                        : "No venues match the selected filters or location."}
                    </p>
                    <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                      {isAutoDetectActive && radiusKm < 25 && (
                        <button
                          type="button"
                          onClick={() => setRadiusKm(25)}
                          className="px-4 py-2 rounded-full bg-[#E73229] text-white text-xs font-bold min-h-[44px] hover:bg-[#D42B22] transition-colors cursor-pointer"
                        >
                          Expand to 25 km
                        </button>
                      )}
                      {(query || selectedSport !== 'All') && (
                        <button
                          type="button"
                          onClick={() => { setQuery(''); setSelectedSport('All'); }}
                          className="px-4 py-2 rounded-full bg-[#E73229] text-white text-xs font-bold min-h-[44px] hover:bg-[#D42B22] transition-colors cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="px-4 py-2 rounded-full bg-[#F0F0F2] text-[#0A0A0A] text-xs font-bold min-h-[44px] hover:bg-[#EAEAEA] transition-colors cursor-pointer"
                      >
                        Change location
                      </button>
                    </div>
                  </div>
                )}

                {/* State 4: Venue cards */}
                {!loading && !loadError && venues.map((venue) => (
                <article
                  key={venue.name}
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-[rgba(10,10,10,0.10)] hover:border-[#E73229]/40 hover:shadow-md cursor-pointer transition-all duration-150"
                  onClick={() => setSelectedVenue(venue)}
                >
                  <div className="flex justify-between items-start mb-2.5 px-0.5">
                    <div>
                      <h3 className="font-bold text-[#0A0A0A] text-[17px] tracking-tight leading-snug mb-1">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={13} className="text-[#E73229] mt-[2px] shrink-0" />
                        <p className="text-[11px] text-[#5C5C5C] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {venue.distance && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[11px] font-bold text-[#B3231B] bg-[#FDECEA] px-2 py-0.5 rounded-full tracking-wider">{venue.distance}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-[#FDECEA] px-2.5 py-1 rounded-full shrink-0 border border-[#F39887]/30">
                      <Star size={12} className="fill-[#E73229] text-[#E73229]" />
                      <span className="text-[11px] font-bold text-[#0A0A0A]">4.5</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[155px] rounded-xl overflow-hidden mb-3 shadow-inner">
                    <img src={venue.image || DEFAULT_TURF_PHOTO} alt={venue.name} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-500" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-[#F7F7F7] transition-colors" onClick={(e) => { e.stopPropagation(); toggleFavorite(venue.name); }}>
                      <Heart size={16} strokeWidth={2.5} className={favorites.includes(venue.name) ? "fill-[#E73229] text-[#E73229]" : "text-[#5C5C5C]"} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-0.5 pt-1 border-t border-[rgba(10,10,10,0.06)]">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5C5C5C] uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-[#CFCFCF]">•</span> Turf
                    </div>
                    <div className="flex items-center gap-2 text-[#0A0A0A]">
                      <span className="text-xs font-bold text-white bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] px-3.5 py-1.5 rounded-full flex items-center gap-1 hover:opacity-95 shadow-sm transition-opacity">
                        Book Slot →
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- OTHER TABS --- */}
      {activeTab === 'turf' && (
        <div className="px-5 pt-8 flex flex-col w-full min-h-[80vh]">
          <h2 className="text-[22px] font-black text-[#0A0A0A] tracking-tight mb-4">All Turfs</h2>
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C5C5C]" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search venues, sports..." 
              className="w-full bg-[#F7F7F7] rounded-[14px] py-3.5 pl-11 pr-4 text-[13px] font-medium text-[#0A0A0A] shadow-sm border border-[rgba(10,10,10,0.10)] focus:outline-none focus:border-[#E73229] placeholder:text-[#767676]"
            />
          </div>
          
          {isAutoDetectActive && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 select-none">
              <span className="text-xs font-semibold text-[#5C5C5C] shrink-0 flex items-center gap-1">
                <Compass size={13} className="text-[#E73229]" />
                Radius:
              </span>
              {[5, 10, 15, 25].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRadiusKm(r)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    radiusKm === r
                      ? 'bg-[#E73229] text-white shadow-sm'
                      : 'bg-[#F0F0F2] text-[#5C5C5C] hover:bg-[#EAEAEA]'
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-4 snap-x select-none">
            {dynamicCategories.map((cat) => {
              const isSelected =
                cat === 'All'
                  ? (!filters.category || filters.category === 'All') && (selectedSport === 'All' || selectedSport === 'All Sports')
                  : (filters.category || selectedSport || '').toLowerCase() === cat.toLowerCase();

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    setSelectedSport(cat);
                    setFilters((prev) => ({ ...prev, category: cat }));
                  }}
                  className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-all active:scale-[0.97] border ${
                    isSelected
                      ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white border-[#E73229]'
                      : 'bg-[#FFFFFF] text-[#5C5C5C] border-[rgba(10,10,10,0.10)] hover:bg-[#F7F7F7]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          
          <div className="flex flex-col gap-4 mt-2">
            {loading && venues.length === 0 && (
              <QGoLoader variant="container" minHeight="200px" text="Finding nearby venues…" />
            )}
            {!loading && venues.length === 0 && (
              <p className="text-center py-8 text-[#5C5C5C] font-bold text-sm">
                {isAutoDetectActive
                  ? `No venues found within ${radiusKm} km of your current location.`
                  : 'No venues match your search.'}
              </p>
            )}
            {venues.map((venue) => (
              <article key={venue.name} className="bg-[#FFFFFF] rounded-2xl p-4 shadow-sm border border-[rgba(10,10,10,0.10)] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedVenue(venue)}>
                  <div className="flex justify-between items-start mb-2.5 px-1">
                    <div>
                      <h3 className="font-bold text-[#0A0A0A] text-[17px] tracking-tight leading-snug mb-1">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-[#E73229] mt-[2px] shrink-0" />
                        <p className="text-[11px] text-[#5C5C5C] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {venue.distance && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[11px] font-bold text-[#B3231B] bg-[#FDECEA] px-2 py-0.5 rounded-full tracking-wider">{venue.distance}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-[#FDECEA] px-2.5 py-1 rounded-full shrink-0 border border-[#F39887]/30">
                      <Star size={12} className="fill-[#E73229] text-[#E73229]" />
                      <span className="text-[11px] font-bold text-[#0A0A0A]">4.0</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3">
                    <img src={venue.image || DEFAULT_TURF_PHOTO} alt={venue.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-[#FFFFFF] rounded-full flex items-center justify-center text-[#5C5C5C] shadow-md hover:bg-[#F7F7F7] transition-colors" onClick={(e) => { e.stopPropagation(); toggleFavorite(venue.name); }}>
                      <Heart size={16} strokeWidth={2.5} className={favorites.includes(venue.name) ? "fill-[#E73229] text-[#E73229]" : "text-[#5C5C5C]"} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5C5C5C] uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-[#CFCFCF]">•</span> Turf
                    </div>
                    <span className="text-xs font-bold text-white bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] px-3.5 py-1.5 rounded-full flex items-center gap-1 hover:opacity-95 shadow-sm transition-opacity">
                      Book Slot →
                    </span>
                  </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'booking' && <BookingView onViewTicket={(b) => {
        setSelectedVenue({ id: b.salonId, name: b.salonName, address: '', image: DEFAULT_TURF_PHOTO, sports: 'Turf' });
        setBookingDraft({ date: b.scheduledDate, startTime: b.scheduledTime, endTime: b.slotEndTime, format: b.serviceName || 'Booking', pitches: 1, players: b.numberOfPlayers || 10, price: b.totalAmount || b.price });
        setCreatedBooking(b);
        setBookingStep('ticket');
      }} />}
      {activeTab === 'profile' && (
        <ProfileView
          onLogout={onLogout}
          onNavigateTab={(tab) => {
            setActiveTab(tab as any);
          }}
        />
      )}
      {activeTab === 'favorites' && <FavoritesView venues={venues} favorites={favorites} onToggleFavorite={toggleFavorite} onSelectVenue={setSelectedVenue} />}

      <LiquidBottomNav
        activeTab={activeTab}
        onTabChange={(tab: CustomerTabKey) => {
          if (tab !== 'add') {
            setActiveTab(tab);
          }
          if (tab === 'home' || tab === 'turf') {
            setSelectedSport('All Sports');
          }
        }}
        onPlusClick={() => setIsPersonalizedModalOpen(true)}
        visible={true}
        labels={{ home: t.home, booking: t.bookingsTab || t.myBookings || 'Bookings', add: t.book || 'Book', favorites: t.favorites || 'Favorites', profile: t.profile }}
      />

      {/* --- PERSONALIZED TURF HUB (CENTER PLUS BUTTON MODAL) --- */}
      {isPersonalizedModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/60 backdrop-blur-[2px] animate-in fade-in select-none"
          onClick={() => setIsPersonalizedModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Personalized Turf Hub"
        >
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-t-[1.75rem] px-4 sm:px-5 pt-3.5 pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom,20px)))] sm:pb-28 shadow-2xl border-t border-[rgba(10,10,10,0.10)] flex flex-col animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mb-3 shrink-0" />

            {/* Header: Badge, Title & Close Button */}
            <div className="flex items-start justify-between gap-2.5 mb-1.5">
              <div className="min-w-0 flex-1">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#B3231B] bg-[#FDECEA] px-2 py-0.5 rounded-full border border-[#F39887]/30">
                  Quick Actions
                </span>
                <h3 className="text-[19px] sm:text-xl font-bold text-[#0A0A0A] tracking-tight mt-1 leading-snug truncate">
                  Personalized Turf Hub
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPersonalizedModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F0F0F2] hover:bg-[#E5E5EA] flex items-center justify-center text-[#5C5C5C] hover:text-[#0A0A0A] font-bold text-xs transition-colors cursor-pointer shrink-0 mt-0.5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-[11.5px] sm:text-xs text-[#5C5C5C] mb-3.5 font-medium leading-relaxed">
              Book a slot instantly, discover grounds, or view saved venues in one tap.
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Quick Book Turf */}
              <button
                type="button"
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  if (venues.length > 0) {
                    setSelectedVenue(venues[0]);
                    setBookingStep('slot');
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white text-left shadow-md transition-opacity duration-150 hover:opacity-95 cursor-pointer active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                  <Ticket size={19} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[13.5px] text-white leading-tight">Quick Book Turf Slot</h4>
                  <p className="text-[11px] font-medium text-white/85 truncate mt-0.5">
                    Instant slot at {venues[0]?.name || 'top venue'}
                  </p>
                </div>
                <ArrowRight size={17} className="text-white shrink-0" />
              </button>

              {/* Option 2: Explore & Add All Turfs */}
              <button
                type="button"
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  setActiveTab('turf');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F7F7F7] text-[#0A0A0A] border border-[rgba(10,10,10,0.10)] text-left shadow-xs transition-colors duration-150 cursor-pointer active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#FDECEA] text-[#E73229] flex items-center justify-center shrink-0 border border-[#F39887]/30">
                  <Search size={19} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[13.5px] text-[#0A0A0A] leading-tight">Browse & Add Turfs</h4>
                  <p className="text-[11px] text-[#5C5C5C] font-medium leading-tight mt-0.5">
                    Filter by sport, location & ratings
                  </p>
                </div>
                <ChevronRight size={17} className="text-[#5C5C5C] shrink-0" />
              </button>

              {/* Option 3: Pin Favorite / Set Home Turf */}
              <button
                type="button"
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  setActiveTab('favorites');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-[#F7F7F7] text-[#0A0A0A] border border-[rgba(10,10,10,0.10)] text-left shadow-xs transition-colors duration-150 cursor-pointer active:scale-[0.99]"
              >
                <div className="w-9 h-9 rounded-xl bg-[#FDECEA] text-[#E73229] flex items-center justify-center shrink-0 border border-[#F39887]/30">
                  <Heart size={19} strokeWidth={2.5} className="fill-[#E73229] text-[#E73229]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[13.5px] text-[#0A0A0A] leading-tight">My Pinned & Saved Turfs</h4>
                  <p className="text-[11px] text-[#5C5C5C] font-medium leading-tight mt-0.5">
                    {favorites.length} saved venue{favorites.length !== 1 ? 's' : ''} in your collection
                  </p>
                </div>
                <ChevronRight size={17} className="text-[#5C5C5C] shrink-0" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- LOCATION SELECTOR MODAL --- */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[rgba(10,10,10,0.50)] p-4 pt-20 animate-in fade-in">
          <div className="flex-1 bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 relative">
            <div className="p-4 border-b border-[rgba(10,10,10,0.10)] flex items-center justify-between z-10 bg-[#FFFFFF]">
              <div className="flex items-center gap-2">
                {isMapView && (
                  <button onClick={() => setIsMapView(false)} className="p-2 -ml-2 rounded-full hover:bg-[rgba(10,10,10,0.05)] text-[#5C5C5C]">
                    <ArrowLeft size={18} strokeWidth={2.5} />
                  </button>
                )}
                <h3 className="font-bold text-[#0A0A0A]">{isMapView ? 'Select on Map' : 'Select Location'}</h3>
              </div>
              <button onClick={() => { setIsLocationModalOpen(false); setIsMapView(false); }} className="p-2 rounded-full bg-[#EFEFEF] hover:bg-[#E2E2E2] text-[#0A0A0A]">
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>
            
            {isMapView ? (
              <div className="flex-1 relative flex flex-col bg-[#FFFFFF]">
                <div className="absolute inset-0 z-0">
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80" alt="Map" loading="lazy" decoding="async" className="w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 bg-[#FDECEA]/40 mix-blend-color"></div>
                </div>
                
                {/* Center Pin */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
                  <div className="bg-[#FFFFFF] text-[#0A0A0A] text-xs font-bold px-3 py-1.5 rounded-full mb-1 shadow-md border border-[rgba(10,10,10,0.10)]">
                    Move map to adjust
                  </div>
                  <MapPin size={40} className="text-[#E73229] drop-shadow-md -mt-2 fill-white" />
                </div>

                <div className="mt-auto p-4 z-10 bg-[#FFFFFF] rounded-t-3xl shadow-[0_-10px_40px_rgba(10,10,10,0.10)] border-t border-[rgba(10,10,10,0.10)]">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#FDECEA] flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-[#E73229]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#0A0A0A] text-sm">Selected Location</h4>
                      <p className="text-xs text-[#5C5C5C] font-medium">Pin drop location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      selectManualLocation('Map Selection');
                      setIsLocationModalOpen(false);
                      setIsMapView(false);
                    }}
                    className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] p-3.5 rounded-xl font-bold transition-all shadow-[0_4px_16px_rgba(231,50,41,0.25)] hover:opacity-95"
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-[rgba(10,10,10,0.10)]">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C5C5C]" />
                    <input
                      type="text"
                      placeholder="Search city, area, or landmark..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-[rgba(10,10,10,0.10)] bg-[#FFFFFF] text-sm font-semibold text-[#0A0A0A] placeholder-[#767676] focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Action Card 1: GPS Auto Detect */}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.selection();
                      handleGetCurrentLocation();
                      setIsLocationModalOpen(false);
                    }}
                    disabled={isLocating}
                    className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-linear-to-r from-red-50 to-orange-50/50 border border-[#E73229]/20 hover:border-[#E73229]/50 transition-all active:scale-[0.98] text-left cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#E73229] text-white flex items-center justify-center shrink-0 shadow-sm relative">
                      <Crosshair size={22} className={isLocating ? "animate-spin" : "animate-pulse"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[14px] text-[#0A0A0A]">Use Current Location (GPS)</h4>
                        {isAutoDetectActive && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5C5C5C] font-medium leading-tight mt-0.5">
                        Detect nearest venues within {radiusKm} km radius using GPS
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-[#E73229] shrink-0" />
                  </button>

                  {/* Action Card 2: All Locations */}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.selection();
                      selectManualLocation('All Locations');
                      setIsLocationModalOpen(false);
                    }}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all active:scale-[0.98] text-left cursor-pointer ${
                      userLocation === 'All Locations'
                        ? 'bg-[#FDECEA] border-[#E73229] text-[#B3231B]'
                        : 'bg-white border-[rgba(10,10,10,0.10)] hover:bg-[#F7F7F7] text-[#0A0A0A]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-[rgba(10,10,10,0.08)] flex items-center justify-center shrink-0 shadow-2xs">
                      <Globe2 size={22} className={userLocation === 'All Locations' ? 'text-[#E73229]' : 'text-[#5C5C5C]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[14px]">All Locations (Browse Everywhere)</h4>
                      <p className="text-xs text-[#5C5C5C] font-medium leading-tight mt-0.5">
                        Explore all venues across India with zero radius filtering
                      </p>
                    </div>
                    {userLocation === 'All Locations' && <Check size={18} className="text-[#E73229] shrink-0" />}
                  </button>

                  {/* Popular Cities Pills */}
                  {popularCities.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs font-bold text-[#767676] uppercase tracking-wider mb-2">Popular Cities</p>
                      <div className="flex flex-wrap gap-2">
                        {popularCities.map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              haptics.selection();
                              selectManualLocation(city);
                              setIsLocationModalOpen(false);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-[0.96] cursor-pointer ${
                              userLocation.toLowerCase() === city.toLowerCase()
                                ? 'bg-[#E73229] text-white shadow-xs'
                                : 'bg-[#F0F0F2] text-[#5C5C5C] hover:bg-[#EAEAEA]'
                            }`}
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Registered Cities & Areas */}
                  <div className="pt-2">
                    <p className="text-xs font-bold text-[#767676] uppercase tracking-wider mb-2">
                      Registered Areas & Venues
                    </p>
                    <div className="space-y-1.5">
                      {suggestedLocations.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            haptics.selection();
                            selectManualLocation(loc);
                            setIsLocationModalOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                            userLocation === loc ? 'bg-[#FDECEA] text-[#B3231B]' : 'hover:bg-[#F7F7F7] text-[#0A0A0A]'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-white border border-[rgba(10,10,10,0.08)] flex items-center justify-center shrink-0">
                            <MapPin size={16} className={userLocation === loc ? 'text-[#E73229]' : 'text-[#5C5C5C]'} />
                          </div>
                          <span className="text-left font-bold text-sm flex-1 truncate">{loc}</span>
                          {userLocation === loc && <Check size={16} className="text-[#E73229] shrink-0" />}
                        </button>
                      ))}

                      {suggestedLocations.length === 0 && (
                        <div className="p-6 text-center text-[#5C5C5C]">
                          <MapPin size={24} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm font-semibold">No areas found matching "{locationSearch}"</p>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.selection();
                              selectManualLocation(locationSearch);
                              setIsLocationModalOpen(false);
                            }}
                            className="mt-3 px-4 py-2 rounded-xl bg-[#EFEFEF] text-[#0A0A0A] text-xs font-bold hover:bg-[#E2E2E2]"
                          >
                            Search specifically for "{locationSearch}"
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location Error Notice */}
                  {locationError && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-600 shrink-0" />
                      <span>{locationError}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- DEDICATED FILTER & DISCOVERY MODAL --- */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center bg-[rgba(10,10,10,0.60)] backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl relative animate-in slide-in-from-bottom-10 border border-zinc-200 mx-auto overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[#E73229]" />
                <h3 className="font-bold text-[17px] text-[#0A0A0A]">Filter & Discover</h3>
                {activeFiltersCount > 0 && (
                  <span className="text-[10px] font-black bg-[#E73229] text-white px-2 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    setFilters({
                      category: 'All',
                      priceRange: 'all',
                      minRating: 0,
                      sortBy: 'nearest',
                      timeFilter: 'all',
                      radiusKmOverride: null,
                    });
                    setSelectedSport('All');
                  }}
                  className="text-xs font-semibold text-zinc-500 hover:text-[#E73229] transition-colors px-2 py-1"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-2 rounded-full bg-[#EFEFEF] hover:bg-[#E2E2E2] text-[#0A0A0A] transition-colors cursor-pointer"
                  aria-label="Close filters"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {dynamicCategories.map((cat) => {
                    const isSelected = (filters.category || 'All').toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, category: cat }));
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Distance Radius */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Distance Radius {isAutoDetectActive ? '(GPS Active)' : ''}
                  </label>
                  <span className="text-xs font-bold text-[#E73229]">
                    {filters.radiusKmOverride === null || filters.radiusKmOverride === 0 ? 'Any Distance' : `${filters.radiusKmOverride} km`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '5 km', value: 5 },
                    { label: '10 km', value: 10 },
                    { label: '15 km', value: 15 },
                    { label: '25 km', value: 25 },
                    { label: 'Any Distance', value: null },
                  ].map((rad) => {
                    const isSelected = filters.radiusKmOverride === rad.value;
                    return (
                      <button
                        key={rad.label}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, radiusKmOverride: rad.value }));
                          if (rad.value) setRadiusKm(rad.value);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {rad.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Price Range
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'All Prices', value: 'all' as const },
                    { label: 'Under ₹500', value: 'under_500' as const },
                    { label: '₹500 – ₹1,000', value: '500_1000' as const },
                    { label: '₹1,000+', value: '1000_plus' as const },
                  ].map((p) => {
                    const isSelected = filters.priceRange === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, priceRange: p.value }));
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minimum Rating */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Minimum Rating
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'All Ratings', value: 0 },
                    { label: '4.0+ ★', value: 4.0 },
                    { label: '4.5+ ★', value: 4.5 },
                  ].map((r) => {
                    const isSelected = filters.minRating === r.value;
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, minRating: r.value }));
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot Availability / Time of Day */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Slot Availability / Time of Day
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'All Day', value: 'all' as const },
                    { label: 'Morning (6 AM - 12 PM)', value: 'morning' as const },
                    { label: 'Evening (4 PM - 10 PM)', value: 'evening' as const },
                  ].map((t) => {
                    const isSelected = filters.timeFilter === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, timeFilter: t.value }));
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">
                  Sort By
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Nearest First', value: 'nearest' as const },
                    { label: 'Highest Rated', value: 'rating' as const },
                    { label: 'Price: Low to High', value: 'price_asc' as const },
                  ].map((s) => {
                    const isSelected = filters.sortBy === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          haptics.selection();
                          setFilters((prev) => ({ ...prev, sortBy: s.value }));
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                          isSelected
                            ? 'bg-[#E73229] text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-zinc-100 bg-white flex items-center gap-3 sticky bottom-0">
              <button
                type="button"
                onClick={() => {
                  haptics.selection();
                  setFilters({
                    category: 'All',
                    priceRange: 'all',
                    minRating: 0,
                    sortBy: 'nearest',
                    timeFilter: 'all',
                    radiusKmOverride: null,
                  });
                  setSelectedSport('All');
                }}
                className="w-1/3 py-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.success();
                  setIsFilterModalOpen(false);
                }}
                className="w-2/3 py-3 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white text-xs font-bold shadow-md shadow-[#E73229]/25 hover:opacity-95 transition-all active:scale-[0.98] cursor-pointer"
              >
                Show Matching Venues ({venues.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}

function TurfDetailView({ venue, onBack, onProceed }: { venue: { id: string; name: string; address: string; image: string; sports: string }; onBack: () => void; onProceed: () => void }) {
  useQbiScreen('detail');
  const [details, setDetails] = useState<any>(null);
  useEffect(() => { api.getSalonDetail(venue.id).then(setDetails).catch(() => undefined); }, [venue.id]);
  useEffect(() => {
    const handleVenueAction = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('.customer-turf-actions button') as HTMLButtonElement | null;
      if (!button) return;
      const salon = details?.salon;
      if (button.getAttribute('aria-label') === 'Call venue') {
        const phone = salon?.phone || salon?.contactPhone || salon?.contact?.phone;
        if (phone) window.location.href = `tel:${phone}`;
        else window.alert('This venue has not published a phone number yet.');
        return;
      }
      const destination = encodeURIComponent([salon?.address, salon?.city, venue.address].filter(Boolean).join(', '));
      window.open(`https://www.google.com/maps/search/?api=1&query=${destination}`, '_blank', 'noopener,noreferrer');
    };
    document.addEventListener('click', handleVenueAction);
    return () => document.removeEventListener('click', handleVenueAction);
  }, [details, venue.address]);
  const salon = details?.salon;
  const name = salon?.name || venue.name;
  const address = salon ? [salon.address, salon.city].filter(Boolean).join(', ') : venue.address;
  const sports = salon?.resources?.map((resource: any) => resource.name).join(', ') || venue.sports;
  return (
    <main className="bg-[#FFFFFF] min-h-[100dvh] pb-32 relative animate-in fade-in" aria-label={`${name} details`}>
      {/* Hero Image */}
      <div className="relative h-[22vh] min-h-[160px] w-full">
        {(salon?.coverUrl || venue.image) ? (
          <img src={salon?.coverUrl || venue.image || DEFAULT_TURF_PHOTO} alt={`${name} turf`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[linear-gradient(160deg,#F0554A_0%,#E73229_45%,#C0241D_100%)] relative overflow-hidden" aria-label="No venue image available">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0px,rgba(255,255,255,0.08)_8px,transparent_8px,transparent_16px)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.65)] to-transparent"></div>
        <button type="button" className="absolute top-4 left-4 w-[44px] h-[44px] bg-[rgba(255,255,255,0.90)] backdrop-blur-md rounded-full flex items-center justify-center text-[#0A0A0A] shadow-md border border-[rgba(255,255,255,0.65)] z-10" onClick={onBack} aria-label="Back to venues">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <button type="button" className="absolute top-4 right-4 w-[44px] h-[44px] bg-[rgba(255,255,255,0.90)] backdrop-blur-md rounded-full flex items-center justify-center text-[#0A0A0A] shadow-md border border-[rgba(255,255,255,0.65)] z-10" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div className="absolute bottom-4 right-4 flex gap-1 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm"></div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-[#FFFFFF] rounded-t-[1.5rem] -mt-5 relative z-20 px-4 pt-4 pb-20 shadow-md flex flex-col gap-3">
        <div>
          <div className="flex justify-between items-start">
            <h1 className="text-[22px] leading-tight font-black text-[#0A0A0A] uppercase">{name}</h1>
            <Heart size={20} className="text-[#E73229]" />
          </div>
          <div className="flex items-start gap-1.5 mt-1">
            <MapPin size={14} className="text-[#E73229] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#5C5C5C] leading-tight line-clamp-2">{address}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Star size={14} className="fill-[#E73229] text-[#E73229]" />
            <span className="font-bold text-[#0A0A0A] text-sm">{salon?.reviewCount ? salon.rating : 'New'}</span>
            <span className="text-[#5C5C5C] text-[11px]">[{salon?.reviewCount || 0}]</span>
          </div>
        </div>

        <div className="flex gap-2.5 customer-turf-actions">
          <button type="button" className="bg-[#FFFFFF] text-[#0A0A0A] border border-[rgba(10,10,10,0.20)] hover:bg-[#F7F7F7] px-5 py-2.5 rounded-[10px] font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-[13px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Get Direction
          </button>
          <button type="button" className="w-[42px] h-[42px] shrink-0 bg-[#0A0A0A] hover:bg-[#1C1C1E] text-white rounded-[10px] flex items-center justify-center shadow-sm transition-colors" aria-label="Call venue">
            <Phone size={18} strokeWidth={2.5} className="text-white"/>
          </button>
        </div>

        {/* Highlight Cards */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x">
          <div className="min-w-[105px] snap-start flex-1 h-[88px] bg-[#FFFFFF] border border-[rgba(10,10,10,0.10)] rounded-xl p-3 flex flex-col justify-between shadow-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <div>
              <p className="text-[13px] font-semibold text-[#0A0A0A] leading-tight line-clamp-1">Flexible offer</p>
              <p className="text-[12px] text-[#5C5C5C] mt-0.5 line-clamp-1">{salon?.bookingSettings?.cancellationPolicy || 'See booking policy'}</p>
            </div>
          </div>
          <div className="min-w-[105px] snap-start flex-1 h-[88px] bg-[#FFFFFF] border border-[rgba(10,10,10,0.10)] rounded-xl p-3 flex flex-col justify-between shadow-xs">
            <CalendarDays size={14} className="text-[#E73229] shrink-0" strokeWidth={2.5}/>
            <div>
              <p className="text-[13px] font-semibold text-[#0A0A0A] leading-tight line-clamp-1">Available slots</p>
              <p className="text-[12px] text-[#5C5C5C] mt-0.5 line-clamp-1">View current availability</p>
            </div>
          </div>
          <div className="min-w-[105px] snap-start flex-1 h-[88px] bg-[#FFFFFF] border border-[rgba(10,10,10,0.10)] rounded-xl p-3 flex flex-col justify-between shadow-xs">
            <ShieldCheck size={14} className="text-[#E73229] shrink-0" strokeWidth={2.5}/>
            <div>
              <p className="text-[13px] font-semibold text-[#0A0A0A] leading-tight line-clamp-1">Verified venue</p>
              <p className="text-[12px] text-[#5C5C5C] mt-0.5 line-clamp-1">Listed on QGo</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 mt-1">
          {/* Available Sports */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M12 9l2 3-1 6"/><path d="M14 12h4"/><path d="M7 11l4-2 3 5"/><path d="M5 22l4-5"/></svg>
              <h2 className="text-[13px] font-bold text-[#0A0A0A]">Sports</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {(salon?.resources?.length ? salon.resources.map((resource: any) => resource.name) : ['No resources configured']).map((sport: string, index: number) => (
                <button className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${index === 0 ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'bg-[#EFEFEF] text-[#0A0A0A] border-[rgba(10,10,10,0.10)]'}`} type="button" key={sport}>{sport}</button>
              ))}
            </div>
          </div>

          {/* Venue Info */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Info size={14} className="text-[#E73229]" />
              <h2 className="text-[13px] font-bold text-[#0A0A0A]">Venue info</h2>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="bg-[#EFEFEF] text-[#0A0A0A] border border-[rgba(10,10,10,0.10)] text-[11px] font-bold px-1.5 py-0.5 rounded-sm">Pitch</span>
                <span className="text-[11px] font-medium text-[#0A0A0A]">- {salon?.resources?.length || 1} Nets</span>
              </div>
              <div className="flex items-start gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E73229" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M4 20h16"/><path d="M5 20V12l3 3 4-7 4 7 3-3v8"/></svg>
                <div>
                  <p className="text-[11px] font-bold text-[#0A0A0A] leading-tight">Equipment</p>
                  <p className="text-[11px] text-[#5C5C5C] mt-0.5 line-clamp-1">{salon?.description || 'Details not provided'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="mt-1">
          <div className="flex items-center gap-1 mb-1.5">
            <Star size={14} className="text-[#E73229] fill-[#E73229]" />
            <h2 className="text-[13px] font-bold text-[#0A0A0A]">Amenities</h2>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(salon?.facilities || []).slice(0, 3).map((amenity: string) => (
              <div key={amenity} className="flex items-center gap-1.5 text-[11px] font-bold text-[#5C5C5C]">
                <div className="w-4 h-4 bg-[#FDECEA] rounded flex items-center justify-center shrink-0">
                   <Check size={9} className="text-[#E73229]" strokeWidth={3} />
                </div>
                {amenity}
              </div>
            ))}
            {!salon?.facilities?.length && <p className="text-[11px] font-medium text-[#5C5C5C]">No amenities listed.</p>}
          </div>
        </div>

        {/* Google-Style Customer Reviews & Overall Star Rating */}
        <div className="mt-2 pt-3 border-t border-[rgba(10,10,10,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-[#E73229] fill-[#E73229]" />
              <h2 className="text-[13px] font-bold text-[#0A0A0A]">Ratings &amp; Reviews</h2>
            </div>
            {details?.reviews?.length > 0 && (
              <span className="text-[11px] font-bold text-[#5C5C5C]">
                {details.reviews.length} verified {details.reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            )}
          </div>

          {details?.reviews?.length > 0 ? (
            <div className="p-3 bg-[#F9F9F9] rounded-xl border border-[rgba(10,10,10,0.06)] space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-center shrink-0">
                  <div className="text-3xl font-black text-[#0A0A0A] tabular-nums">
                    {salon?.rating ? salon.rating.toFixed(1) : (details.reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / details.reviews.length).toFixed(1)}
                  </div>
                  <div className="flex items-center gap-0.5 justify-center my-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={12}
                        className={
                          s <= Math.round(Number(salon?.rating || 0))
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-zinc-300'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#5C5C5C] font-semibold block">overall rating</span>
                </div>

                {/* 5-to-1 breakdown bars */}
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const c = details.reviews.filter((r: any) => Math.round(r.rating) === star).length;
                    const pct = Math.round((c / details.reviews.length) * 100);
                    return (
                      <div key={star} className="flex items-center gap-2 text-[10px]">
                        <span className="w-4 font-bold text-[#5C5C5C]">{star}★</span>
                        <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right font-mono text-[9px] text-[#5C5C5C]">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Review Snippets */}
              <div className="space-y-2 pt-2 border-t border-[rgba(10,10,10,0.06)]">
                {details.reviews.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0A0A0A] text-[11px]">{sanitizeCustomerName(r.customerName)}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={10} className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-[11px] text-[#5C5C5C] leading-snug">"{r.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#F9F9F9] rounded-xl border border-[rgba(10,10,10,0.06)] text-center">
              <p className="text-xs font-bold text-[#0A0A0A]">New Venue (0 reviews)</p>
              <p className="text-[11px] text-[#5C5C5C] mt-0.5">Verified customer reviews will appear after first matches.</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-[rgba(255,255,255,0.88)] backdrop-blur-md border-t border-[rgba(10,10,10,0.10)] z-50">
        <button type="button" className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white py-3.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-md transition-opacity" onClick={onProceed}>
          <CalendarDays size={18} strokeWidth={2.5} className="text-white"/> PROCEED TO SELECT A SLOT <ArrowRight size={18} strokeWidth={2.5} className="text-white"/>
        </button>
      </div>
    </main>
  );
}


function BookingFlowHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return <header className="booking-flow-header"><button type="button" onClick={onBack} aria-label="Back"><ArrowLeft size={25} /></button><h1>{title} {subtitle && <small>{subtitle}</small>}</h1><span className="booking-time-badge">03:00</span></header>;
}

function SlotSelectionView({ venue, draft, onBack, onContinue: onContinueDraft }: { venue: { id: string; name: string; address?: string }; draft: BookingDraft; onBack: () => void; onContinue: (draft: BookingDraft) => void }) {
  useQbiScreen('slot');
  const { user } = useAuth();
  const todayIso = toLocalDateString(new Date());
  const [localDraft, setLocalDraft] = useState(() => ({ ...draft, date: draft.date || todayIso }));
  const [customerName, setCustomerName] = useState(draft.customerName || user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone || user?.phone || '');
  const [notes, setNotes] = useState(draft.notes || '');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [slotFilter, setSlotFilter] = useState<'all' | 'morning' | 'evening'>('all');

  useEffect(() => setLocalDraft(prev => ({ ...draft, date: draft.date || prev.date || todayIso })), [draft, todayIso]);
  const date = localDraft.date || todayIso;
  const [availability, setAvailability] = useState<{ slots: any[]; isOpen?: boolean; message?: string } | null>(null);
  const [clockTick, setClockTick] = useState(0);
  
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((c) => c + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);
  
  useEffect(() => { 
    api.getAvailability(venue.id, { date, durationMinutes: 60, slotCategory: 'adult' } as any)
      .then(setAvailability)
      .catch(() => setAvailability({ slots: [] }));
  }, [venue.id, date, clockTick]);

  const formatTime = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const d = new Date();
    d.setHours(Number(h), Number(m), 0);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toUpperCase();
  };

  const allSlots = availability?.slots || [];
  const displaySlots = allSlots.filter((slot) => {
    if (slotFilter === 'all') return true;
    const hour = parseInt(slot.startTime.split(':')[0], 10);
    if (slotFilter === 'morning') return hour < 15;
    return hour >= 15;
  });

  const selectedSlots = allSlots.filter(s => selectedSlotIds.includes(s.id)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const totalPayable = selectedSlots.reduce((sum, s) => sum + (s.price || 0), 0);

  const toggleSlot = (id: string) => {
    haptics.selection();
    setSelectedSlotIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isFormValid = selectedSlotIds.length > 0 && customerName.trim().length >= 2 && /^(?:\+?[1-9]\d{9,14}|[6-9]\d{9})$/.test(customerPhone.replace(/[\s\-()]/g, ''));

  const onContinue = () => {
    if (!isFormValid) return;
    const totalAdvance = selectedSlots.reduce((sum, slot) => sum + (slot.advanceAmount || 0), 0);
    
    const firstSlot = selectedSlots[0];
    onContinueDraft({ 
      ...localDraft, 
      date: localDraft.date || date,
      startTime: firstSlot.startTime,
      endTime: selectedSlots[selectedSlots.length - 1].endTime,
      price: totalPayable,
      paymentType: firstSlot.paymentType || 'BOTH',
      advanceAmount: totalAdvance,
      customerName,
      customerPhone,
      notes,
      players: localDraft.players
    });
  };

  const generateDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = toLocalDateString(d);
      dates.push({
        iso,
        label: i === 0 ? 'TOD' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        day: d.toLocaleDateString('en-US', { day: '2-digit' }),
        mon: d.toLocaleDateString('en-US', { month: 'short' }),
        active: date === iso
      });
    }
    return dates;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none scroll-smooth bg-[rgba(10,10,10,0.50)] animate-in fade-in">
      <div className="flex min-h-[100dvh] flex-col sm:items-center sm:justify-center p-0 sm:py-12 sm:px-6">
        <div className="bg-[#FFFFFF] w-full flex-1 sm:flex-none sm:max-w-2xl rounded-none sm:rounded-[1.5rem] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-[#FFFFFF] p-5 sm:p-6 pb-5 text-[#0A0A0A] relative rounded-t-[1.5rem] rounded-b-3xl border-b border-[rgba(10,10,10,0.08)] shadow-sm z-10">
            <button onClick={onBack} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[rgba(10,10,10,0.05)] hover:bg-[rgba(10,10,10,0.1)] flex items-center justify-center text-[#0A0A0A] transition-colors" aria-label="Close">
               <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 1l12 12m0-12L1 13"/></svg>
            </button>
            <div className="inline-flex items-center gap-1.5 bg-[#FDECEA] text-[#B3231B] border border-[#F39887]/30 text-[11px] font-bold px-3 py-1 rounded-full mb-3 shadow-sm">
               <span>🎫</span> BOOK A TURF SLOT
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-1.5 tracking-tight text-[#0A0A0A]">{venue.name}</h2>
            <p className="text-xs font-medium text-[#5C5C5C] leading-relaxed max-w-[85%] flex items-center gap-1.5">
               <MapPin size={13} className="shrink-0 text-[#E73229]" /> {venue.address || 'Chennai, Tamil Nadu, India'}
            </p>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 p-5 sm:p-6 space-y-7 bg-[#FFFFFF] pb-36">
            
            {/* Dates */}
            <div>
              <h3 className="text-xs font-bold text-[#0A0A0A] mb-3 uppercase tracking-wider">1. Select Date</h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
                {generateDates().map(d => (
                  <button key={d.iso} onClick={() => { setLocalDraft({ ...localDraft, date: d.iso }); setSelectedSlotIds([]); }} className={`flex-shrink-0 w-[66px] h-[80px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${d.active ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] border-[#E73229] text-white shadow-md shadow-[#E73229]/25 scale-[1.02]' : 'bg-[#FFFFFF] border-[rgba(10,10,10,0.08)] text-[#5C5C5C] hover:border-[#E73229]/40 shadow-sm'}`}>
                    <span className={`text-[11px] font-semibold uppercase ${d.active ? 'text-white' : 'text-[#5C5C5C]'}`}>{d.label}</span>
                    <span className="text-lg font-black">{d.day}</span>
                    <span className={`text-[11px] font-semibold ${d.active ? 'text-white' : 'text-[#5C5C5C]'}`}>{d.mon}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Slots */}
            <div className="bg-[#FFFFFF] rounded-2xl p-4 sm:p-5 border border-[rgba(10,10,10,0.08)] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider mb-0.5">Available Slots ({date})</h3>
                  <p className="text-[11px] font-medium text-[#5C5C5C]">Slots for {venue.name}</p>
                </div>
                <div className="inline-flex self-start sm:self-auto items-center gap-1 bg-[#EFEFEF] p-1 rounded-full border border-[rgba(10,10,10,0.06)]">
                  <button onClick={() => setSlotFilter('all')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'all' ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white shadow-sm' : 'text-[#5C5C5C] hover:text-[#0A0A0A]'}`}>All</button>
                  <button onClick={() => setSlotFilter('morning')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'morning' ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white shadow-sm' : 'text-[#5C5C5C] hover:text-[#0A0A0A]'}`}>☀️ Morning</button>
                  <button onClick={() => setSlotFilter('evening')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'evening' ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white shadow-sm' : 'text-[#5C5C5C] hover:text-[#0A0A0A]'}`}>🌙 Evening</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {displaySlots.map((slot) => {
                  const isActive = selectedSlotIds.includes(slot.id);
                  const isBlocked = Boolean(slot.isBlocked || slot.blocked);
                  const isBooked = Boolean(slot.isBooked || (!slot.available && !isBlocked));
                  
                  const now = new Date();
                  const currentIso = toLocalDateString(now);
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const [sH, sM] = (slot.startTime || '00:00').split(':').map(Number);
                  const slotStartMinutes = (sH || 0) * 60 + (sM || 0);
                  const isPast = date < currentIso || (date === currentIso && currentMinutes >= slotStartMinutes);

                  const hour = parseInt(slot.startTime.split(':')[0], 10);
                  const isDayTime = hour >= 6 && hour < 18;
                  const timeStr = `${isDayTime ? '☀️' : '🌙'} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                  
                  // 1. Reserved by customer
                  if (isBooked) {
                    return (
                      <div key={slot.id} className="border border-red-200 bg-red-50/50 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center opacity-60 select-none">
                        <span className="text-[11px] font-semibold text-[#767676] line-through mb-1.5 leading-tight text-center">{timeStr}</span>
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Booked</span>
                      </div>
                    );
                  }

                  // 2. Past slot (closed)
                  if (isPast) {
                    return (
                      <div key={slot.id} className="border border-zinc-200 bg-zinc-100/60 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center opacity-50 select-none">
                        <span className="text-[11px] font-semibold text-[#767676] line-through mb-1.5 leading-tight text-center">{timeStr}</span>
                        <span className="text-[10px] font-bold text-zinc-500 bg-zinc-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Closed</span>
                      </div>
                    );
                  }

                  // 3. Manually blocked by owner
                  if (isBlocked) {
                    return (
                      <div key={slot.id} className="border border-amber-200 bg-amber-50/50 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center opacity-60 select-none">
                        <span className="text-[11px] font-semibold text-[#767676] line-through mb-1.5 leading-tight text-center">{timeStr}</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Blocked</span>
                      </div>
                    );
                  }

                  // 4. Available slot
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => toggleSlot(slot.id)}
                      className={`rounded-2xl p-3 sm:p-3.5 flex flex-col items-start transition-all active:scale-[0.97] text-left border relative overflow-hidden cursor-pointer ${
                        isActive
                          ? 'bg-[#FDECEA] border-2 border-[#E73229] text-[#0A0A0A] shadow-md ring-2 ring-[#E73229]/30 scale-[1.02]'
                          : 'bg-[#FFFFFF] border-[rgba(10,10,10,0.10)] text-[#0A0A0A] hover:border-[#E73229]/40 hover:bg-[#FDECEA]/40 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[11px] font-bold leading-tight text-[#0A0A0A]">
                          {timeStr}
                        </span>
                        {isActive && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#E73229] text-white tracking-wider uppercase shrink-0">
                            ✓ ADDED
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-medium mb-1 ${isActive ? 'text-[#B3231B]' : 'text-[#5C5C5C]'}`}>
                        ⏱ {slot.durationMinutes} min
                      </span>
                      <div className="flex items-center justify-between w-full mt-auto">
                        <span className="text-xs sm:text-sm font-bold tracking-tight text-[#0A0A0A]">
                          ₹{slot.price}
                        </span>
                        {isActive ? (
                          <span className="text-[11px] font-bold text-[#B3231B] bg-white border border-[#F39887]/30 px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase">
                            Available
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
            <div>
              <label className="block text-[11px] font-bold text-[#0A0A0A] mb-1.5">Your Name *</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="w-full border border-[rgba(10,10,10,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[#E73229] focus:ring-1 focus:ring-[#E73229] placeholder:text-[#767676] text-[#0A0A0A] font-medium" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#0A0A0A] mb-1.5">Phone Number *</label>
              <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="10-digit mobile number" className="w-full border border-[rgba(10,10,10,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[#E73229] focus:ring-1 focus:ring-[#E73229] placeholder:text-[#767676] text-[#0A0A0A] font-medium" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#0A0A0A] mb-1.5">Notes (Optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Football kits needed, 5v5 friendly match" className="w-full border border-[rgba(10,10,10,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[#E73229] focus:ring-1 focus:ring-[#E73229] placeholder:text-[#767676] font-medium text-[#0A0A0A] bg-[#F7F7F7]" />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(10,10,10,0.08)] bg-[#FFFFFF] p-4 pb-6 sm:p-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between rounded-none sm:rounded-b-[1.5rem]">
          <div className="flex justify-between items-center sm:block w-full sm:w-auto">
            <div>
              <div className="text-[11px] font-bold text-[#5C5C5C] uppercase tracking-widest mb-0.5">Total Payable</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tabular-nums tracking-tight ${selectedSlotIds.length > 0 ? 'text-[#0A0A0A]' : 'text-[#767676]'}`}>
                  ₹{totalPayable}
                </span>
                {selectedSlotIds.length > 0 ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FDECEA] text-[#B3231B] border border-[#F39887]/30 shadow-sm">
                    {selectedSlotIds.length} slot{selectedSlotIds.length > 1 ? 's' : ''} added
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[#767676]">(Select a slot)</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onContinue} disabled={!isFormValid} className={`w-full sm:w-auto px-7 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-colors duration-150 shadow-md ${isFormValid ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white hover:opacity-95 shadow-[#E73229]/25 cursor-pointer' : 'bg-[#EFEFEF] text-[#5C5C5C] shadow-none cursor-not-allowed'}`}>
            CONFIRM & BOOK SLOT
            <ArrowRight size={16} />
          </button>
        </div>

        </div>
      </div>
    </div>
  );
}

function BookingSummaryView({ venue, draft, onBack, onContinue }: { venue: { name: string }; draft: BookingDraft; onBack: () => void; onContinue: (mode: 'FULL' | 'ADVANCE') => void }) {
  useQbiScreen('summary');
  const allowedMode = draft.paymentType || 'BOTH';
  const [paymentMode, setPaymentMode] = useState<'advance' | 'full'>(allowedMode === 'ADVANCE' ? 'advance' : 'full');
  
  const total = draft.price || 1600;
  const advance = draft.advanceAmount || 0;
  
  // QGo Convenience Fee calculation
  const qgoFee = 30;
  const gst = 5.40; // 18% of 30
  const totalQgoFee = qgoFee + gst;
  
  const advancePayable = (advance + totalQgoFee).toFixed(2);
  const fullPayable = (total + totalQgoFee).toFixed(2);
  
  const baseAmountToPay = paymentMode === 'advance' ? advance : total;
  const amountToPay = (baseAmountToPay + totalQgoFee).toFixed(2);
  const remainingBalance = paymentMode === 'advance' ? (total - advance) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none scroll-smooth bg-[#FFFFFF] flex flex-col items-center animate-in fade-in slide-in-from-right-10 duration-200">
      <div className="w-full sm:max-w-md relative pb-32">
        {/* Header Background */}
        <div className="bg-[#FFFFFF] px-5 pt-6 pb-6 relative shrink-0">
          <div className="flex items-center justify-between text-[#000000]">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="w-8 h-8 rounded-full bg-[#FFFFFF] border border-[rgba(0,0,0,0.12)] flex items-center justify-center hover:bg-[rgba(0,0,0,0.05)] transition-colors shadow-sm text-[rgba(0,0,0,0.70)]">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Sep 21 <span className="text-sm font-medium text-[rgba(0,0,0,0.70)]">00:00 - 02:00</span>
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* Content Cards */}
        <div className="px-5 space-y-4 relative z-10">
          
          {/* Bill Details */}
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(10,10,10,0.10)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#FDECEA] flex items-center justify-center text-[#E73229]">
                <Receipt size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">Bill Details</h3>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[#5C5C5C] font-medium">Slot Cost</span>
              <span className="font-bold text-[#0A0A0A]">₹{total}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[#5C5C5C] font-medium">QGo Convenience Fee</span>
              <span className="font-bold text-[#0A0A0A]">₹{qgoFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[#5C5C5C] font-medium">GST (18% on Fee)</span>
              <span className="font-bold text-[#0A0A0A]">₹{gst.toFixed(2)}</span>
            </div>
            {paymentMode === 'advance' && (
              <div className="flex justify-between items-center text-sm mb-3 pt-3 border-t border-[rgba(10,10,10,0.10)]">
                <span className="text-[#C9281F] font-bold">Remaining Balance</span>
                <span className="font-bold text-[#C9281F]">₹{remainingBalance.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-[rgba(10,10,10,0.10)]">
              <div className="flex items-center gap-2 text-[#0A0A0A] font-bold text-sm">
                <Wallet size={16} />
                <span>Amount due at venue</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-[#0A0A0A]">₹{amountToPay}</span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(10,10,10,0.10)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#FDECEA] flex items-center justify-center text-[#E73229]">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0A0A0A] leading-tight">Payment</h3>
                <p className="text-[11px] text-[#5C5C5C]">Online payment is not available</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(allowedMode === 'ADVANCE' || allowedMode === 'BOTH') && (
                <button onClick={() => setPaymentMode('advance')} className={`border rounded-2xl p-4 flex flex-col text-left transition-colors duration-150 relative ${paymentMode === 'advance' ? 'border-[#E73229] bg-white shadow-sm ring-1 ring-[#E73229]' : 'border-[rgba(10,10,10,0.10)] bg-white hover:border-[rgba(10,10,10,0.20)]'}`}>
                  <div className="flex justify-between items-start mb-3 w-full">
                    <CreditCard size={18} className="text-[#5C5C5C]" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'advance' ? 'border-[#E73229]' : 'border-[rgba(10,10,10,0.20)]'}`}>
                      {paymentMode === 'advance' && <div className="w-2 h-2 rounded-full bg-[#E73229]" />}
                    </div>
                  </div>
                  <div className="font-bold text-[#0A0A0A] text-sm mb-0.5">Advance</div>
                  <div className="text-[11px] text-[#5C5C5C] mb-2">Pay ₹{advancePayable} now</div>
                  <div className="text-lg font-bold text-[#0A0A0A] mt-auto">₹{advancePayable}</div>
                </button>
              )}

              {(allowedMode === 'FULL' || allowedMode === 'BOTH') && (
                <button onClick={() => setPaymentMode('full')} className={`border rounded-2xl p-4 flex flex-col text-left transition-colors duration-150 relative ${paymentMode === 'full' ? 'border-[#E73229] bg-white shadow-sm ring-1 ring-[#E73229]' : 'border-[rgba(10,10,10,0.10)] bg-white hover:border-[rgba(10,10,10,0.20)]'}`}>
                  <div className="flex justify-between items-start mb-3 w-full">
                    <Wallet size={18} className={paymentMode === 'full' ? 'text-[#E73229]' : 'text-[#5C5C5C]'} />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'full' ? 'border-[#E73229]' : 'border-[rgba(10,10,10,0.20)]'}`}>
                      {paymentMode === 'full' && <div className="w-2 h-2 rounded-full bg-[#E73229]" />}
                    </div>
                  </div>
                  <div className="font-bold text-[#0A0A0A] text-sm mb-0.5">Pay at venue</div>
                  <div className="text-[11px] text-[#5C5C5C] mb-2">No online charge is taken</div>
                  <div className={`text-lg font-bold mt-auto ${paymentMode === 'full' ? 'text-[#E73229]' : 'text-[#0A0A0A]'}`}>₹{fullPayable}</div>
                </button>
              )}
            </div>

            <div className="bg-[#FDECEA] rounded-2xl p-4 flex items-center justify-between border border-[#F39887]/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E73229] rounded-xl flex items-center justify-center text-white shadow-sm">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#5C5C5C] uppercase tracking-wider mb-0.5">Amount due at venue</div>
                  <div className="text-2xl font-bold tabular-nums text-[#0A0A0A] leading-none">₹{amountToPay}</div>
                </div>
              </div>
              <div className="bg-[#B3231B] text-white px-2.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest flex items-center gap-1 uppercase">
                <Zap size={10} fill="currentColor" /> PAY AT VENUE
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(10,10,10,0.10)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#FDECEA] flex items-center justify-center text-[#E73229]">
                <ShieldCheck size={16} />
              </div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">Cancellation Policy</h3>
            </div>
            
            <div className="bg-[#F7F7F7] rounded-2xl p-4 space-y-4 border border-[rgba(10,10,10,0.06)]">
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-[#E73229] shrink-0 mt-0.5" />
                <p className="text-xs text-[#5C5C5C] leading-relaxed">
                  Cancel before <span className="font-bold text-[#0A0A0A]">24 hours of start time</span> to avail a refund.<br />
                  <span className="text-[#5C5C5C]">Service fee is non-refundable.</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-[#E73229] shrink-0 mt-0.5" />
                <p className="text-xs text-[#5C5C5C] leading-relaxed">
                  If you cancel after the above time, you will lose the entire amount paid.
                </p>
              </div>
            </div>
          </div>

        </div>
        
        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[rgba(255,255,255,0.88)] backdrop-blur-md border-t border-[rgba(10,10,10,0.10)] sm:relative sm:bg-transparent sm:border-0 z-50">
          <div className="max-w-md mx-auto">
            <button onClick={() => onContinue(paymentMode === 'advance' ? 'ADVANCE' : 'FULL')} className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white hover:opacity-95 py-4 rounded-[14px] font-bold text-[15px] flex items-center justify-center gap-2 shadow-md">
              <LockKeyhole size={18} /> PROCEED TO PAY ₹{amountToPay} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationConfirmationView({ venue, user, draft, onBack, onBooked }: { venue: { id: string; name: string; image?: string }; user: any; draft: BookingDraft; onBack: () => void; onBooked: (booking: any) => void }) {
  useQbiScreen('payment');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reserve = async () => {
    if (!user) {
      setError('Please sign in again before reserving a slot.');
      return;
    }
    if (!draft.date || !draft.startTime || !draft.endTime || (draft.endTime !== '00:00' && draft.endTime <= draft.startTime)) {
      setError('Complete a valid date and time range before continuing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.createBooking({
        salonId: venue.id,
        customerName: draft.customerName || user.name || user.displayName || 'Customer',
        customerPhone: draft.customerPhone || user.phone || user.phoneNumber || user.email || 'Not provided',
        mode: 'appointment',
        scheduledDate: draft.date,
        scheduledTime: draft.startTime,
        slotEndTime: draft.endTime,
        numberOfPlayers: draft.players,
        notes: `${draft.format}; ${draft.pitches} pitch${draft.pitches === 1 ? '' : 'es'}`,
      });
      if (result.success && result.booking) {
        onBooked(result.booking);
      } else {
        setError(result.error || 'This slot is no longer available. Please choose another slot.');
      }
    } catch (requestError: any) {
      setError(requestError?.message || 'Unable to create the reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FFFFFF] flex flex-col items-center p-5">
      <div className="w-full max-w-md pt-8">
        <button onClick={onBack} className="p-1 hover:bg-[rgba(10,10,10,0.05)] rounded-full transition-colors" aria-label="Back to booking summary">
          <ArrowLeft size={24} className="text-[#0A0A0A]" />
        </button>
        <div className="mt-6 bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.10)] p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#0A0A0A]">Confirm reservation</h1>
          <p className="mt-2 text-sm text-[#5C5C5C]">Online payments are not available yet. Your reservation will be created with payment due at the venue.</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-[#5C5C5C]">Venue</dt><dd className="font-semibold text-[#0A0A0A] text-right">{venue.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#5C5C5C]">Date</dt><dd className="font-semibold text-[#0A0A0A]">{draft.date}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#5C5C5C]">Time</dt><dd className="font-semibold text-[#0A0A0A]">{draft.startTime} – {draft.endTime}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#5C5C5C]">Amount due</dt><dd className="font-semibold text-[#0A0A0A]">₹{draft.price || 0}</dd></div>
          </dl>
          {error && <p className="mt-5 text-sm font-medium text-[#B3261E]">{error}</p>}
          <button onClick={reserve} disabled={loading} className="mt-6 w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] hover:opacity-95 disabled:bg-[#EFEFEF] disabled:text-[#5C5C5C] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md">
            <Ticket size={18} /> {loading ? 'Reserving…' : 'Reserve and pay at venue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentView({ venue, user, draft, onBack, onPaid }: { venue: { id: string; name: string; image?: string }; user: any; draft: BookingDraft; onBack: () => void; onPaid: (booking: any) => void }) {
  useQbiScreen('payment');
  const qbi = useQbi();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'google' | 'phonepe' | 'paytm'>('google');
  const basePrice = draft.price || 1600;
  const advanceAmount = draft.advanceAmount || 0;
  
  const qgoFee = 30;
  const qgoGst = 5.40; // 18% of 30
  const totalQgoFee = qgoFee + qgoGst;
  
  const baseAmountToPay = draft.paymentType === 'ADVANCE' ? advanceAmount : basePrice;
  const totalPayable = (baseAmountToPay + totalQgoFee).toFixed(2);

  const pay = async () => {
    if (!user) { setError('Please sign in again before booking.'); return; }
    const bookingDate = draft.date || toLocalDateString(new Date());
    if (!bookingDate || !draft.startTime || !draft.endTime || (draft.endTime !== '00:00' && draft.endTime <= draft.startTime)) { setError('Complete a valid date and time range before continuing.'); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { qbi.notBooked('offline', { onRetry: pay }); return; }
    setLoading(true);

    const paymentType = draft.paymentType === 'ADVANCE' ? 'ADVANCE' : 'FULL';
    let paymentId: string | undefined;
    let orderId: string | undefined;
    let paymentSignature: string | undefined;

    try {
      const orderRes = await api.createPaymentOrder({
        salonId: venue.id,
        amount: Number(totalPayable),
        paymentType,
      });

      if (!orderRes.success || !orderRes.orderId) {
        setLoading(false);
        setError(orderRes.error || 'Failed to initiate payment. Please try again.');
        return;
      }

      orderId = orderRes.orderId;
      paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const verifyRes = await api.verifyPayment({
        orderId,
        paymentId,
        method: paymentMethod,
      });

      if (!verifyRes.success || !verifyRes.paymentSignature) {
        setLoading(false);
        setError(verifyRes.error || 'Payment verification failed. Please try again.');
        return;
      }

      paymentSignature = verifyRes.paymentSignature;
    } catch {
      setLoading(false);
      setError('Payment gateway error. Please try again.');
      return;
    }

    let result: Awaited<ReturnType<typeof api.createBooking>>;
    try {
      result = await api.createBooking({
        salonId: venue.id,
        customerName: draft.customerName || user.name || user.displayName || 'Customer',
        customerPhone: draft.customerPhone || user.phone || user.phoneNumber || user.email || 'Not provided',
        mode: 'appointment',
        scheduledDate: bookingDate,
        scheduledTime: draft.startTime,
        slotEndTime: draft.endTime,
        price: draft.price,
        numberOfPlayers: draft.players,
        notes: `${draft.format}; ${draft.pitches} pitch${draft.pitches === 1 ? '' : 'es'}`,
        paymentType,
        advanceAmount: draft.paymentType === 'ADVANCE' ? draft.advanceAmount : 0,
        paymentId,
        orderId,
        paymentSignature,
      });
    } catch (e) {
      setLoading(false);
      setError('Network problem. Your booking was not confirmed.');
      qbi.notBooked(classifyBookingFailure(e), { onRetry: pay });
      return;
    }
    setLoading(false);
    if (result.success && result.booking) {
      qbi.booked();
      onPaid(result.booking);
    } else {
      setError(result.error || 'This slot is no longer available. Please choose another slot.');
      qbi.notBooked(classifyBookingFailure(result), { onRetry: pay });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none bg-[#FFFFFF] flex flex-col items-center animate-in fade-in slide-in-from-right-10 duration-200">
      
      {/* Full Screen GPay Loading Overlay */}
      {loading && paymentMethod === 'google' && (
        <div className="fixed inset-0 z-[100] bg-[rgba(10,10,10,0.50)] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-[#FFFFFF] p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs w-full border border-[rgba(10,10,10,0.10)]">
            <div className="w-16 h-16 rounded-full border-4 border-[#EFEFEF] border-t-[#E73229] animate-spin mb-6"></div>
            <div className="flex font-black text-[38px] leading-none tracking-tight mb-3">
              <span className="text-[#4285F4]">G</span>
              <span className="text-[#EA4335]">P</span>
              <span className="text-[#FBBC05]">a</span>
              <span className="text-[#34A853]">y</span>
            </div>
            <p className="text-[#0A0A0A] font-bold text-base mb-0.5">Paying ₹{totalPayable}</p>
            <p className="text-[#5C5C5C] text-xs font-semibold">To {venue.name}</p>
            <p className="text-[#767676] text-[11px] mt-2">Connecting with Google Pay UPI...</p>
          </div>
        </div>
      )}

      <div className="w-full sm:max-w-md relative pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pt-8 mb-2">
          <button onClick={onBack} className="p-1 hover:bg-[rgba(10,10,10,0.05)] rounded-full transition-colors">
            <ArrowLeft size={24} className="text-[#0A0A0A]" />
          </button>
          <h1 className="text-xl font-bold text-[#0A0A0A] absolute left-1/2 -translate-x-1/2">Secure Checkout</h1>
          <div className="w-6" />
        </div>

        {/* Order Summary Card */}
        <div className="mx-4 bg-[#FFFFFF] rounded-2xl shadow-sm border border-[rgba(10,10,10,0.10)] p-5 mb-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[17px] font-bold text-[#0A0A0A]">Order Summary</h2>
            <ChevronDown size={20} className="text-[#E73229]" />
          </div>
          <div className="flex gap-4 items-start mb-5">
            <img src={venue.image || 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c'} alt="turf" loading="lazy" decoding="async" className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-[#0A0A0A] text-[15px]">Turf Booking</h3>
                <span className="font-bold text-[#0A0A0A]">₹{basePrice}</span>
              </div>
              <p className="text-[13px] text-[#5C5C5C]">{draft.format || 'Football'} Turf - Premium</p>
              <p className="text-[11px] text-[#5C5C5C] mt-1">Qty: 1 • {draft.date} - {draft.startTime} - {draft.endTime}</p>
            </div>
          </div>
          
          <div className="border-t border-[rgba(10,10,10,0.10)] pt-4 pb-2 space-y-2">
            <div className="flex justify-between text-[13px] text-[#5C5C5C]">
              <span>Total Slot Price</span>
              <span className="font-semibold text-[#0A0A0A]">₹{basePrice.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#5C5C5C]">
              <span>Discount</span>
              <span className="font-semibold text-[#0A0A0A]">- ₹0</span>
            </div>
          </div>
          
          <div className="border-t border-[rgba(10,10,10,0.10)] pt-3 pb-3 space-y-2">
            {draft.paymentType === 'ADVANCE' ? (
              <div className="flex justify-between text-[13px] text-[#5C5C5C]">
                <span>Online Advance</span>
                <span className="font-bold text-[#0A0A0A]">₹{advanceAmount.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <div className="flex justify-between text-[13px] text-[#5C5C5C]">
                <span>Online Payment (Full)</span>
                <span className="font-bold text-[#0A0A0A]">₹{basePrice.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] text-[#5C5C5C]">
              <span>QGo Convenience Fee</span>
              <span className="font-semibold text-[#0A0A0A]">₹{qgoFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[#5C5C5C]">
              <span>GST (18% on Fee)</span>
              <span className="font-semibold text-[#0A0A0A]">₹{qgoGst.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="border-t border-[rgba(10,10,10,0.10)] pt-4 flex justify-between items-center">
            <div>
              <span className="font-bold text-[#0A0A0A] text-base block">Payable Now</span>
              <span className="text-[11px] text-[#5C5C5C] font-medium">Includes fee &amp; GST</span>
            </div>
            <span className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">₹{totalPayable}</span>
          </div>

          {/* Remaining Balance Due at Venue Box */}
          {draft.paymentType === 'ADVANCE' ? (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span className="font-bold text-amber-900 truncate">Remaining Balance Due at Venue</span>
              </div>
              <span className="font-black text-amber-900 tabular-nums shrink-0 text-sm">
                ₹{(basePrice - advanceAmount).toLocaleString('en-IN')}
              </span>
            </div>
          ) : (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span className="font-bold text-emerald-900 truncate">Remaining Balance Due at Venue</span>
              </div>
              <span className="font-black text-emerald-900 shrink-0 text-sm">
                ₹0 (Paid in Full)
              </span>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="mx-4 mb-5">
          <h2 className="text-[17px] font-bold text-[#0A0A0A] mb-0.5">Payment Method</h2>
          <p className="text-[11px] text-[#5C5C5C] mb-4">Choose your preferred payment method</p>
          
          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={() => setPaymentMethod('google')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'google' ? 'border-[#E73229]' : 'border-[rgba(10,10,10,0.10)] hover:border-[rgba(10,10,10,0.20)]'}`}>
              <div className={`absolute top-2 right-2 w-[16px] h-[16px] rounded-full flex items-center justify-center ${paymentMethod === 'google' ? 'bg-[#E73229] text-white' : 'border border-[rgba(10,10,10,0.20)]'}`}>
                {paymentMethod === 'google' && <Check size={10} strokeWidth={4} className="text-white"/>}
              </div>
              <div className="mb-2 mt-1">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="font-bold text-[11px] text-[#0A0A0A]">Google Pay</span>
            </button>

            <button type="button" onClick={() => setPaymentMethod('phonepe')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'phonepe' ? 'border-[#E73229]' : 'border-[rgba(10,10,10,0.10)] hover:border-[rgba(10,10,10,0.20)]'}`}>
              <div className={`absolute top-2 right-2 w-[16px] h-[16px] rounded-full flex items-center justify-center ${paymentMethod === 'phonepe' ? 'bg-[#E73229] text-white' : 'border border-[rgba(10,10,10,0.20)]'}`}>
                {paymentMethod === 'phonepe' && <Check size={10} strokeWidth={4} className="text-white"/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="w-[18px] h-[18px] bg-[#5F259F] rounded-full flex items-center justify-center text-[#FFFFFF] text-[11px] font-black leading-none pt-[1px]">Pe</div>
              </div>
              <span className="font-bold text-[11px] text-[#0A0A0A]">PhonePe</span>
            </button>

            <button type="button" onClick={() => setPaymentMethod('paytm')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'paytm' ? 'border-[#E73229]' : 'border-[rgba(10,10,10,0.10)] hover:border-[rgba(10,10,10,0.20)]'}`}>
              <div className={`absolute top-2 right-2 w-[16px] h-[16px] rounded-full flex items-center justify-center ${paymentMethod === 'paytm' ? 'bg-[#E73229] text-white' : 'border border-[rgba(10,10,10,0.20)]'}`}>
                {paymentMethod === 'paytm' && <Check size={10} strokeWidth={4} className="text-white"/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="flex font-black text-[14px] leading-none tracking-tight">
                  <span className="text-[#012B72]">Pay</span><span className="text-[#00BAF2]">tm</span>
                </div>
              </div>
              <span className="font-bold text-[11px] text-[#0A0A0A]">Paytm</span>
            </button>
          </div>
        </div>

        {error && <p className="text-[#B3261E] text-xs font-semibold mb-4 mx-4 text-center">{error}</p>}

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[rgba(255,255,255,0.88)] backdrop-blur-md border-t border-[rgba(10,10,10,0.10)] sm:relative sm:bg-transparent sm:border-0 z-50">
          <div className="max-w-md mx-auto">
            <button type="button" onClick={pay} disabled={loading} className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white disabled:bg-[#EFEFEF] disabled:text-[#5C5C5C] py-4 rounded-[14px] font-bold text-[16px] flex items-center justify-center gap-2 shadow-md">
              <LockKeyhole size={18} /> {loading ? 'Confirming with Bank...' : paymentMethod === 'google' ? `Pay ₹${totalPayable} with Google Pay` : paymentMethod === 'phonepe' ? `Pay ₹${totalPayable} with PhonePe` : `Pay ₹${totalPayable} with Paytm`} <ArrowRight size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function PaidView() { 
  useQbiScreen('paid'); 
  return (
    <div className="fixed inset-0 bg-[linear-gradient(160deg,#F0554A_0%,#E73229_45%,#C0241D_100%)] flex flex-col items-center justify-center z-[100] animate-in slide-in-from-bottom-10">
      <div className="w-28 h-28 bg-[#FFFFFF] rounded-full flex items-center justify-center mb-8 shadow-2xl animate-in zoom-in duration-500 delay-150">
        <Check size={56} strokeWidth={3} className="text-[#E73229]" />
      </div>
      <h1 className="text-[28px] font-black text-[#FFFFFF] mb-3 tracking-tight">Payment Successful!</h1>
      <p className="text-[#FEE8D4] font-bold text-sm">Generating your ticket...</p>
    </div>
  );
}

async function generateTicketCanvas(ticketEl: HTMLElement): Promise<HTMLCanvasElement> {
  const clone = ticketEl.cloneNode(true) as HTMLElement;
  clone.id = 'ticket-card-export';

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '380px';
  container.style.minWidth = '380px';
  container.style.maxWidth = '380px';
  container.style.height = 'auto';
  container.style.overflow = 'visible';
  container.style.zIndex = '-9999';
  container.style.backgroundColor = '#FFFFFF';
  container.style.margin = '0';
  container.style.padding = '0';

  clone.style.width = '380px';
  clone.style.minWidth = '380px';
  clone.style.maxWidth = '380px';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '26px';

  // Make sure cutouts on the exported canvas blend seamlessly with pure white
  const notches = clone.querySelectorAll<HTMLElement>('.ticket-notch');
  notches.forEach((n) => {
    n.style.backgroundColor = '#FFFFFF';
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  // Wait a moment for fonts, layout, and images to settle
  await new Promise((r) => setTimeout(r, 120));

  const contentWidth = clone.offsetWidth || 380;
  const contentHeight = clone.scrollHeight || clone.offsetHeight;

  try {
    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      width: contentWidth,
      height: contentHeight,
      windowWidth: contentWidth + 100,
      windowHeight: contentHeight + 100,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      logging: false,
    });
    return canvas;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

function formatTicketTime(time24: string): string {
  const [hourText, minuteText = '00'] = time24.split(':');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return time24;
  return `${hour % 12 || 12}:${minuteText.padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function TicketView({
  venue,
  user,
  booking,
  draft,
  onHome,
}: {
  venue: { id?: string; name: string; image?: string };
  user: any;
  booking: any;
  draft: BookingDraft;
  onHome: () => void;
}) {
  useQbiScreen('ticket');
  const { setToastMessage } = useQueue();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ticketToast, setTicketToast] = useState<{
    title: string;
    message: string;
    type: 'success' | 'alert';
  } | null>(null);

  useEffect(() => {
    if (!ticketToast) return;
    const timer = setTimeout(() => {
      setTicketToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [ticketToast]);
  const [activeBooking, setActiveBooking] = useState(booking);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareMessage, setShareMessage] = useState('');
  const [showFullQr, setShowFullQr] = useState(false);

  useEffect(() => {
    if (booking) setActiveBooking(booking);
  }, [booking]);

  useEffect(() => {
    const bookingId = activeBooking?.id || booking?.id;
    if (bookingId) {
      api.getBooking(bookingId).then((res) => {
        if (res?.success && res.booking) {
          setActiveBooking(res.booking);
        }
      }).catch((err) => console.warn('Could not refresh booking ticket:', err));

      const poll = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        api.getBooking(bookingId).then((res) => {
          if (res?.success && res.booking) {
            setActiveBooking(res.booking);
          }
        }).catch(() => {});
      }, 5000);
      return () => clearInterval(poll);
    }
  }, [activeBooking?.id, booking?.id]);

  useEffect(() => {
    if (activeBooking?.status === 'completed') setShowFullQr(false);
  }, [activeBooking?.status]);

  const shortId = useMemo(() => {
    const raw = activeBooking?.id || booking?.id || 'BOOKING';
    const clean = raw.replace(/^(bk_turf_|bk_walkin_|bk_|booking_)/i, '').toUpperCase();
    return `QGO-${clean}`;
  }, [activeBooking?.id, booking?.id]);

  const qrPayloadString = useMemo(() => {
    // Encode short, high-contrast ticket identifier for instant phone camera scanning
    return shortId;
  }, [shortId]);

  useEffect(() => {
    let active = true;
    QRCodeLib.toDataURL(qrPayloadString, {
      width: 480,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0A0A0A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('Failed to generate QR:', err));
    return () => {
      active = false;
    };
  }, [qrPayloadString]);

  const formattedDate = useMemo(() => {
    const rawDate = draft?.date || activeBooking?.scheduledDate || booking?.scheduledDate;
    const d = rawDate ? new Date(rawDate) : new Date();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const day = d.toLocaleDateString('en-US', { day: '2-digit' });
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${weekday}, ${day} ${month}`;
  }, [draft?.date, activeBooking?.scheduledDate, booking?.scheduledDate]);

  const startTime = draft?.startTime || activeBooking?.scheduledTime || booking?.scheduledTime || '10:00';
  const endTime = draft?.endTime || activeBooking?.slotEndTime || booking?.slotEndTime || '12:00';
  const displayStartTime = formatTicketTime(startTime);
  const displayEndTime = formatTicketTime(endTime);

  const durationMinutes = useMemo(() => {
    if (activeBooking?.serviceDuration) return activeBooking.serviceDuration;
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff <= 0) diff += 24 * 60;
      return diff || 60;
    } catch {
      return 60;
    }
  }, [startTime, endTime, activeBooking?.serviceDuration]);

  const durationText = `${durationMinutes}m`;
  const turfName = venue?.name || activeBooking?.salonName || booking?.salonName || 'RK Turf';
  const sportFormat = draft?.format || activeBooking?.serviceName?.replace(/Slot$/i, '').trim() || booking?.serviceName || 'Box Cricket';
  const playerName = user?.name || user?.displayName || activeBooking?.customerName || booking?.customerName || 'Player';
  const pitchName = activeBooking?.resourceName || (draft?.pitches ? `Pitch ${draft.pitches > 1 ? `1-${draft.pitches}` : '1'}` : 'Pitch 1');

  const totalAmount = Number(activeBooking?.totalAmount || activeBooking?.amount || booking?.totalAmount || draft?.price || 1200);
  const rawPaidAmount = Number(activeBooking?.paidAmount ?? booking?.paidAmount ?? 0);
  const paymentType = draft?.paymentType || activeBooking?.paymentType;
  const paymentStatus = activeBooking?.paymentStatus || booking?.paymentStatus;

  const isFullyPaid = (
    paymentStatus === 'PAID' ||
    paymentStatus === 'paid' ||
    paymentType === 'FULL' ||
    (rawPaidAmount > 0 && rawPaidAmount >= totalAmount)
  );

  const isAdvancePaid = !isFullyPaid && (
    paymentType === 'ADVANCE' ||
    paymentStatus === 'PARTIALLY_PAID' ||
    (rawPaidAmount > 0 && rawPaidAmount < totalAmount)
  );

  const paidAmount = isFullyPaid ? totalAmount : (rawPaidAmount || draft?.advanceAmount || 0);
  const balanceDue = isFullyPaid ? 0 : Math.max(0, activeBooking?.balanceAmount ?? (totalAmount - paidAmount));

  const handleShareTicket = async () => {
    const paymentDetail = isFullyPaid
      ? 'Payment: fully paid'
      : `Payment: ₹${paidAmount} paid; ₹${balanceDue} due at the venue`;
    const text = [
      `${turfName} — QGo booking ticket`,
      `Booking ID: ${shortId}`,
      `Date & time: ${formattedDate}, ${displayStartTime}–${displayEndTime}`,
      `Player: ${playerName}`,
      paymentDetail,
      'Show this ticket QR to the venue owner for check-in.',
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: `${turfName} ticket`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareMessage('Ticket details copied.');
    } catch (shareError) {
      if ((shareError as DOMException).name !== 'AbortError') {
        setShareMessage('Could not share the ticket. Please try again.');
      }
    }
  };

  const handleSaveTicket = async () => {
    if (isSaving) return;
    const ticketNode = ticketRef.current || document.getElementById('ticket-card-content');
    if (!ticketNode) {
      const err = new Error('Ticket content element not found');
      console.error('Save ticket failed:', err);
      const failMsg = {
        title: 'Save Failed',
        message: 'Ticket element could not be found.',
        type: 'alert' as const,
      };
      setTicketToast(failMsg);
      try {
        setToastMessage?.(failMsg);
      } catch {
        // queue context optional
      }
      return;
    }

    setIsSaving(true);
    try {
      // 1. Wait for document fonts to finish loading
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      // 2. Ensure all images inside the ticket (including QR code) are ready and not tainted
      await ensureTicketImagesReady(ticketNode);

      // 3. Render ticket node to PNG with 2x pixel ratio and opaque ticket background
      const dataUrl = await toPng(ticketNode, TICKET_CAPTURE_OPTIONS);

      const bookingId = activeBooking?.id || booking?.id || shortId;
      const fileName = getTicketFileName(bookingId);

      // 4. Platform specific save/share behavior
      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: `${turfName} Ticket`,
          text: `QGo Match Ticket - ${turfName}`,
          url: writeResult.uri,
          dialogTitle: 'Save Ticket',
        });
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      const successMsg = {
        title: 'Ticket Saved',
        message: Capacitor.isNativePlatform()
          ? 'Ticket ready to save or share.'
          : `Downloaded as ${fileName}`,
        type: 'success' as const,
      };
      setTicketToast(successMsg);
      try {
        setToastMessage?.(successMsg);
      } catch {
        // queue context optional
      }
    } catch (saveError) {
      console.error('Error generating or saving ticket PNG:', saveError);
      const failMsg = {
        title: 'Save Failed',
        message: (saveError as Error)?.message || 'Could not save the ticket. Please try again.',
        type: 'alert' as const,
      };
      setTicketToast(failMsg);
      try {
        setToastMessage?.(failMsg);
      } catch {
        // queue context optional
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F5F6F8] z-[100] overflow-y-auto flex flex-col pt-5 pb-16 sm:pb-24 px-4 items-center animate-in fade-in">
      {/* Top Header */}
      <div className="w-full max-w-[380px] mb-4 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
          <CheckCircle2 size={13} className="text-emerald-400" /> {activeBooking?.status === 'completed' ? 'Slot Completed' : 'Booking Confirmed'}
        </div>
        <h1 className="text-2xl font-black text-[#0A0A0A] tracking-tight">Your Match Ticket</h1>
        <p className="text-[#5C5C5C] font-medium text-xs mt-1">Present this digital boarding pass to the venue owner</p>
      </div>

      {/* Main Ticket Card - Reference Image 2 Boarding Pass Style */}
      <div
        id="ticket-card-content"
        ref={ticketRef}
        className="w-full max-w-[380px] bg-[#FFFFFF] rounded-[26px] shadow-[0_16px_40px_rgba(0,0,0,0.18)] border border-neutral-200/80 overflow-hidden text-neutral-900 select-none flex flex-col"
      >
        {/* Upper Section */}
        <div className="p-4 sm:p-6 sm:pb-4 bg-[#FFFFFF]">
          {/* Header Row: Train/Ticket icon + Code on Left | Date on Right */}
          <div className="flex justify-between items-center gap-2 mb-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] text-[#FFFFFF] flex items-center justify-center shrink-0">
                <Ticket size={15} className="rotate-[-45deg]" />
              </div>
              <span className="font-extrabold text-[#0A0A0A] text-[15px] tracking-tight truncate">{shortId}</span>
            </div>
            <span className="font-bold text-[#0A0A0A] text-[12px] sm:text-[13px] tracking-wide uppercase shrink-0">{formattedDate}</span>
          </div>

          {/* Location & Sport Row */}
          <div className="flex justify-between gap-3 items-baseline mb-2 min-w-0">
            <span className="text-[#374151] font-bold text-[15px] truncate min-w-0">{turfName}</span>
            <span className="text-[#6B7280] font-medium text-[13px] truncate min-w-0 text-right">{sportFormat}</span>
          </div>

          {/* Time & Route Progress Row */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 my-3">
            <span className="min-w-0 text-[clamp(18px,5.5vw,26px)] font-black text-[#0A0A0A] tabular-nums tracking-tight leading-none whitespace-nowrap">
              {displayStartTime}
            </span>

            <div className="flex items-center justify-center bg-[#F3F4F6] px-2 py-1 rounded-full border border-[#E5E7EB] text-[#111827] text-[11px] font-bold whitespace-nowrap">
                <Clock size={11} className="text-[#E73229]" />
                {durationText}
            </div>

            <span className="min-w-0 text-[clamp(18px,5.5vw,26px)] font-black text-[#0A0A0A] tabular-nums tracking-tight leading-none whitespace-nowrap text-right">
              {displayEndTime}
            </span>
          </div>

          {/* Booking Status Badge */}
          <div className="flex items-center justify-center gap-1.5 mt-1 mb-4">
            <div className={`w-2 h-2 rounded-full ${activeBooking?.status === 'completed' ? 'bg-[#16845B]' : activeBooking?.status === 'checked_in' ? 'bg-blue-600' : 'bg-[#16845B]'}`} />
            <span className={`text-[12px] font-bold ${activeBooking?.status === 'checked_in' ? 'text-blue-600' : 'text-[#16845B]'}`}>
              {activeBooking?.status === 'completed' ? 'Completed' : activeBooking?.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-[#F3F4F6] pt-3.5" />

          {/* Passenger & Booking Details Grid */}
          <div className="grid grid-cols-3 gap-2 pb-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Passenger</p>
              <p className="font-bold text-[#0A0A0A] text-[14px] truncate">{playerName}</p>
            </div>
            <div className="text-center min-w-0">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Pitch</p>
              <p className="font-bold text-[#0A0A0A] text-[14px] truncate">{pitchName}</p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">Payment</p>
              <p className="font-bold text-[14px] truncate">
                {isFullyPaid ? (
                  <span className="text-[#16845B]">Full Paid</span>
                ) : isAdvancePaid ? (
                  <span className="text-[#D97706]">Advance Paid</span>
                ) : (
                  <span className="text-[#DC2626]">Due at venue</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Perforated Ticket Divider with Clean Smooth Notches */}
        <div className="relative flex items-center w-full my-0 py-1 bg-[#FFFFFF]">
          <div className="ticket-notch w-3.5 h-6 rounded-r-full bg-[#0A0A0A] -ml-0 shrink-0" />
          <div className="flex-1 border-t-2 border-dashed border-[#E5E7EB] mx-2" />
          <div className="ticket-notch w-3.5 h-6 rounded-l-full bg-[#0A0A0A] -mr-0 shrink-0" />
        </div>

        {/* Lower Stub Section */}
        <div className="p-4 sm:p-5 bg-[#F9FAFB] flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          {/* Left Column: Platform & Payment Badges */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <h4 className="text-[14px] font-bold text-[#111827] tracking-tight mb-0.5">Booking Confirmed!</h4>

            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE]/80">
                <Ticket size={11} className="text-[#1E40AF]" />
                Total: ₹{totalAmount.toLocaleString('en-IN')}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]/80">
                <Check size={11} strokeWidth={3} className="text-[#065F46]" />
                Paid Online: ₹{paidAmount.toLocaleString('en-IN')}
              </span>
              {balanceDue > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                  <Clock size={11} className="text-[#991B1B]" />
                  Due at Venue: ₹{balanceDue.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]/80">
                  <Check size={11} strokeWidth={3} className="text-[#065F46]" />
                  Paid in Full
                </span>
              )}
            </div>

            <p className="text-[10px] text-[#6B7280]">Show QR at turf reception</p>
          </div>

          {/* Right Column: High-Res QR Code Card */}
          <div className="flex flex-col items-center shrink-0">
            {activeBooking?.status === 'completed' ? (
              <div
                className="bg-[#FFFFFF] p-2 rounded-2xl shadow-xs border border-emerald-300 relative flex flex-col items-center justify-center w-[112px] h-[112px] sm:w-[124px] sm:h-[124px] overflow-hidden select-none"
                title="Slot Completed"
              >
                <div className="absolute inset-0 bg-emerald-50 flex flex-col items-center justify-center text-center p-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-0.5 shadow-xs">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-800 leading-tight">
                    Completed
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="bg-[#FFFFFF] p-2 rounded-2xl shadow-xs border border-[#E5E7EB] cursor-pointer hover:border-[#D1D5DB] transition-all hover:shadow-sm"
                onClick={() => setShowFullQr(true)}
                title="Click to expand QR"
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Booking QR Code"
                    className="w-[136px] h-[136px] sm:w-[152px] sm:h-[152px] object-contain rounded-lg block"
                  />
                ) : (
                  <div className="w-[136px] h-[136px] sm:w-[152px] sm:h-[152px] flex items-center justify-center bg-[#F3F4F6] rounded-lg">
                    <QrCode size={36} className="text-[#9CA3AF] animate-pulse" />
                  </div>
                )}
              </div>
            )}
            {/* Prominent Ticket ID badge */}
            <div className="mt-1.5 flex flex-col items-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">Ticket ID</span>
              <span className="font-mono text-[11px] sm:text-xs font-black text-[#0A0A0A] bg-[#FFFFFF] px-2 py-0.5 rounded-md border border-[#D1D5DB] shadow-xs select-all">
                {shortId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeBooking?.status !== 'completed') setShowFullQr(true);
              }}
              disabled={activeBooking?.status === 'completed'}
              className="text-[10px] font-medium text-[#6B7280] text-center mt-1.5 hover:text-[#111827] transition-colors"
            >
              {activeBooking?.status === 'completed' ? 'Ticket completed' : 'Tap to view full QR'}
            </button>
          </div>
        </div>

        {/* Bottom Accent Line */}
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,#F0554A_0%,#E73229_50%,#FA8C16_100%)] shrink-0" />
      </div>

      {/* Action Buttons Below Ticket */}
      <div className="w-full max-w-[380px] mt-5 flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleShareTicket}
          className="w-full bg-[#0A0A0A] hover:bg-[#262626] text-[#FFFFFF] h-[50px] rounded-[14px] font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Share2 size={17} /> Share Ticket
        </button>
          <button
            type="button"
            onClick={handleSaveTicket}
            disabled={isSaving}
            className="w-full bg-[#0A0A0A] hover:bg-[#262626] disabled:opacity-60 disabled:cursor-not-allowed text-[#FFFFFF] h-[50px] rounded-[14px] font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {isSaving ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Download size={17} />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
        {shareMessage && <p className="text-center text-xs font-semibold text-[#16845B]">{shareMessage}</p>}

        <button
          type="button"
          onClick={onHome}
          className="w-full text-[#5C5C5C] hover:text-[#0A0A0A] py-3 rounded-[14px] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          Back to Home
        </button>
      </div>

      {/* Real-time Toast Banner for Ticket */}
      {ticketToast && (
        <div className="fixed bottom-5 right-5 left-5 sm:left-auto z-[250] max-w-sm bg-[#FFFFFF] text-[#0A0A0A] rounded-[14px] p-4 shadow-[0_8px_24px_rgba(23,23,23,0.12)] border border-neutral-200 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              ticketToast.type === 'alert'
                ? 'bg-[rgba(179,38,30,0.12)] text-[#DC2626]'
                : 'bg-[rgba(22,132,91,0.12)] text-[#16845B]'
            }`}
          >
            {ticketToast.type === 'alert' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-[#0A0A0A]">{ticketToast.title}</h4>
            <p className="text-xs text-[#5C5C5C] mt-0.5 leading-relaxed">{ticketToast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setTicketToast(null)}
            className="text-[#9CA3AF] hover:text-[#0A0A0A] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Expanded QR Modal */}
      {showFullQr && (
        <div
          className="fixed inset-0 z-[200] bg-[#0A0A0A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowFullQr(false)}
        >
          <div
            className="bg-[#FFFFFF] p-4 rounded-3xl w-full max-w-sm flex flex-col items-center border border-neutral-200 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center w-full mb-3">
              <h3 className="font-bold text-[#0A0A0A] text-base">Turf Entrance Pass</h3>
              <span className="text-xs font-mono font-bold text-[#6B7280]">{shortId}</span>
            </div>
            <div className="p-3 bg-[#FFFFFF] rounded-2xl border border-neutral-200 shadow-inner">
              {activeBooking?.status === 'completed' ? (
                <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg">
                  <CheckCircle2 size={32} />
                  <span className="text-sm font-bold">Completed</span>
                </div>
              ) : qrDataUrl ? (
                <img src={qrDataUrl} alt="Booking QR" className="w-[280px] h-[280px] object-contain rounded-lg block" />
              ) : (
                <div className="w-[280px] h-[280px] flex items-center justify-center bg-[#F3F4F6] rounded-lg">
                  <QrCode size={64} className="text-[#9CA3AF] animate-pulse" />
                </div>
              )}
            </div>
            <p className="text-xs text-[#6B7280] font-medium mt-3 text-center">
              Scan with the owner QGo Scanner at the gate
            </p>
            <button
              type="button"
              className="mt-5 w-full bg-[#0A0A0A] hover:bg-[#262626] text-[#FFFFFF] py-2.5 rounded-full font-bold text-xs transition-colors"
              onClick={() => setShowFullQr(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingView({ onViewTicket }: { onViewTicket?: (b: any) => void }) {
  useQbiScreen('booking');
  const { user } = useAuth();
  const cached = getCachedApiData<{ bookings: any[] }>('bookings:');
  const [bookings, setBookings] = useState<any[]>(() => cached?.bookings || []);
  const [loading, setLoading] = useState(() => !cached?.bookings?.length);
  const [activeTab, setActiveTab] = useState<'upcoming'|'past'>('upcoming');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'turf' | 'salon'>('all');
  const [reviewBooking, setReviewBooking] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setBookings([]);
      return;
    }
    let active = true;
    const refreshBookings = () => {
      api.getBookings().then((res) => {
        if (active) {
          setBookings(res.bookings || []);
          setLoading(false);
        }
      }).catch((error) => {
        if (active) setLoading(false);
        if (import.meta.env.DEV) console.warn('[QGo Customer] Could not refresh bookings', error);
      });
    };
    refreshBookings();
    const interval = window.setInterval(() => {
      if (!document.hidden) refreshBookings();
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

  const handleOpenReview = (b: any) => {
    setReviewBooking(b);
    setReviewRating(5);
    setReviewComment('');
  };

  const handleSubmitReview = async () => {
    if (!reviewBooking) return;
    setSubmittingReview(true);
    try {
      const res = await api.submitReview({
        bookingId: reviewBooking.id,
        salonId: reviewBooking.salonId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (res && res.success) {
        setToastMsg('Thank you! Your verified review has been published.');
        setTimeout(() => setToastMsg(null), 3000);
        setReviewBooking(null);
      } else {
        alert(res?.error || 'Failed to submit review');
      }
    } catch (e: any) {
      alert(e?.message || 'Error submitting review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const isFinished = b.status === 'completed' || b.status === 'cancelled';
    const matchesTiming = activeTab === 'past' ? isFinished : !isFinished;
    if (!matchesTiming) return false;

    if (categoryFilter === 'turf') {
      return isTurfBusiness(b.category) || Boolean(b.resourceId);
    } else if (categoryFilter === 'salon') {
      return !isTurfBusiness(b.category) && !b.resourceId;
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#F7F7F7] px-5 pt-8 pb-32">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#121318] text-white px-4 py-2 rounded-2xl shadow-xl text-xs font-bold border border-white/10 animate-in fade-in">
          {toastMsg}
        </div>
      )}

      <h2 className="text-2xl font-bold text-[#0A0A0A] tracking-tight mb-4">My Bookings</h2>

      {/* Turf vs Salon Category Filter */}
      <div className="flex bg-[#EFEFEF] rounded-2xl p-1 mb-3 text-xs font-bold shadow-2xs">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            categoryFilter === 'all' ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-xs' : 'text-[#5C5C5C]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setCategoryFilter('turf')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            categoryFilter === 'turf' ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-xs' : 'text-[#5C5C5C]'
          }`}
        >
          Turf Matches
        </button>
        <button
          onClick={() => setCategoryFilter('salon')}
          className={`flex-1 py-1.5 rounded-xl transition-all ${
            categoryFilter === 'salon' ? 'bg-[#FFFFFF] text-[#0A0A0A] shadow-xs' : 'text-[#5C5C5C]'
          }`}
        >
          Salon Bookings
        </button>
      </div>

      {/* Timing Tabs */}
      <div className="flex bg-[#FFFFFF] rounded-full p-1 shadow-xs border border-[rgba(10,10,10,0.10)] mb-6 relative z-10">
        <button className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'upcoming' ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] shadow-sm' : 'text-[#5C5C5C] hover:text-[#0A0A0A]'}`} onClick={() => setActiveTab('upcoming')}>Upcoming</button>
        <button className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'past' ? 'bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] shadow-sm' : 'text-[#5C5C5C] hover:text-[#0A0A0A]'}`} onClick={() => setActiveTab('past')}>Past</button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && bookings.length === 0 && (
          <QGoLoader variant="container" minHeight="220px" text="Fetching your bookings…" />
        )}
        {!loading && filteredBookings.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <Qbi mood="waiting" size={96} />
            <div className="w-16 h-16 bg-[#FFFFFF] rounded-full flex items-center justify-center mb-4 shadow-sm border border-[rgba(10,10,10,0.10)]"><CalendarDays size={24} className="text-[#E73229]" /></div>
            <p className="text-[#5C5C5C] font-semibold text-sm">No {categoryFilter !== 'all' ? `${categoryFilter} ` : ''}{activeTab} bookings found.</p>
          </div>
        )}
        {!loading && filteredBookings.map((b) => (
          <article key={b.id} className="bg-[#FFFFFF] rounded-2xl p-4 shadow-sm border border-[rgba(10,10,10,0.10)] space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#0A0A0A] text-base tracking-tight">{b.salonName || 'Venue'}</h3>
                  {b.status === 'completed' && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ Completed
                    </span>
                  )}
                  {b.status === 'confirmed' && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Confirmed
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-[#B3231B] bg-[#FDECEA] px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 mt-1.5">
                  <Clock size={12}/>
                  {b.scheduledDate ? formatDateIST(b.scheduledDate) : 'Scheduled Date'} • {b.scheduledTime || b.startTime || '-'}
                </p>
              </div>
              <div className="bg-[#F7F7F7] px-2.5 py-1.5 rounded-lg text-right border border-[rgba(10,10,10,0.10)]">
                <p className="text-[11px] font-bold text-[#5C5C5C] uppercase">{b.paymentStatus === 'paid' ? 'Paid' : 'Due'}</p>
                <p className="text-xs font-bold text-[#0A0A0A]">₹{b.totalAmount || b.price || b.amount || '0'}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(b.salonName || 'Turf')}`, '_blank')}
                className="flex-1 bg-[#FFFFFF] text-[#0A0A0A] border border-[rgba(10,10,10,0.20)] py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-[#F7F7F7] cursor-pointer"
              >
                Directions
              </button>
              <button
                onClick={() => onViewTicket && onViewTicket(b)}
                className="flex-1 bg-[linear-gradient(180deg,#1C1C1E_0%,#0A0A0A_100%)] text-[#FFFFFF] py-2.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-95 cursor-pointer"
              >
                Ticket
              </button>
              {(b.status === 'completed' || b.status === 'confirmed') && (
                <button
                  onClick={() => handleOpenReview(b)}
                  className="px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  title="Write Review"
                >
                  <Star size={13} className="fill-white" />
                  <span>Rate</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Review Submission Modal */}
      {reviewBooking && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#E73229] uppercase tracking-wider block">Customer Review</span>
                <h3 className="font-black text-base text-[#0A0A0A]">{reviewBooking.salonName || 'Venue'}</h3>
              </div>
              <button onClick={() => setReviewBooking(null)} className="p-1 rounded-full hover:bg-zinc-100 text-zinc-500">
                <X size={18} />
              </button>
            </div>

            <div className="text-center py-2">
              <p className="text-xs text-zinc-500 mb-2">How was your match / visit?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 cursor-pointer transition hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300'}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-extrabold text-amber-600 block mt-1">
                {reviewRating === 5 ? '5.0 - Excellent!' : reviewRating === 4 ? '4.0 - Very Good' : reviewRating === 3 ? '3.0 - Average' : reviewRating === 2 ? '2.0 - Poor' : '1.0 - Terrible'}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-700 block mb-1">Your Feedback (Optional):</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share details about turf surface, lighting, seating, or hospitality..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReview}
                onClick={handleSubmitReview}
                className="flex-1 py-2.5 rounded-xl bg-[#E73229] hover:bg-[#BA070D] disabled:opacity-50 text-white text-xs font-bold shadow-sm"
              >
                {submittingReview ? 'Publishing...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ProfileView and subviews (AccountSubView, RefundsSubView, SupportSubView, PrivacySubView, TermsSubView) extracted to ./components/profile

function FavoritesView({ venues, favorites, onToggleFavorite, onSelectVenue }: { venues: any[], favorites: string[], onToggleFavorite: (name: string) => void, onSelectVenue: (v: any) => void }) {
  useQbiScreen('favorites');
  const favVenues = venues.filter(v => favorites.includes(v.name));

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#F7F7F7] px-5 pt-8 pb-32">
      <h2 className="text-2xl font-bold text-[#0A0A0A] tracking-tight mb-6">Favourite Venues</h2>
      <div className="flex flex-col gap-4">
        {favVenues.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#FFFFFF] border border-[rgba(10,10,10,0.10)] rounded-full flex items-center justify-center mb-4 shadow-sm"><Heart size={24} className="text-[#E73229]" /></div>
            <p className="text-[#5C5C5C] font-semibold text-sm">You haven't saved any venues yet.</p>
          </div>
        )}
        {favVenues.map((venue) => (
          <article key={venue.name} className="bg-[#FFFFFF] rounded-2xl p-4 shadow-xs border border-[rgba(10,10,10,0.10)] cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectVenue(venue)}>
            <div className="flex justify-between items-start mb-2.5 px-1">
              <div>
                <h3 className="font-bold text-[#0A0A0A] text-base tracking-tight leading-snug mb-1">{venue.name}</h3>
                <div className="flex items-start gap-1">
                  <MapPin size={13} className="text-[#E73229] mt-[2px] shrink-0" />
                  <p className="text-xs text-[#5C5C5C] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-[#FDECEA] px-2 py-1 rounded-full shrink-0 border border-[#F39887]/30">
                <Star size={12} className="fill-[#E73229] text-[#E73229]" />
                <span className="text-xs font-bold text-[#B3231B]">4.5</span>
              </div>
            </div>
            
            <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3 shadow-inner">
              <img src={venue.image || DEFAULT_TURF_PHOTO} alt={venue.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-[#FFFFFF] rounded-full flex items-center justify-center shadow-md hover:bg-[#F7F7F7] transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFavorite(venue.name); }}>
                <Heart size={16} strokeWidth={2.5} className="fill-[#E73229] text-[#E73229]" />
              </button>
            </div>
            
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#5C5C5C] uppercase tracking-wide">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CFCFCF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                Sports <span className="text-[#767676]">•</span> Turf
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
