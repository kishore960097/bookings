import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, ChevronDown, ChevronRight, CircleDollarSign, Globe2, Heart, Home, Info, LockKeyhole, LogOut, MapPin, Search, SlidersHorizontal, Ticket, UserRound, UserCircle, Headphones, ClipboardCheck, Phone, Star, Receipt, Wallet, CreditCard, ShieldCheck, Zap, Clock, Check, ChevronLeft, Crosshair, IndianRupee, Sun, Moon, QrCode, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { isTurfBusiness, Salon } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LiquidBottomNav, CustomerTabKey } from '../../components/navigation/LiquidBottomNav';
import { useQbi, useQbiScreen, classifyBookingFailure, Qbi } from '../../components/qbi';

const sports = [
  { name: 'Football', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=260&q=80' },
  { name: 'Cricket', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=260&q=80' },
  { name: 'Basketball', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=260&q=80' },
  { name: 'Swimming', color: '#FFFFFF', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=260&q=80' },
];

type BookingDraft = { date: string; startTime: string; endTime: string; format: string; pitches: number; players: number; customerName?: string; customerPhone?: string; notes?: string; price?: number; paymentType?: 'FULL' | 'ADVANCE' | 'BOTH'; advanceAmount?: number };

export function CustomerPage({ onOpenNotifications, onLogout }: { onOpenNotifications?: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [activeTab, setActiveTab] = useState<'home' | 'turf' | 'booking' | 'favorites' | 'profile'>('home');
  const [selectedVenue, setSelectedVenueState] = useState<{ id: string; name: string; address: string; image: string; sports: string } | null>(() => {
    const saved = sessionStorage.getItem('qgo_venue');
    return saved ? JSON.parse(saved) : null;
  });
  const setSelectedVenue = (venue: any) => {
    setSelectedVenueState(venue);
    if (venue) sessionStorage.setItem('qgo_venue', JSON.stringify(venue));
    else sessionStorage.removeItem('qgo_venue');
  };

  const [bookingStep, setBookingStep] = useState<'detail' | 'slot' | 'summary' | 'payment' | 'paid' | 'ticket'>(() => {
    const savedStep = sessionStorage.getItem('qgo_bs');
    return savedStep === 'paid' ? 'ticket' : ((savedStep as 'detail' | 'slot' | 'summary' | 'payment' | 'ticket' | null) || 'detail');
  });
  useEffect(() => { sessionStorage.setItem('qgo_bs', bookingStep); }, [bookingStep]);

  const [bookingDraft, setBookingDraftState] = useState<BookingDraft>(() => {
    const saved = sessionStorage.getItem('qgo_draft');
    return saved ? JSON.parse(saved) : { date: '', startTime: '', endTime: '', format: 'Box Cricket', pitches: 1, players: 10 };
  });
  const setBookingDraft = (draft: any) => {
    setBookingDraftState(draft);
    sessionStorage.setItem('qgo_draft', JSON.stringify(draft));
  };

  const [createdBooking, setCreatedBookingState] = useState<any>(() => {
    const saved = sessionStorage.getItem('qgo_booking');
    return saved ? JSON.parse(saved) : null;
  });
  const setCreatedBooking = (booking: any) => {
    setCreatedBookingState(booking);
    if (booking) sessionStorage.setItem('qgo_booking', JSON.stringify(booking));
    else sessionStorage.removeItem('qgo_booking');
  };

  const [showBottomNav, setShowBottomNav] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('qgo_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggleFavorite = (venueName: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(venueName) ? prev.filter(name => name !== venueName) : [...prev, venueName];
      localStorage.setItem('qgo_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const lastScrollY = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollFrame.current !== undefined) return;
      scrollFrame.current = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY.current + 4) setShowBottomNav((visible) => visible ? false : visible);
        if (currentScrollY < lastScrollY.current - 4) setShowBottomNav((visible) => visible ? visible : true);
        lastScrollY.current = currentScrollY;
        scrollFrame.current = undefined;
      });
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setShowBottomNav(true), 180);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      if (scrollFrame.current !== undefined) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  const [loading, setLoading] = useState(true);

  const [userLocation, setUserLocation] = useState(() => {
    try {
      return localStorage.getItem('qgo_user_location') || 'All Locations';
    } catch {
      return 'All Locations';
    }
  });

  // Save location to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('qgo_user_location', userLocation);
    } catch {
      // ignore
    }
  }, [userLocation]);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isPersonalizedModalOpen, setIsPersonalizedModalOpen] = useState(false);
  const [isMapView, setIsMapView] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Extract unique locations from all salons for auto-suggest
  const suggestedLocations = useMemo(() => {
    const locs = new Set<string>();
    salons.forEach(s => {
      if (s.city) locs.add(s.city.trim());
    });
    const all = Array.from(locs);
    if (!locationSearch) return all;
    return all.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()));
  }, [salons, locationSearch]);

  const handleGetCurrentLocation = async () => {
    setIsLocating(true);

    const resolveWithIP = async () => {
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.city) {
            setUserLocation(ipData.city);
            return true;
          }
        }
      } catch {
        // ignore
      }
      return false;
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const res = await api.reverseGeocode(position.coords.latitude, position.coords.longitude);
            if (res.success && (res.city || res.address)) {
              const cleanCity = res.city || res.address.split(',')[0].trim();
              setUserLocation(cleanCity);
            } else {
              const ipResolved = await resolveWithIP();
              if (!ipResolved) setUserLocation('Current Location');
            }
          } catch {
            const ipResolved = await resolveWithIP();
            if (!ipResolved) setUserLocation('Current Location');
          } finally {
            setIsLocating(false);
            setIsLocationModalOpen(false);
            setIsMapView(false);
          }
        },
        async () => {
          // GPS denied or timed out -> silently fallback to IP location
          const ipResolved = await resolveWithIP();
          if (!ipResolved) {
            if (suggestedLocations.length > 0) {
              setUserLocation(suggestedLocations[0]);
            } else {
              setUserLocation('All Locations');
            }
          }
          setIsLocating(false);
          setIsLocationModalOpen(false);
          setIsMapView(false);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
      );
    } else {
      const ipResolved = await resolveWithIP();
      if (!ipResolved) setUserLocation('All Locations');
      setIsLocating(false);
      setIsLocationModalOpen(false);
      setIsMapView(false);
    }
  };

  useEffect(() => {
    let active = true;
    api.getSalons().then((result) => { if (active) setSalons(result.salons || []); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const venues = useMemo(() => {
    const apiVenues = salons
      .filter((salon) => isTurfBusiness(salon.category, salon.bookingMode))
      .map((salon) => {
      const fullAddress = [salon.address, salon.city].filter(Boolean).join(', ');

      return {
        id: salon.id,
        name: salon.name,
        address: fullAddress || 'Address unavailable',
        city: salon.city || '',
        distance: salon.distanceKm === undefined ? 'Distance unavailable' : `${salon.distanceKm.toFixed(1)} km`,
        image: salon.logoUrl || salon.coverUrl || '',
        sports: salon.category,
      };
    });

    const filtered = apiVenues.filter((venue) => {
      const matchQuery = `${venue.name} ${venue.address} ${venue.sports}`.toLowerCase().includes(query.toLowerCase());
      const matchSport = selectedSport === 'All Sports' || venue.sports.toLowerCase().includes(selectedSport.toLowerCase());
      // If searching, search globally. Otherwise match user location or show all if All/Current/Map
      const matchLocation =
        query.length > 0 ||
        userLocation === 'All Locations' ||
        userLocation === 'Current Location' ||
        userLocation === 'Map Selection' ||
        venue.address.toLowerCase().includes(userLocation.toLowerCase()) ||
        (venue.city && userLocation.toLowerCase().includes(venue.city.toLowerCase()));
      
      return matchQuery && matchSport && matchLocation;
    });

    // Resilient fallback: if user's specific city has 0 venues in db, don't leave customer with a blank screen
    if (filtered.length === 0 && userLocation !== 'All Locations' && query.length === 0) {
      return apiVenues.filter((venue) => selectedSport === 'All Sports' || venue.sports.toLowerCase().includes(selectedSport.toLowerCase()));
    }

    return filtered;
  }, [activeTab, salons, query, selectedSport, userLocation]);

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

  useQbiScreen(selectedVenue ? null : (activeTab === 'turf' ? 'turf' : activeTab === 'home' ? 'home' : null));

  if (selectedVenue) {
    if (bookingStep === 'slot') return <SlotSelectionView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('detail')} onContinue={(draft) => { setBookingDraft(draft); setBookingStep('summary'); }} />;
    if (bookingStep === 'summary') return <BookingSummaryView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('slot')} onContinue={() => { setBookingDraft({...bookingDraft, paymentType: undefined, advanceAmount: undefined}); setBookingStep('payment'); }} />;
    if (bookingStep === 'payment') return <PaymentView venue={selectedVenue} user={user} draft={bookingDraft} onBack={() => setBookingStep('summary')} onPaid={(booking) => { setCreatedBooking(booking); setBookingStep('paid'); window.setTimeout(() => setBookingStep('ticket'), 2500); }} />;
    if (bookingStep === 'paid') return <PaidView />;
    if (bookingStep === 'ticket') return <TicketView venue={selectedVenue} user={user} booking={createdBooking} draft={bookingDraft} onHome={() => { setSelectedVenue(null); setBookingStep('detail'); }} />;
    return <TurfDetailView venue={selectedVenue} onBack={() => setSelectedVenue(null)} onProceed={() => setBookingStep('slot')} />;
  }

  return (
    <main className="bg-[#F8F8F9] text-[var(--qp-text)] min-h-[100dvh] pb-[calc(8rem+env(safe-area-inset-bottom,0px))] font-sans relative" aria-label="Customer home">
      
      {/* --- HOME TAB --- */}
      {activeTab === 'home' && (
        <div className="flex flex-col w-full relative">
          {/* Header Area: Sleek Compact Liquid Glass */}
          <div
            className="sticky top-0 z-40 px-4 pt-3.5 pb-3 w-full border-b border-[rgba(11,11,11,0.12)] bg-white transition-opacity duration-150"
            style={{
              background: 'rgba(255, 255, 255, 0.65)',
              
              
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Top Bar */}
            <header className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-[#FCA311] rounded-xl flex items-center justify-center shadow-sm">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
                <span className="text-[20px] font-bold text-[#000000] tracking-tight">QGo</span>
              </div>
              
              <div className="flex items-center gap-2.5">
                <button type="button" className="relative p-1.5 rounded-full hover:bg-black/5 transition-colors" onClick={onOpenNotifications} title="Notifications">
                  <Bell size={20} className="text-[#000000] hover:opacity-80 transition-opacity" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[#FCA311] border-2 border-[rgba(11,11,11,0.12)] rounded-full"></span>
                </button>
              </div>
            </header>

            {/* Location & Auto-detect */}
            <div className="flex justify-between items-center mb-2.5">
              <div>
                <p className="text-[11px] font-bold text-[rgba(0,0,0,0.55)] tracking-wider mb-0.5 uppercase">Your Location</p>
                <div 
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setIsLocationModalOpen(true)}
                  title="Change Location"
                >
                  <MapPin size={17} className="text-[#FCA311]" />
                  <h2 className="text-[17px] font-bold text-[#000000] tracking-tight">{userLocation}</h2>
                  <ChevronDown size={15} className="text-[#000000] mt-0.5" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-white text-[11px] font-bold text-[#000000] border border-black/10 shadow-sm transition-colors duration-150 cursor-pointer"
                title="Fetch current location"
              >
                {isLocating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-[#FCA311] border-t-transparent rounded-full animate-spin"></span>
                    <span>Locating...</span>
                  </>
                ) : (
                  <>
                    <Crosshair size={13} className="text-[#FCA311]" />
                    <span>Auto Detect</span>
                  </>
                )}
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(0,0,0,0.55)]" />
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search venues, sports..." 
                  className="w-full bg-white border border-black/[0.08] rounded-2xl py-3 pl-11 pr-4 text-[13px] font-medium text-[#000000] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] focus:outline-none focus:border-[#FCA311] transition-colors duration-150 placeholder:text-[rgba(0,0,0,0.50)]"
                />
              </div>
              <button type="button" className="w-[46px] h-[46px] bg-white border border-black/[0.08] rounded-2xl flex items-center justify-center text-[#000000] hover:bg-black/5 transition-colors shrink-0 shadow-sm">
                <SlidersHorizontal size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Available Venues Section */}
          <div className="px-5 mb-6 mt-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-[#000000] tracking-tight">Available Venues</h2>
              </div>
            </div>
            
            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 snap-x">
              <button type="button" className="flex items-center gap-1.5 shrink-0 bg-[#FCA311] text-[#000000] px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start">
                <CalendarDays size={14} /> Today <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => setSelectedSport('All Sports')} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === 'All Sports' ? 'bg-[#FCA311] text-[#000000] border-[#FCA311]' : 'bg-white  text-[rgba(0,0,0,0.70)] border-black/[0.08] hover:bg-white'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> 
                All Sports <ChevronDown size={14} />
              </button>
              {['Cricket', 'Football', 'Tennis'].map((sport) => (
                <button key={sport} type="button" onClick={() => setSelectedSport(sport)} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === sport ? 'bg-[#FCA311] text-[#000000] border-[#FCA311]' : 'bg-white  text-[rgba(0,0,0,0.70)] border-black/[0.08] hover:bg-white'}`}>
                  {sport}
                </button>
              ))}
            </div>

            {/* Venues List: Liquid Box Cards */}
            <div className="flex flex-col gap-4">
              {loading && <p className="text-center py-8 text-[rgba(0,0,0,0.70)] font-bold text-sm">Loading venues...</p>}
              {!loading && venues.length === 0 && <p className="text-center py-8 text-[rgba(0,0,0,0.70)] font-bold text-sm">No venues match your search.</p>}
              {venues.map((venue) => (
                <article
                  key={venue.name}
                  className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#0B0B0B] hover:border-[#FCA311]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.09)] cursor-pointer transition-opacity duration-150"
                  onClick={() => setSelectedVenue(venue)}
                >
                  <div className="flex justify-between items-start mb-2.5 px-0.5">
                    <div>
                      <h3 className="font-bold text-[#000000] text-[17px] tracking-tight leading-snug mb-1">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={13} className="text-[#FCA311] mt-[2px] shrink-0" />
                        <p className="text-[11px] text-[rgba(0,0,0,0.65)] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {userLocation !== 'All Locations' && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[11px] font-bold text-[#000000] bg-[#FCA311]/25 px-2 py-0.5 rounded-full uppercase tracking-wider">{venue.distance || '1.2 km'} Away</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-[#FCA311]/20 px-2.5 py-1 rounded-full shrink-0 border border-[#FCA311]/30">
                      <Star size={12} className="fill-[#FCA311] text-[#FCA311]" />
                      <span className="text-[11px] font-black text-[#000000]">4.5</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[155px] rounded-xl overflow-hidden mb-3 shadow-inner">
                    <img src={venue.image} alt={venue.name} className="w-full h-full object-cover transition-transform duration-500" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors" onClick={(e) => { e.stopPropagation(); toggleFavorite(venue.name); }}>
                      <Heart size={16} strokeWidth={2.5} className={favorites.includes(venue.name) ? "fill-[#FCA311] text-[#FCA311]" : "text-[rgba(0,0,0,0.70)]"} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-0.5 pt-1 border-t border-black/[0.05]">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[rgba(0,0,0,0.65)] uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-[rgba(0,0,0,0.40)]">•</span> Turf
                    </div>
                    <div className="flex items-center gap-2 text-[#000000]">
                      <span className="text-xs font-bold text-[#FCA311] bg-black px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-[#FCA311] hover:text-black transition-colors">
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
          <h2 className="text-[22px] font-black text-[#000000] tracking-tight mb-4">All Turfs</h2>
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(0,0,0,0.70)]" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search venues, sports..." 
              className="w-full bg-[#E5E5E5] rounded-[14px] py-3.5 pl-11 pr-4 text-[13px] font-medium text-[#000000] shadow-sm border border-[rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[var(--qp-primary)]/20 placeholder:text-[rgba(0,0,0,0.60)]"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-4 snap-x">
             <button type="button" onClick={() => setSelectedSport('All Sports')} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === 'All Sports' ? 'bg-[var(--qp-primary)] text-[#000000] border-[var(--qp-primary)]' : 'bg-[#FFFFFF] text-[rgba(0,0,0,0.70)] border-[rgba(0,0,0,0.12)] hover:bg-[rgba(0,0,0,0.05)]'}`}>All Sports</button>
             {['Cricket', 'Football', 'Tennis'].map((sport) => (
                <button key={sport} type="button" onClick={() => setSelectedSport(sport)} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === sport ? 'bg-[var(--qp-primary)] text-[#000000] border-[var(--qp-primary)]' : 'bg-[#FFFFFF] text-[rgba(0,0,0,0.70)] border-[rgba(0,0,0,0.12)] hover:bg-[rgba(0,0,0,0.05)]'}`}>
                  {sport}
                </button>
              ))}
          </div>
          
          <div className="flex flex-col gap-5 mt-2">
            {loading && <p className="text-center py-8 text-[rgba(0,0,0,0.70)] font-bold text-sm">Loading venues...</p>}
            {!loading && venues.length === 0 && <p className="text-center py-8 text-[rgba(0,0,0,0.70)] font-bold text-sm">No venues match your search.</p>}
            {venues.map((venue) => (
              <article key={venue.name} className="bg-[#FFFFFF] rounded-[1.25rem] p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.12)] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedVenue(venue)}>
                  <div className="flex justify-between items-start mb-2.5 px-1">
                    <div>
                      <h3 className="font-black text-[#000000] text-[17px] uppercase tracking-tight leading-none mb-1.5">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-[rgba(0,0,0,0.70)] mt-[2px] shrink-0" />
                        <p className="text-[11px] text-[rgba(0,0,0,0.70)] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {userLocation !== 'All Locations' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[11px] font-bold text-[var(--qp-primary)] bg-[var(--qp-primary-soft)] px-1.5 py-0.5 rounded uppercase tracking-wider">{venue.distance || '1.2 km'} Away</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-[var(--qp-primary-soft)] px-2 py-1 rounded-full shrink-0">
                      <Star size={12} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
                      <span className="text-[11px] font-black text-[#000000]">4.0</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3">
                    <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-[#FFFFFF] rounded-full flex items-center justify-center text-[var(--qp-primary)] shadow-md hover:bg-[var(--qp-primary-soft)] transition-colors" onClick={(e) => { e.stopPropagation(); /* handle favorite */ }}>
                      <Heart size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[rgba(0,0,0,0.70)] uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-[rgba(0,0,0,0.60)]">•</span> Turf
                    </div>
                  </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'booking' && <BookingView onViewTicket={(b) => {
        setSelectedVenue({ id: b.salonId, name: b.salonName, address: '', image: '', sports: '' });
        setBookingDraft({ date: b.scheduledDate, startTime: b.scheduledTime, endTime: b.slotEndTime, format: b.serviceName || 'Booking', pitches: 1, players: b.numberOfPlayers || 10, price: b.totalAmount || b.price });
        setCreatedBooking(b);
        setBookingStep('ticket');
      }} />}
      {activeTab === 'profile' && <ProfileView onLogout={onLogout} />}
      {activeTab === 'favorites' && <FavoritesView venues={venues} favorites={favorites} onToggleFavorite={toggleFavorite} onSelectVenue={setSelectedVenue} />}

      <LiquidBottomNav
        activeTab={activeTab}
        onTabChange={(tab: CustomerTabKey) => {
          setActiveTab(tab);
          if (tab === 'home' || tab === 'turf') {
            setSelectedSport('All Sports');
          }
        }}
        onPlusClick={() => setIsPersonalizedModalOpen(true)}
        visible={showBottomNav}
      />

      {/* --- PERSONALIZED TURF HUB (CENTER PLUS BUTTON MODAL) --- */}
      {isPersonalizedModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-[#0B0B0B]/50 animate-in fade-in"
          onClick={() => setIsPersonalizedModalOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white rounded-t-[2rem] p-5 sm:p-6 shadow-2xl border-t border-black/10 flex flex-col animate-in slide-in-from-bottom-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-black/15 rounded-full mx-auto mb-4" />

            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#000000] bg-[#FCA311] px-2.5 py-0.5 rounded-full">
                  Quick Actions
                </span>
                <h3 className="text-xl font-black text-[#000000] tracking-tight mt-1.5">Personalized Turf Hub</h3>
              </div>
              <button
                onClick={() => setIsPersonalizedModalOpen(false)}
                className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black font-bold text-sm transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[rgba(0,0,0,0.65)] mb-4 font-medium leading-relaxed">
              Book a slot instantly, add your favorite home turf, or explore sports activities in one tap.
            </p>

            <div className="space-y-3 mb-5">
              {/* Option 1: Quick Book Turf */}
              <button
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  if (venues.length > 0) {
                    setSelectedVenue(venues[0]);
                    setBookingStep('slot');
                  }
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#FCA311] hover:bg-[#FCA311]/90 text-black text-left shadow-md transition-colors duration-150 active:scale-[0.98] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-black text-[#FCA311] flex items-center justify-center shrink-0">
                  <Ticket size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm text-[#000000]">Quick Book Turf Slot</h4>
                  <p className="text-[11px] font-semibold text-black/80 truncate">
                    Instant slot booking at {venues[0]?.name || 'top venue'}
                  </p>
                </div>
                <ArrowRight size={18} className="text-black shrink-0" />
              </button>

              {/* Option 2: Explore & Add All Turfs */}
              <button
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  setActiveTab('turf');
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white hover:bg-black/5 text-black border border-black/10 text-left shadow-sm transition-colors duration-150 active:scale-[0.98] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FCA311]/20 text-[#000000] flex items-center justify-center shrink-0 border border-[#FCA311]/30">
                  <Search size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[#000000]">Browse & Add Turfs</h4>
                  <p className="text-[11px] text-[rgba(0,0,0,0.60)] font-medium">
                    Filter by sport, location, distance, and rating
                  </p>
                </div>
                <ChevronRight size={18} className="text-[rgba(0,0,0,0.50)] shrink-0" />
              </button>

              {/* Option 3: Pin Favorite / Set Home Turf */}
              <button
                onClick={() => {
                  setIsPersonalizedModalOpen(false);
                  setActiveTab('favorites');
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white hover:bg-black/5 text-black border border-black/10 text-left shadow-sm transition-colors duration-150 active:scale-[0.98] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FCA311]/20 text-[#000000] flex items-center justify-center shrink-0 border border-[#FCA311]/30">
                  <Heart size={20} strokeWidth={2.5} className="fill-[#FCA311] text-[#FCA311]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-[#000000]">My Pinned & Saved Turfs</h4>
                  <p className="text-[11px] text-[rgba(0,0,0,0.60)] font-medium">
                    {favorites.length} saved turf{favorites.length !== 1 ? 's' : ''} in your collection
                  </p>
                </div>
                <ChevronRight size={18} className="text-[rgba(0,0,0,0.50)] shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LOCATION SELECTOR MODAL --- */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#FFFFFF] p-4 pt-20 animate-in fade-in">
          <div className="flex-1 bg-[#FFFFFF] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 relative">
            <div className="p-4 border-b border-[rgba(0,0,0,0.12)] flex items-center justify-between z-10 bg-[#FFFFFF]">
              <div className="flex items-center gap-2">
                {isMapView && (
                  <button onClick={() => setIsMapView(false)} className="p-2 -ml-2 rounded-full hover:bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.70)]">
                    <ArrowLeft size={18} strokeWidth={2.5} />
                  </button>
                )}
                <h3 className="font-black text-[#000000]">{isMapView ? 'Select on Map' : 'Select Location'}</h3>
              </div>
              <button onClick={() => { setIsLocationModalOpen(false); setIsMapView(false); }} className="p-2 rounded-full bg-[#FFFFFF] text-[rgba(0,0,0,0.70)]">
                <span className="sr-only">Close</span>
                X
              </button>
            </div>
            
            {isMapView ? (
              <div className="flex-1 relative flex flex-col bg-[#FFFFFF]">
                <div className="absolute inset-0 z-0">
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80" alt="Map" className="w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 bg-[var(--qp-primary)]/10 mix-blend-color"></div>
                </div>
                
                {/* Center Pin */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
                  <div className="bg-[#FFFFFF] text-[#000000] text-[11px] font-bold px-3 py-1.5 rounded-full mb-1 shadow-md">
                    Move map to adjust
                  </div>
                  <MapPin size={40} className="text-[var(--qp-primary)] drop-shadow-md -mt-2 fill-white" />
                </div>

                <div className="mt-auto p-4 z-10 bg-[#FFFFFF] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.12)]">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--qp-primary-soft)] flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-[var(--qp-primary)]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#000000] text-sm">Selected Location</h4>
                      <p className="text-xs text-[rgba(0,0,0,0.70)] font-medium">Pin drop location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setUserLocation('Map Selection');
                      setIsLocationModalOpen(false);
                      setIsMapView(false);
                    }}
                    className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-[#000000] p-3.5 rounded-xl font-bold transition-colors shadow-md"
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-[rgba(0,0,0,0.12)]">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(0,0,0,0.70)]" />
                    <input
                      type="text"
                      placeholder="Search city or neighborhood..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-[rgba(0,0,0,0.12)] bg-[#FFFFFF] text-sm font-semibold text-[rgba(0,0,0,0.70)] focus:outline-none focus:ring-2 focus:ring-[var(--qp-primary)]"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={() => {
                      setUserLocation('All Locations');
                      setIsLocationModalOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl mb-2 transition-colors ${userLocation === 'All Locations' ? 'bg-[var(--qp-primary)]/10 text-[var(--qp-primary)]' : 'hover:bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.70)]'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#FFFFFF] flex items-center justify-center shrink-0">
                      <Globe2 size={18} className={userLocation === 'All Locations' ? 'text-[var(--qp-primary)]' : 'text-[rgba(0,0,0,0.70)]'} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">All Locations</p>
                      <p className="text-[11px] text-[rgba(0,0,0,0.70)] font-semibold">Search everywhere</p>
                    </div>
                    {userLocation === 'All Locations' && <Check size={16} className="ml-auto text-[var(--qp-primary)]" />}
                  </button>

                  {suggestedLocations.map(loc => (
                    <button
                      key={loc}
                      onClick={() => {
                        setUserLocation(loc);
                        setIsLocationModalOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors ${userLocation === loc ? 'bg-[var(--qp-primary)]/10 text-[var(--qp-primary)]' : 'hover:bg-[rgba(0,0,0,0.05)] text-[rgba(0,0,0,0.70)]'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#FFFFFF] flex items-center justify-center shrink-0">
                        <MapPin size={18} className={userLocation === loc ? 'text-[var(--qp-primary)]' : 'text-[rgba(0,0,0,0.70)]'} />
                      </div>
                      <div className="text-left font-bold text-sm flex-1">{loc}</div>
                      {userLocation === loc && <Check size={16} className="text-[var(--qp-primary)]" />}
                    </button>
                  ))}
                  
                  {suggestedLocations.length === 0 && (
                    <div className="p-8 text-center text-[rgba(0,0,0,0.70)]">
                      <MapPin size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-semibold">No cities found matching "{locationSearch}"</p>
                      <button 
                        onClick={() => {
                          setUserLocation(locationSearch);
                          setIsLocationModalOpen(false);
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-[#FFFFFF] text-[rgba(0,0,0,0.70)] text-xs font-bold hover:bg-[rgba(0,0,0,0.05)]"
                      >
                        Search exactly for "{locationSearch}"
                      </button>
                    </div>
                  )}
                </div>

                {/* Select via current location feature */}
                <div className="p-4 border-t border-[rgba(0,0,0,0.12)] bg-[#FFFFFF] mt-auto shrink-0">
                  <button
                    onClick={handleGetCurrentLocation}
                    className="w-full flex items-center justify-center gap-2 bg-[#FFFFFF] hover:bg-[rgba(0,0,0,0.05)] text-[#000000] p-3.5 rounded-xl font-bold transition-colors shadow-[0_4px_15px_rgba(0,0,0,0.12)]"
                  >
                    <MapPin size={18} />
                    Use my current location
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
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
    <main className="bg-[#FFFFFF] min-h-[100dvh] pb-24 relative animate-in fade-in zoom-in-95" aria-label={`${name} details`}>
      {/* Hero Image */}
      <div className="relative h-[20vh] min-h-[140px] w-full">
        {(salon?.coverUrl || venue.image) ? <img src={salon?.coverUrl || venue.image} alt={`${name} turf`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#FFFFFF]" aria-label="No venue image available" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
        <button type="button" className="absolute top-4 left-4 w-8 h-8 bg-black/40 hover:bg-black/60 transition-colors rounded-full flex items-center justify-center text-[#000000] z-10" onClick={onBack} aria-label="Back to venues">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <button type="button" className="absolute top-4 right-4 w-8 h-8 bg-black/40 hover:bg-black/60 transition-colors rounded-full flex items-center justify-center text-[#000000] z-10" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div className="absolute bottom-4 right-4 flex gap-1 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,0,0,0.05)] shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,0,0,0.05)] shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,0,0,0.05)] shadow-sm"></div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-[#FFFFFF] rounded-t-[1.5rem] -mt-5 relative z-20 px-4 pt-4 pb-20 shadow-[0_-4px_10px_rgba(0,0,0,0.12)] flex flex-col gap-3">
        <div>
          <div className="flex justify-between items-start">
            <h1 className="text-[22px] leading-none font-black text-[#000000] uppercase">{name}</h1>
            <Heart size={20} className="text-[var(--qp-primary)]" />
          </div>
          <div className="flex items-start gap-1.5 mt-1">
            <MapPin size={14} className="text-[var(--qp-primary)] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[rgba(0,0,0,0.70)] leading-tight line-clamp-2">{address}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Star size={14} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
            <span className="font-bold text-[#000000] text-sm">{salon?.reviewCount ? salon.rating : 'New'}</span>
            <span className="text-[rgba(0,0,0,0.70)] text-[11px]">[{salon?.reviewCount || 0}]</span>
          </div>
        </div>

        <div className="flex gap-2.5 customer-turf-actions">
          <button type="button" className="bg-[#FCA311] hover:bg-[rgba(252, 163, 17, 0.88)] text-[#000000] px-5 py-2.5 rounded-[10px] font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-[13px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Get Direction
          </button>
          <button type="button" className="w-[42px] h-[42px] shrink-0 bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-[#000000] rounded-[10px] flex items-center justify-center shadow-sm transition-colors" aria-label="Call venue">
            <Phone size={18} strokeWidth={2.5} className="fill-white"/>
          </button>
        </div>

        {/* Highlight Cards */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x">
          <div className="min-w-[100px] snap-start flex-1 bg-[rgba(252, 163, 17, 0.15)] border border-[rgba(0,0,0,0.12)] rounded-lg p-2 flex items-start gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <div>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">Flexible offer</p>
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mt-0.5">{salon?.bookingSettings?.cancellationPolicy || 'See booking policy'}</p>
            </div>
          </div>
          <div className="min-w-[100px] snap-start flex-1 bg-[rgba(252, 163, 17, 0.15)] border border-[rgba(0,0,0,0.12)] rounded-lg p-2 flex items-start gap-1.5">
            <CalendarDays size={12} className="text-[var(--qp-primary)] shrink-0 mt-0.5" strokeWidth={2.5}/>
            <div>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">Available slots</p>
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mt-0.5">View current availability</p>
            </div>
          </div>
          <div className="min-w-[100px] snap-start flex-1 bg-[rgba(252, 163, 17, 0.15)] border border-[rgba(0,0,0,0.12)] rounded-lg p-2 flex items-start gap-1.5">
            <ShieldCheck size={12} className="text-[var(--qp-primary)] shrink-0 mt-0.5" strokeWidth={2.5}/>
            <div>
              <p className="text-[11px] font-bold text-[#000000] leading-tight">Verified venue</p>
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mt-0.5">Listed on QGo</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mt-1">
          {/* Available Sports */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M12 9l2 3-1 6"/><path d="M14 12h4"/><path d="M7 11l4-2 3 5"/><path d="M5 22l4-5"/></svg>
              <h2 className="text-[13px] font-bold text-[#000000]">Sports</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {(salon?.resources?.length ? salon.resources.map((resource: any) => resource.name) : ['No resources configured']).map((sport: string, index: number) => (
                <button className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${index === 0 ? 'bg-[var(--qp-primary)] text-[#000000]' : 'bg-[#FFFFFF] text-[rgba(0,0,0,0.70)]'}`} type="button" key={sport}>{sport}</button>
              ))}
            </div>
          </div>

          {/* Venue Info */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Info size={14} className="text-[var(--qp-primary)] fill-[var(--qp-primary)] text-[#000000]" />
              <h2 className="text-[13px] font-bold text-[#000000]">Venue info</h2>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="bg-[var(--qp-primary)] text-[#000000] text-[11px] font-bold px-1.5 py-0.5 rounded-sm">Pitch</span>
                <span className="text-[11px] font-medium text-[#000000]">- {salon?.resources?.length || 1} Nets</span>
              </div>
              <div className="flex items-start gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M4 20h16"/><path d="M5 20V12l3 3 4-7 4 7 3-3v8"/></svg>
                <div>
                  <p className="text-[11px] font-bold text-[#000000] leading-tight">Equipment</p>
                  <p className="text-[11px] text-[rgba(0,0,0,0.70)] mt-0.5 line-clamp-1">{salon?.description || 'Details not provided'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="mt-1">
          <div className="flex items-center gap-1 mb-1.5">
            <Star size={14} className="text-[var(--qp-primary)] fill-[var(--qp-primary)]" />
            <h2 className="text-[13px] font-bold text-[#000000]">Amenities</h2>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(salon?.facilities || []).slice(0, 3).map((amenity: string) => (
              <div key={amenity} className="flex items-center gap-1.5 text-[11px] font-bold text-[rgba(0,0,0,0.70)]">
                <div className="w-3 h-3 bg-[var(--qp-primary)] rounded-sm flex items-center justify-center">
                   <Check size={8} className="text-[#000000]" strokeWidth={4} />
                </div>
                {amenity}
              </div>
            ))}
            {!salon?.facilities?.length && <p className="text-[11px] font-medium text-[rgba(0,0,0,0.70)]">No amenities listed.</p>}
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-[#FFFFFF] border-t border-[rgba(0,0,0,0.12)] z-50">
        <button type="button" className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-[#000000] py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 shadow-sm transition-colors duration-150" onClick={onProceed}>
          <CalendarDays size={16} strokeWidth={2.5}/> PROCEED TO SELECT A SLOT <ArrowRight size={16} strokeWidth={2.5}/>
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
  const [localDraft, setLocalDraft] = useState(draft);
  const [customerName, setCustomerName] = useState(draft.customerName || user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone || user?.phone || '');
  const [notes, setNotes] = useState(draft.notes || '');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [slotFilter, setSlotFilter] = useState<'all' | 'morning' | 'evening'>('all');

  useEffect(() => setLocalDraft(draft), [draft]);
  const date = localDraft.date || new Date().toISOString().split('T')[0];
  const [availability, setAvailability] = useState<{ slots: any[]; isOpen?: boolean; message?: string } | null>(null);
  
  useEffect(() => { 
    api.getAvailability(venue.id, { date, durationMinutes: 60, slotCategory: 'adult' } as any)
      .then(setAvailability)
      .catch(() => setAvailability({ slots: [] }));
  }, [venue.id, date]);

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
    setSelectedSlotIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isFormValid = selectedSlotIds.length > 0 && customerName.trim().length > 0 && customerPhone.trim().length > 0;

  const onContinue = () => {
    if (!isFormValid) return;
    const totalAdvance = selectedSlots.reduce((sum, slot) => sum + (slot.advanceAmount || 0), 0);
    
    const firstSlot = selectedSlots[0];
    onContinueDraft({ 
      ...localDraft, 
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
      const iso = d.toISOString().split('T')[0];
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
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none scroll-smooth animate-in fade-in" style={{ background: 'rgba(0, 0, 0, 0.4)',  }}>
      <div className="flex min-h-[100dvh] flex-col sm:items-center sm:justify-center p-0 sm:py-12 sm:px-6">
        <div className="bg-[#FFFFFF] w-full flex-1 sm:flex-none sm:max-w-2xl rounded-none sm:rounded-[1.5rem] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-[#FFFFFF] p-5 sm:p-6 pb-5 text-[#000000] relative rounded-t-[1.5rem] rounded-b-3xl border-b border-[rgba(0,0,0,0.08)] shadow-[0_4px_20px_rgba(0,0,0,0.03)] z-10">
            <button onClick={onBack} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.1)] flex items-center justify-center text-[#000000] transition-colors" aria-label="Close">
               <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 1l12 12m0-12L1 13"/></svg>
            </button>
            <div className="inline-flex items-center gap-1.5 bg-[#FCA311] text-[#000000] text-[11px] font-black px-3 py-1 rounded-full mb-3 shadow-sm">
               <span>🎫</span> BOOK A TURF SLOT
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-1.5 tracking-tight text-[#000000]">{venue.name}</h2>
            <p className="text-xs font-medium text-[rgba(0,0,0,0.70)] leading-relaxed max-w-[85%] flex items-center gap-1.5">
               <MapPin size={13} className="shrink-0 text-[#FCA311]" /> {venue.address || 'Chennai, Tamil Nadu, India'}
            </p>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 p-5 sm:p-6 space-y-7 bg-[#FFFFFF] pb-36">
            
            {/* Dates */}
            <div>
              <h3 className="text-xs font-bold text-[#000000] mb-3 uppercase tracking-wider">1. Select Date</h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
                {generateDates().map(d => (
                  <button key={d.iso} onClick={() => { setLocalDraft({ ...localDraft, date: d.iso }); setSelectedSlotIds([]); }} className={`flex-shrink-0 w-[66px] h-[80px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 ${d.active ? 'bg-[#FCA311] border-[#FCA311] text-[#000000] shadow-md shadow-[#FCA311]/25 scale-[1.02]' : 'bg-[#FFFFFF] border-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.70)] hover:border-[#FCA311]/40 shadow-sm'}`}>
                    <span className={`text-[11px] font-semibold uppercase ${d.active ? 'text-[#000000]' : 'text-[rgba(0,0,0,0.70)]'}`}>{d.label}</span>
                    <span className="text-lg font-black">{d.day}</span>
                    <span className={`text-[11px] font-semibold ${d.active ? 'text-[#000000]' : 'text-[rgba(0,0,0,0.70)]'}`}>{d.mon}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Slots */}
            <div className="bg-[#FFFFFF] rounded-2xl p-4 sm:p-5 border border-[rgba(0,0,0,0.08)] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#000000] uppercase tracking-wider mb-0.5">Available Slots ({date})</h3>
                  <p className="text-[11px] font-medium text-[rgba(0,0,0,0.60)]">Slots for {venue.name}</p>
                </div>
                <div className="inline-flex self-start sm:self-auto items-center gap-1 bg-[rgba(0,0,0,0.04)] p-1 rounded-full border border-[rgba(0,0,0,0.06)]">
                  <button onClick={() => setSlotFilter('all')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'all' ? 'bg-[#FCA311] text-[#000000] shadow-sm' : 'text-[rgba(0,0,0,0.70)] hover:text-[#000000]'}`}>All</button>
                  <button onClick={() => setSlotFilter('morning')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'morning' ? 'bg-[#FCA311] text-[#000000] shadow-sm' : 'text-[rgba(0,0,0,0.70)] hover:text-[#000000]'}`}>☀️ Morning</button>
                  <button onClick={() => setSlotFilter('evening')} className={`px-3 py-1 text-[11px] font-bold rounded-full transition-colors duration-150 ${slotFilter === 'evening' ? 'bg-[#FCA311] text-[#000000] shadow-sm' : 'text-[rgba(0,0,0,0.70)] hover:text-[#000000]'}`}>🌙 Evening</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {displaySlots.map((slot) => {
                  const isActive = selectedSlotIds.includes(slot.id);
                  const isBooked = !slot.available;
                  const hour = parseInt(slot.startTime.split(':')[0], 10);
                  const isDayTime = hour >= 6 && hour < 18;
                  const timeStr = `${isDayTime ? '☀️' : '🌙'} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                  
                  if (isBooked) {
                    return (
                      <div key={slot.id} className="border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center opacity-50 select-none">
                        <span className="text-[11px] sm:text-[11px] font-semibold text-[rgba(0,0,0,0.50)] line-through mb-1.5 leading-tight text-center">{timeStr}</span>
                        <span className="text-[11px] font-black text-[rgba(0,0,0,0.60)] bg-[rgba(0,0,0,0.06)] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Booked</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id)}
                      className={`rounded-2xl p-3 sm:p-3.5 flex flex-col items-start transition-colors duration-150 text-left border relative overflow-hidden ${
                        isActive
                          ? 'bg-[#FCA311] border-2 border-[#000000] text-[#000000] shadow-[0_6px_22px_rgba(252,163,17,0.50)] ring-2 ring-[#FCA311] scale-[1.03]'
                          : 'bg-[#FFFFFF] border-[rgba(0,0,0,0.08)] text-[#000000] hover:border-[#FCA311]/50 hover:bg-[#FCA311]/10 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className={`text-[11px] sm:text-[11px] font-black leading-tight ${isActive ? 'text-[#000000]' : 'text-[#000000]'}`}>
                          {timeStr}
                        </span>
                        {isActive && (
                          <span className="text-[11px] font-black px-1.5 py-0.5 rounded-full bg-black text-[#FCA311] tracking-wider uppercase shrink-0">
                            ✓ ADDED
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold mb-1 ${isActive ? 'text-[#000000]/90' : 'text-[rgba(0,0,0,0.60)]'}`}>
                        ⏱ {slot.durationMinutes} min
                      </span>
                      <div className="flex items-center justify-between w-full mt-auto">
                        <span className={`text-xs sm:text-sm font-black tracking-tight ${isActive ? 'text-[#000000]' : 'text-[#000000]'}`}>
                          ₹{slot.price}
                        </span>
                        {isActive && (
                          <span className="text-[11px] font-black text-[#000000] bg-white px-1.5 py-0.5 rounded">
                            Selected
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
              <label className="block text-[11px] font-bold text-[#000000] mb-1.5">Your Name *</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name" className="w-full border border-[rgba(0,0,0,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder:text-[rgba(0,0,0,0.60)] text-[#000000] font-medium" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#000000] mb-1.5">Phone Number *</label>
              <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91 98765 00000" className="w-full border border-[rgba(0,0,0,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder:text-[rgba(0,0,0,0.60)] text-[#000000] font-medium" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#000000] mb-1.5">Notes (Optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Football kits needed, 5v5 friendly match" className="w-full border border-[rgba(0,0,0,0.12)] rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder:text-[rgba(0,0,0,0.60)] font-medium text-[#000000] bg-[#E5E5E5]" />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-4 pb-6 sm:p-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between rounded-none sm:rounded-b-[1.5rem]">
          <div className="flex justify-between items-center sm:block w-full sm:w-auto">
            <div>
              <div className="text-[11px] font-black text-[rgba(0,0,0,0.60)] uppercase tracking-widest mb-0.5">Total Payable</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black tracking-tight ${selectedSlotIds.length > 0 ? 'text-[#000000]' : 'text-[rgba(0,0,0,0.50)]'}`}>
                  ₹{totalPayable}
                </span>
                {selectedSlotIds.length > 0 ? (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#FCA311] text-[#000000] border border-[#000000]/20 shadow-sm animate-pulse">
                    {selectedSlotIds.length} slot{selectedSlotIds.length > 1 ? 's' : ''} added
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-[rgba(0,0,0,0.50)]">(Select a slot)</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onContinue} disabled={!isFormValid} className={`w-full sm:w-auto text-[#000000] px-7 py-3.5 rounded-full font-black text-sm flex items-center justify-center gap-2 transition-colors duration-150 shadow-md ${isFormValid ? 'bg-[#FCA311] hover:bg-[#FCA311]/90  shadow-[#FCA311]/30 cursor-pointer' : 'bg-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.35)] shadow-none cursor-not-allowed'}`}>
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
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--qp-primary-soft)] flex items-center justify-center text-[var(--qp-primary-hover)]">
                <Receipt size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#000000]">Bill Details</h3>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[rgba(0,0,0,0.70)] font-medium">Slot Cost</span>
              <span className="font-black text-[#000000]">₹{total}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[rgba(0,0,0,0.70)] font-medium">QGo Convenience Fee</span>
              <span className="font-black text-[#000000]">₹{qgoFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-[rgba(0,0,0,0.70)] font-medium">GST (18% on Fee)</span>
              <span className="font-black text-[#000000]">₹{gst.toFixed(2)}</span>
            </div>
            {paymentMode === 'advance' && (
              <div className="flex justify-between items-center text-sm mb-3 pt-3 border-t border-[rgba(0,0,0,0.12)]">
                <span className="text-[#FCA311] font-bold">Remaining Balance</span>
                <span className="font-black text-[#FCA311]">₹{remainingBalance.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-[rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-2 text-[var(--qp-primary-hover)] font-bold text-sm">
                <Wallet size={16} />
                <span>Amount due at venue</span>
              </div>
              <span className="text-2xl font-black text-[var(--qp-primary-hover)]">₹{amountToPay}</span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--qp-primary-soft)] flex items-center justify-center text-[var(--qp-primary)]">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#000000] leading-tight">Payment</h3>
                <p className="text-[11px] text-[rgba(0,0,0,0.70)]">Online payment is not available</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(allowedMode === 'ADVANCE' || allowedMode === 'BOTH') && (
                <button onClick={() => setPaymentMode('advance')} className={`border rounded-2xl p-4 flex flex-col text-left transition-colors duration-150 relative ${paymentMode === 'advance' ? 'border-[var(--qp-primary-hover)] bg-[var(--qp-primary-hover)]/5 shadow-sm shadow-[var(--qp-primary-hover)]/10' : 'border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.05)] hover:border-[var(--qp-primary-hover)]/40'}`}>
                  <div className="flex justify-between items-start mb-3 w-full">
                    <CreditCard size={18} className="text-[rgba(0,0,0,0.70)]" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'advance' ? 'border-[var(--qp-primary-hover)]' : 'border-[rgba(0,0,0,0.12)]'}`}>
                      {paymentMode === 'advance' && <div className="w-2 h-2 rounded-full bg-[var(--qp-primary-hover)]" />}
                    </div>
                  </div>
                  <div className="font-bold text-[#000000] text-sm mb-0.5">Advance</div>
                  <div className="text-[11px] text-[rgba(0,0,0,0.70)] mb-2">Pay ₹{advancePayable} now</div>
                  <div className="text-lg font-black text-[#000000] mt-auto">₹{advancePayable}</div>
                </button>
              )}

              {(allowedMode === 'FULL' || allowedMode === 'BOTH') && (
                <button onClick={() => setPaymentMode('full')} className={`border rounded-2xl p-4 flex flex-col text-left transition-colors duration-150 relative ${paymentMode === 'full' ? 'border-[var(--qp-primary-hover)] bg-[var(--qp-primary-hover)]/5 shadow-sm shadow-[var(--qp-primary-hover)]/10' : 'border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.05)] hover:border-[var(--qp-primary-hover)]/40'}`}>
                  <div className="flex justify-between items-start mb-3 w-full">
                    <Wallet size={18} className={paymentMode === 'full' ? 'text-[var(--qp-primary-hover)]' : 'text-[rgba(0,0,0,0.70)]'} />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'full' ? 'border-[var(--qp-primary-hover)]' : 'border-[rgba(0,0,0,0.12)]'}`}>
                      {paymentMode === 'full' && <div className="w-2 h-2 rounded-full bg-[var(--qp-primary-hover)]" />}
                    </div>
                  </div>
                  <div className="font-bold text-[#000000] text-sm mb-0.5">Pay at venue</div>
                  <div className="text-[11px] text-[rgba(0,0,0,0.70)] mb-2">No online charge is taken</div>
                  <div className={`text-lg font-black mt-auto ${paymentMode === 'full' ? 'text-[var(--qp-primary-hover)]' : 'text-[#000000]'}`}>₹{fullPayable}</div>
                </button>
              )}
            </div>

            <div className="bg-[var(--qp-primary-hover)]/5 rounded-2xl p-4 flex items-center justify-between border border-[var(--qp-primary-hover)]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--qp-primary-hover)] rounded-xl flex items-center justify-center text-[#000000] shadow-md shadow-[var(--qp-primary-hover)]/30">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[rgba(0,0,0,0.70)] uppercase tracking-wider mb-0.5">Amount due at venue</div>
                  <div className="text-2xl font-black text-[var(--qp-primary-hover)] leading-none">₹{amountToPay}</div>
                </div>
              </div>
              <div className="bg-[var(--qp-primary-hover)]/10 text-[var(--qp-primary-hover)] px-2.5 py-1.5 rounded-full text-[11px] font-black tracking-widest flex items-center gap-1 uppercase">
                <Zap size={10} fill="currentColor" /> PAY AT VENUE
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="bg-[#FFFFFF] rounded-3xl p-5 shadow-sm border border-[rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[var(--qp-primary-soft)] flex items-center justify-center text-[var(--qp-primary-hover)]">
                <ShieldCheck size={16} />
              </div>
              <h3 className="text-lg font-bold text-[#000000]">Cancellation Policy</h3>
            </div>
            
            <div className="bg-[var(--qp-primary-hover)]/5 rounded-2xl p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-[var(--qp-primary-hover)] shrink-0 mt-0.5" />
                <p className="text-xs text-[rgba(0,0,0,0.70)] leading-relaxed">
                  Cancel before <span className="font-bold text-[var(--qp-primary-hover)]">24 hours of start time</span> to avail a refund.<br />
                  <span className="text-[rgba(0,0,0,0.70)]">Service fee is non-refundable.</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-[var(--qp-primary-hover)] shrink-0 mt-0.5" />
                <p className="text-xs text-[rgba(0,0,0,0.70)] leading-relaxed">
                  If you cancel after the above time, you will lose the entire amount paid.
                </p>
              </div>
            </div>
          </div>

        </div>
        
        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[rgba(0,0,0,0.05)] sm:relative sm:bg-transparent z-50">
          <div className="max-w-md mx-auto">
            <button onClick={() => onContinue(paymentMode === 'advance' ? 'ADVANCE' : 'FULL')} className="w-full bg-[#FCA311] hover:opacity-90 active:scale-[0.98] transition-colors duration-150 text-[#000000] py-4 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#FCA311]/30">
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
        customerName: user.name || user.displayName || 'Customer',
        customerPhone: user.phone || 'Not provided',
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
        <button onClick={onBack} className="p-1 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors" aria-label="Back to booking summary">
          <ArrowLeft size={24} className="text-[#000000]" />
        </button>
        <div className="mt-6 bg-[#FFFFFF] rounded-2xl border border-[rgba(0,0,0,0.12)] p-6 shadow-sm">
          <h1 className="text-xl font-bold text-[#000000]">Confirm reservation</h1>
          <p className="mt-2 text-sm text-[rgba(0,0,0,0.70)]">Online payments are not available yet. Your reservation will be created with payment due at the venue.</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-[rgba(0,0,0,0.70)]">Venue</dt><dd className="font-semibold text-[#000000] text-right">{venue.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[rgba(0,0,0,0.70)]">Date</dt><dd className="font-semibold text-[#000000]">{draft.date}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[rgba(0,0,0,0.70)]">Time</dt><dd className="font-semibold text-[#000000]">{draft.startTime} – {draft.endTime}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[rgba(0,0,0,0.70)]">Amount due</dt><dd className="font-semibold text-[#000000]">₹{draft.price || 0}</dd></div>
          </dl>
          {error && <p className="mt-5 text-sm font-medium text-[#FCA311]">{error}</p>}
          <button onClick={reserve} disabled={loading} className="mt-6 w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] disabled:opacity-60 text-[#000000] py-4 rounded-xl font-bold flex items-center justify-center gap-2">
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
    if (!draft.date || !draft.startTime || !draft.endTime || (draft.endTime !== '00:00' && draft.endTime <= draft.startTime)) { setError('Complete a valid date and time range before continuing.'); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { qbi.notBooked('offline', { onRetry: pay }); return; }
    setLoading(true);

    let result: Awaited<ReturnType<typeof api.createBooking>>;
    try {
      result = await api.createBooking({ salonId: venue.id, customerName: user.name || user.displayName || 'Customer', customerPhone: user.phone || 'Not provided', mode: 'appointment', scheduledDate: draft.date, scheduledTime: draft.startTime, slotEndTime: draft.endTime, price: draft.price, numberOfPlayers: draft.players, notes: `${draft.format}; ${draft.pitches} pitch${draft.pitches === 1 ? '' : 'es'}`, paymentType: draft.paymentType === 'ADVANCE' ? 'ADVANCE' : 'FULL', advanceAmount: draft.paymentType === 'ADVANCE' ? draft.advanceAmount : 0 });
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
        <div className="fixed inset-0 z-[100] bg-[#FFFFFF] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-[rgba(0,0,0,0.12)] border-t-[#FCA311] animate-spin mb-8"></div>
            <div className="flex font-black text-[42px] leading-none tracking-tight mb-3">
              <span className="text-[#000000]">G</span>
              <span className="text-[#000000]">P</span>
              <span className="text-[#000000]">a</span>
              <span className="text-[#000000]">y</span>
            </div>
            <p className="text-[rgba(0,0,0,0.70)] font-bold text-sm">Processing your payment...</p>
            <p className="text-[rgba(0,0,0,0.70)] font-semibold text-xs mt-2">Please do not close this window</p>
          </div>
        </div>
      )}

      <div className="w-full sm:max-w-md relative pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pt-8 mb-2">
          <button onClick={onBack} className="p-1 hover:bg-[rgba(0,0,0,0.05)] rounded-full transition-colors">
            <ArrowLeft size={24} className="text-[#000000]" />
          </button>
          <h1 className="text-xl font-bold text-[#000000] absolute left-1/2 -translate-x-1/2">Secure Checkout</h1>
          <div className="w-6" />
        </div>

        {/* Order Summary Card */}
        <div className="mx-4 bg-[#FFFFFF] rounded-2xl shadow-sm border border-[rgba(0,0,0,0.12)] p-5 mb-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[17px] font-bold text-[#000000]">Order Summary</h2>
            <ChevronDown size={20} className="text-[#FCA311]" />
          </div>
          <div className="flex gap-4 items-start mb-5">
            <img src={venue.image || 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c'} alt="turf" className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-[#000000] text-[15px]">Turf Booking</h3>
                <span className="font-bold text-[#000000]">₹{basePrice}</span>
              </div>
              <p className="text-[13px] text-[rgba(0,0,0,0.70)]">{draft.format || 'Football'} Turf - Premium</p>
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mt-1">Qty: 1 • {draft.date} - {draft.startTime} - {draft.endTime}</p>
            </div>
          </div>
          
          <div className="border-t border-[rgba(0,0,0,0.12)] pt-4 pb-2 space-y-2">
            <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
              <span>Base Price</span>
              <span className="font-bold text-[#000000]">₹{basePrice}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
              <span>Discount</span>
              <span className="font-bold text-[#000000]">- ₹0</span>
            </div>
          </div>
          
          <div className="border-t border-[rgba(0,0,0,0.12)] pt-3 pb-3 space-y-2">
            {draft.paymentType === 'ADVANCE' ? (
              <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
                <span>Advance Amount</span>
                <span className="font-bold text-[#000000]">₹{advanceAmount}</span>
              </div>
            ) : (
              <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
                <span>Subtotal</span>
                <span className="font-bold text-[#000000]">₹{basePrice}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
              <span>QGo Convenience Fee</span>
              <span className="font-bold text-[#000000]">₹{qgoFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-[rgba(0,0,0,0.70)]">
              <span>GST (18% on Fee)</span>
              <span className="font-bold text-[#000000]">₹{qgoGst.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="border-t border-[rgba(0,0,0,0.12)] pt-4 flex justify-between items-center">
            <span className="font-bold text-[#000000] text-base">Total Payable</span>
            <span className="text-2xl font-black text-[var(--qp-primary-hover)]">₹{totalPayable}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mx-4 mb-5">
          <h2 className="text-[17px] font-bold text-[#000000] mb-0.5">Payment Method</h2>
          <p className="text-[11px] text-[rgba(0,0,0,0.70)] mb-4">Choose your preferred payment method</p>
          
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setPaymentMethod('google')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'google' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-[rgba(0,0,0,0.12)] hover:border-[rgba(0,0,0,0.12)]'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'google' ? 'bg-[var(--qp-primary-hover)] text-[#000000]' : 'border border-[rgba(0,0,0,0.12)]'}`}>
                {paymentMethod === 'google' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#FFFFFF" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#FFFFFF" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FFFFFF" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#FFFFFF" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="font-bold text-[11px] text-[#000000]">Google Pay</span>
            </button>

            <button onClick={() => setPaymentMethod('phonepe')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'phonepe' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-[rgba(0,0,0,0.12)] hover:border-[rgba(0,0,0,0.12)]'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'phonepe' ? 'bg-[var(--qp-primary-hover)] text-[#000000]' : 'border border-[rgba(0,0,0,0.12)]'}`}>
                {paymentMethod === 'phonepe' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="w-[18px] h-[18px] bg-[#FCA311] rounded-full flex items-center justify-center text-[#000000] text-[11px] font-black leading-none pt-[1px]">Pe</div>
              </div>
              <span className="font-bold text-[11px] text-[#000000]">PhonePe</span>
            </button>

            <button onClick={() => setPaymentMethod('paytm')} className={`border-2 bg-[#FFFFFF] rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-colors duration-150 ${paymentMethod === 'paytm' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-[rgba(0,0,0,0.12)] hover:border-[rgba(0,0,0,0.12)]'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'paytm' ? 'bg-[var(--qp-primary-hover)] text-[#000000]' : 'border border-[rgba(0,0,0,0.12)]'}`}>
                {paymentMethod === 'paytm' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="flex font-black text-[14px] leading-none tracking-tight">
                  <span className="text-[#000000]">Pay</span><span className="text-[#FCA311]">tm</span>
                </div>
              </div>
              <span className="font-bold text-[11px] text-[#000000]">Paytm</span>
            </button>
          </div>
        </div>

        {error && <p className="text-[#FCA311] text-xs font-semibold mb-4 mx-4 text-center">{error}</p>}

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#FFFFFF] sm:relative sm:bg-transparent z-50">
          <div className="max-w-md mx-auto">
            <button onClick={pay} disabled={loading} className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] active:scale-[0.98] transition-colors duration-150 text-[#000000] py-4 rounded-[14px] font-bold text-[16px] flex items-center justify-center gap-2 shadow-sm">
              <LockKeyhole size={18} /> {loading ? 'Confirming...' : 'Complete Order'} <ArrowRight size={18} />
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
    <div className="fixed inset-0 bg-[var(--qp-primary)] flex flex-col items-center justify-center z-[100] animate-in slide-in-from-bottom-10">
      <div className="w-28 h-28 bg-[#FFFFFF] rounded-full flex items-center justify-center mb-8 shadow-2xl animate-in zoom-in duration-500 delay-150">
        <Check size={56} strokeWidth={3} className="text-[var(--qp-primary)]" />
      </div>
      <h1 className="text-[28px] font-black text-[#000000] mb-3 tracking-tight">Payment Successful!</h1>
      <p className="text-[#FCA311] font-bold text-sm">Generating your ticket...</p>
    </div>
  );
}

function TicketView({ venue, user, booking, draft, onHome }: { venue: { name: string }; user: any; booking: any; draft: BookingDraft; onHome: () => void }) {
  useQbiScreen('ticket');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const ticketEl = document.getElementById('ticket-card-content');
    if (!ticketEl) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(ticketEl, { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' });
      const link = document.createElement('a');
          link.download = `QGo-Ticket-${booking?.id?.slice(0, 8) || 'booking'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error downloading ticket', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#FFFFFF] z-[100] overflow-y-auto flex flex-col pt-8 pb-24 px-5 items-center animate-in fade-in slide-in-from-bottom-5">
      <div className="w-full max-w-sm mb-6 text-center mt-4">
        <h1 className="text-2xl font-black text-[#000000] tracking-tight mb-1">You're All Set!</h1>
        <p className="text-[rgba(0,0,0,0.70)] font-medium text-sm">Present this ticket at the venue</p>
      </div>

      <div id="ticket-card-content" className="w-full max-w-sm bg-[#FFFFFF] rounded-[1.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden border border-[rgba(0,0,0,0.12)]">
        
        <div className="p-6 pb-0">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#000000]" />
              <span className="font-bold text-[#000000] text-[15px]">{booking?.id?.slice(0, 8).toUpperCase() || 'BOOKING'}</span>
            </div>
            <span className="font-bold text-[#000000] uppercase text-[13px]">{new Date(draft.date || new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase().replace(',', '')}</span>
          </div>

          <div className="flex justify-between items-center mb-1">
            <span className="text-[rgba(0,0,0,0.70)] font-black text-sm">{venue.name}</span>
            <span className="text-[rgba(0,0,0,0.70)] font-medium text-xs">{draft.format}</span>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-3xl font-black text-[#000000] tracking-tight">{draft.startTime}</span>
            <div className="flex-1 px-3 flex items-center justify-center gap-1.5 text-[rgba(0,0,0,0.60)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF]"></div>
              <div className="flex-1 border-t-2 border-dashed border-[rgba(0,0,0,0.12)]"></div>
              <div className="flex items-center gap-1 bg-[#FFFFFF] px-2 py-0.5 rounded-full border border-[rgba(0,0,0,0.12)] text-[rgba(0,0,0,0.70)] text-[11px] font-bold whitespace-nowrap">
                <Clock size={10} /> 
                {Math.round((new Date(`1970-01-01T${draft.endTime}:00`).getTime() - new Date(`1970-01-01T${draft.startTime}:00`).getTime()) / 60000) || 60}m
              </div>
              <div className="flex-1 border-t-2 border-dashed border-[rgba(0,0,0,0.12)]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF]"></div>
            </div>
            <span className="text-3xl font-black text-[#000000] tracking-tight">{draft.endTime}</span>
          </div>

          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FCA311]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FCA311]"></div> Confirmed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-[rgba(0,0,0,0.12)] pt-4 pb-5">
            <div>
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mb-0.5">Player Name</p>
              <p className="font-bold text-[#000000] text-sm line-clamp-1">{user?.name || user?.displayName || 'Customer'}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[rgba(0,0,0,0.70)] mb-0.5">Payment Mode</p>
              <p className="font-bold text-[#000000] text-sm">{(booking?.paidAmount || 0) > 0 ? ((booking?.paidAmount || 0) >= (booking?.totalAmount || draft.price || 0) ? 'Full Paid' : 'Advance Paid') : 'Due at venue'}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFFFF] border-t border-[rgba(0,0,0,0.12)] p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 w-full">
            <div className="bg-[#FCA311] text-[#000000] text-[11px] font-bold px-2 py-1 rounded w-max mb-1">
              Total Slot: ₹{booking?.totalAmount || draft.price || '0'}
            </div>
            <p className="text-xs font-bold text-[#000000] mt-0.5">Paid Now: <span className="text-sm">₹{booking?.paidAmount || 0}</span></p>
            <p className="text-[11px] font-bold text-[#FCA311]">Balance Due: ₹{booking?.balanceAmount || (draft.price || 0)}</p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="bg-[#FFFFFF] p-1.5 rounded-xl shadow-sm border border-[rgba(0,0,0,0.12)] mb-1 relative group cursor-pointer" onClick={() => {
              const el = document.getElementById('full-qr-modal');
              if(el) el.classList.remove('hidden');
            }}>
              <QRCodeSVG 
                value={JSON.stringify({ bookingId: booking?.id || '', salonId: booking?.salonId || '', qrCodeId: booking?.qrCodeId || '', qrSignature: booking?.qrSignature || '' })}
                size={72}
                level="M" 
                fgColor="#FFFFFF" 
              />
              <div className="absolute inset-0 bg-black/5 rounded-xl group-hover:bg-black/10 transition-colors"></div>
            </div>
            <span className="text-[11px] font-medium text-[rgba(0,0,0,0.70)]">Tap to expand</span>
          </div>
        </div>
      </div>

      {/* Full QR Modal */}
      <div id="full-qr-modal" className="hidden fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6 transition-opacity" onClick={(e) => {
        if(e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
      }}>
        <div className="bg-[#FFFFFF] p-8 rounded-3xl w-full max-w-sm flex flex-col items-center">
          <h3 className="font-bold text-[#000000] mb-6 text-lg">Scan at Entrance</h3>
          <QRCodeSVG 
            value={JSON.stringify({ bookingId: booking?.id || '', salonId: booking?.salonId || '', qrCodeId: booking?.qrCodeId || '', qrSignature: booking?.qrSignature || '' })}
            size={240} 
            level="M" 
            fgColor="#FFFFFF" 
          />
          <button className="mt-8 bg-[#FFFFFF] hover:bg-[rgba(0,0,0,0.05)] text-[#000000] px-6 py-2 rounded-full font-bold text-sm transition-colors" onClick={() => {
            document.getElementById('full-qr-modal')?.classList.add('hidden');
          }}>Close</button>
        </div>
      </div>

      <div className="w-full max-w-sm mt-8 flex flex-col gap-3">
        <button onClick={handleDownload} disabled={downloading} className="ticket-download-btn w-full bg-[#FFFFFF] hover:bg-[rgba(0,0,0,0.05)] text-[#000000] p-4 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {downloading ? <div className="w-5 h-5 border-2 border-[rgba(11,11,11,0.12)]/30 border-t-white rounded-full animate-spin" /> : <><Download size={18} /> Download Ticket</>}
        </button>
        <button onClick={onHome} className="w-full bg-[#FFFFFF] hover:bg-[rgba(0,0,0,0.05)] text-[#000000] border border-[rgba(0,0,0,0.12)] p-4 rounded-[14px] font-bold transition-colors flex items-center justify-center gap-2">
          Back to Home
        </button>
      </div>
    </div>
  );
}

function BookingView({ onViewTicket }: { onViewTicket?: (b: any) => void }) {
  useQbiScreen('booking');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming'|'past'>('upcoming');

  useEffect(() => {
    let active = true;
    api.getBookings().then(res => {
      if(active) { setBookings(res.bookings || []); setLoading(false); }
    }).catch(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#F8F8F9] px-5 pt-8 pb-32">
      <h2 className="text-2xl font-black text-[#000000] tracking-tight mb-6">My Bookings</h2>
      
      <div className="flex bg-white rounded-full p-1 shadow-sm border border-[rgba(0,0,0,0.08)] mb-6 relative z-10">
        <button className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${activeTab === 'upcoming' ? 'bg-[#FCA311] text-[#000000] shadow-sm' : 'text-[rgba(0,0,0,0.70)] hover:text-[#000000]'}`} onClick={() => setActiveTab('upcoming')}>Upcoming</button>
        <button className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${activeTab === 'past' ? 'bg-[#FCA311] text-[#000000] shadow-sm' : 'text-[rgba(0,0,0,0.70)] hover:text-[#000000]'}`} onClick={() => setActiveTab('past')}>Past</button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && <p className="text-center py-8 text-[rgba(0,0,0,0.70)] font-bold text-sm">Loading bookings...</p>}
        {!loading && bookings.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <Qbi mood="waiting" size={96} />
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm"><CalendarDays size={24} className="text-[#FCA311]" /></div>
            <p className="text-[rgba(0,0,0,0.70)] font-bold text-sm">No {activeTab} bookings found.</p>
          </div>
        )}
        {!loading && bookings.map(b => (
          <article key={b.id} className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-[#0B0B0B]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-black text-[#000000] text-[15px] tracking-tight">{b.salonName || 'Venue'}</h3>
                <p className="text-[11px] font-bold text-[#000000] bg-[#FCA311]/25 px-2 py-0.5 rounded flex inline-flex items-center gap-1 mt-1"><Clock size={12}/> {b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown Date'} • {b.scheduledTime || b.startTime}</p>
              </div>
              <div className="bg-[#F8F8F9] px-2 py-1 rounded-lg text-right border border-black/5">
                <p className="text-[11px] font-bold text-[rgba(0,0,0,0.70)] uppercase">{b.paymentStatus === 'paid' ? 'Paid' : 'Due'}</p>
                <p className="text-xs font-black text-[#000000]">₹{b.totalAmount || b.price || b.amount || '0'}</p>
              </div>
            </div>
            <div className="flex gap-2">
               <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(b.salonName || 'Turf')}`, '_blank')} className="flex-1 bg-[#FCA311]/15 text-black py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-[#FCA311]/25">Get Directions</button>
               <button onClick={() => onViewTicket && onViewTicket(b)} className="flex-1 bg-white border border-[rgba(0,0,0,0.12)] text-[#000000] py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-black/5">View Ticket</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ onLogout }: { onLogout: () => void }) {
  useQbiScreen('profile');
  const { user } = useAuth();
  const [theme, setTheme] = useState<'light' | 'system' | 'dark'>(() => {
    return (localStorage.getItem('qgo_theme') as 'light' | 'system' | 'dark') || 'system';
  });
  const [lang, setLang] = useState<'EN' | 'TA'>('EN');

  useEffect(() => {
    handleThemeChange(theme);
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'system' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('qgo_theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    } else {
      // System
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isSystemDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }
  };

  const menuItems = [
    { 
      id: 'language', 
      label: 'Language', 
      sub: lang === 'EN' ? 'English (Switch to Tamil)' : 'தமிழ் (Switch to English)', 
      icon: <Globe2 size={20} strokeWidth={2} className="text-[#FCA311]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]',
      onClick: () => setLang(l => l === 'EN' ? 'TA' : 'EN')
    },
    { 
      id: 'account', 
      label: 'Account', 
      sub: 'Manage your personal details', 
      icon: <UserCircle size={20} strokeWidth={2} className="text-[var(--qp-primary)]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'booking', 
      label: 'Your Booking', 
      sub: 'View and manage your bookings', 
      icon: <CalendarDays size={20} strokeWidth={2} className="text-[var(--qp-primary)]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'refunds', 
      label: 'Refunds', 
      sub: 'Track your refunds and wallet', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 8h8M8 12h8M9 8v10M11 12l4 4"/></svg>, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'favorites', 
      label: 'Favourite Venues', 
      sub: 'Your saved venues', 
      icon: <Heart size={20} strokeWidth={2} className="text-[#FCA311]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'support', 
      label: 'Support', 
      sub: 'Get help & contact us', 
      icon: <Headphones size={20} strokeWidth={2} className="text-[#FCA311]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'privacy', 
      label: 'Privacy Policy', 
      sub: 'How we protect your data', 
      icon: <ShieldCheck size={20} strokeWidth={2} className="text-[#FCA311]" />, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
    { 
      id: 'terms', 
      label: 'Terms of use', 
      sub: 'Read our terms and conditions', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FCA311" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v4M12 16h.01"/></svg>, 
      bg: 'bg-[rgba(252,163,17,0.15)]' 
    },
  ];

  const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6"/></svg>
  );

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#FFFFFF] dark:bg-[#FFFFFF] px-4 pt-4 pb-[88px] animate-in fade-in">
      {/* Header Card */}
      <div className="w-full rounded-[2rem] bg-gradient-to-br from-[#FFFFFF] to-[#E5E5E5] border border-[rgba(0,0,0,0.12)] p-5 mb-5 relative overflow-hidden shadow-sm">
        {/* Decorative Graphic */}
        <div className="absolute top-1/2 right-[-20px] -translate-y-1/2 w-48 h-48 opacity-[0.15] mix-blend-multiply dark:mix-blend-lighten pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-[var(--qp-primary)]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <path d="M11 6.5v4l-3.5 2 1.5 2.5 4.5-2.5 4.5 2.5 1.5-2.5-3.5-2v-4h-5z"/>
          </svg>
        </div>

        {/* Edit Button */}
        <button type="button" className="absolute top-4 right-4 w-9 h-9 bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(0,0,0,0.05)] rounded-xl flex items-center justify-center shadow-sm text-[rgba(0,0,0,0.70)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(0,0,0,0.05)] transition-colors z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>

        <div className="relative z-10 flex flex-col items-center justify-center text-center pt-2">
          <div className="w-[64px] h-[64px] rounded-full bg-[#FCA311] flex items-center justify-center text-3xl font-black text-[#000000] shadow-md mb-3">
            {user?.name?.charAt(0) || user?.displayName?.charAt(0) || 'C'}
          </div>
          <h2 className="text-xl font-black text-[#000000] tracking-tight mb-0.5">{user?.name || user?.displayName || 'Customer'}</h2>
          <div className="flex items-center justify-center gap-1.5 text-[rgba(0,0,0,0.70)] mb-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className="text-xs font-medium">{user?.email || 'customer@gmail.com'}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-[rgba(0,0,0,0.05)] dark:bg-[#FFFFFF] px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,0,0,0.12)] shadow-sm mb-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="2 4 5 18 19 18 22 4 17 8 12 4 7 8 2 4"/></svg>
            <span className="text-[11px] font-black text-[var(--qp-primary)] dark:text-[#FCA311] uppercase tracking-wide">Premium Member</span>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center bg-[#FFFFFF] dark:bg-[#FFFFFF] rounded-full p-1 shadow-sm border border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,0,0,0.12)]">
            <button 
              type="button" 
              onClick={() => handleThemeChange('light')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'light' ? 'bg-[#FFFFFF] text-[#000000]' : 'text-[rgba(0,0,0,0.70)] hover:text-[rgba(0,0,0,0.70)]'}`}
            >
              <Sun size={12} strokeWidth={2.5} /> LIGHT
            </button>
            <div className="w-px h-4 bg-[#FFFFFF] mx-1"></div>
            <button 
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'system' ? 'bg-[#FFFFFF] text-[#000000]' : 'text-[rgba(0,0,0,0.70)] hover:text-[rgba(0,0,0,0.70)]'}`}
            >
              SYSTEM
            </button>
            <div className="w-px h-4 bg-[#FFFFFF] mx-1"></div>
            <button 
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold transition-colors ${theme === 'dark' ? 'bg-[#FFFFFF] text-[#000000]' : 'text-[rgba(0,0,0,0.70)] hover:text-[rgba(0,0,0,0.70)]'}`}
            >
              <Moon size={12} strokeWidth={2.5} /> DARK
            </button>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="flex flex-col gap-2 mb-2">
        {menuItems.map((item) => (
          <button type="button" key={item.id} onClick={item.onClick} className="w-full bg-[#FFFFFF] rounded-2xl p-3 flex items-center gap-3 shadow-[0_2px_15px_rgba(0,0,0,0.12)] border border-[rgba(0,0,0,0.12)] active:scale-[0.98] transition-transform text-left">
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
              {item.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-[#000000] mb-0">{item.label}</h3>
              <p className="text-[11px] font-medium text-[rgba(0,0,0,0.70)]">{item.sub}</p>
            </div>
            <ChevronRightIcon className="text-[rgba(0,0,0,0.60)] shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button type="button" onClick={onLogout} className="w-full bg-[#FFFFFF] rounded-2xl p-3 flex items-center gap-3 border border-[rgba(0,0,0,0.12)] shadow-[0_2px_15px_rgba(0,0,0,0.12)] active:scale-[0.98] transition-transform text-left mt-1">
        <div className="w-10 h-10 rounded-xl bg-[rgba(252,163,17,0.15)] flex items-center justify-center shrink-0">
          <LogOut size={20} strokeWidth={2.5} className="text-[#FCA311]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-[#000000] mb-0">Logout</h3>
          <p className="text-[11px] font-medium text-[rgba(0,0,0,0.70)]">Sign out from your account</p>
        </div>
        <ChevronRightIcon className="text-[rgba(0,0,0,0.60)] shrink-0" />
      </button>

    </div>
  );
}

function FavoritesView({ venues, favorites, onToggleFavorite, onSelectVenue }: { venues: any[], favorites: string[], onToggleFavorite: (name: string) => void, onSelectVenue: (v: any) => void }) {
  useQbiScreen('favorites');
  const favVenues = venues.filter(v => favorites.includes(v.name));

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#F8F8F9] px-5 pt-8 pb-32">
      <h2 className="text-2xl font-black text-[#000000] tracking-tight mb-6">Favourite Venues</h2>
      <div className="flex flex-col gap-4">
        {favVenues.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-white border border-[rgba(0,0,0,0.08)] rounded-full flex items-center justify-center mb-4 shadow-sm"><Heart size={24} className="text-[#FCA311]" /></div>
            <p className="text-[rgba(0,0,0,0.70)] font-bold text-sm">You haven't saved any venues yet.</p>
          </div>
        )}
        {favVenues.map((venue) => (
          <article key={venue.name} className="bg-white rounded-2xl p-4 shadow-xs border border-[#0B0B0B] cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectVenue(venue)}>
            <div className="flex justify-between items-start mb-2.5 px-1">
              <div>
                <h3 className="font-bold text-[#000000] text-[17px] tracking-tight leading-snug mb-1">{venue.name}</h3>
                <div className="flex items-start gap-1">
                  <MapPin size={13} className="text-[#FCA311] mt-[2px] shrink-0" />
                  <p className="text-[11px] text-[rgba(0,0,0,0.65)] font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-[#FCA311]/20 px-2 py-1 rounded-full shrink-0 border border-[#FCA311]/30">
                <Star size={12} className="fill-[#FCA311] text-[#FCA311]" />
                <span className="text-[11px] font-black text-[#000000]">4.5</span>
              </div>
            </div>
            
            <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3 shadow-inner">
              <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
              <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFavorite(venue.name); }}>
                <Heart size={16} strokeWidth={2.5} className="fill-[#FCA311] text-[#FCA311]" />
              </button>
            </div>
            
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[rgba(0,0,0,0.65)] uppercase tracking-wide">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                Sports <span className="text-[rgba(0,0,0,0.40)]">•</span> Turf
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
