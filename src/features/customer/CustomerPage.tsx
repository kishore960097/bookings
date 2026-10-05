import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, ChevronDown, CircleDollarSign, Globe2, Heart, Home, Info, LockKeyhole, LogOut, MapPin, Search, SlidersHorizontal, Ticket, UserRound, UserCircle, Headphones, ClipboardCheck, Phone, Star, Receipt, Wallet, CreditCard, ShieldCheck, Zap, Clock, Check, ChevronLeft, Crosshair, IndianRupee, Sun, Moon, QrCode, Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Salon } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const sports = [
  { name: 'Football', color: '#ffe5b0', image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=260&q=80' },
  { name: 'Cricket', color: '#d9f8c8', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=260&q=80' },
  { name: 'Basketball', color: '#eadcff', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=260&q=80' },
  { name: 'Swimming', color: '#bceff7', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=260&q=80' },
];

const fallbackVenues = [
  { id: 'demo-spr-city', name: 'Hotfut SPR City', address: 'Stephenson road, Perambur', image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=900&q=82', sports: 'Badminton, Box Cricket, Cricket, Football, Tennis' },
  { id: 'demo-vivira-mall', name: 'Hotfut Vivira Mall', address: 'OMR Road, Navalur', image: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=900&q=82', sports: 'Badminton, Box Cricket, Football, Tennis' },
];
const extraTurfs = [
  { id: 'demo-play-champs', name: 'Play Champs Badminton', address: 'Porur, Chennai', image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=82', sports: 'Badminton, Cricket, Football, Tennis' },
  { id: 'demo-turfworld', name: 'Turfworld Vivira Mall', address: 'OMR Road, Navalur', image: 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=900&q=82', sports: 'Badminton, Box Cricket, Football, Tennis' },
];
type BookingDraft = { date: string; startTime: string; endTime: string; format: string; pitches: number; players: number; customerName?: string; customerPhone?: string; notes?: string; price?: number };

export function CustomerPage({ onOpenNotifications, onLogout }: { onOpenNotifications?: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('All Sports');
  const [activeTab, setActiveTab] = useState<'home' | 'turf' | 'booking' | 'favorites' | 'profile'>('home');
  const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string; address: string; image: string; sports: string } | null>(null);
  const [bookingStep, setBookingStep] = useState<'detail' | 'slot' | 'summary' | 'payment' | 'paid' | 'ticket'>('detail');
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({ date: '', startTime: '', endTime: '', format: 'Box Cricket', pitches: 1, players: 10 });
  const [createdBooking, setCreatedBooking] = useState<any>(null);
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
  const [isMapView, setIsMapView] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`);
          const data = await res.json();
          // Prioritize city > locality > state to ensure broader matches (e.g. "Chennai" instead of "Guindy")
          const city = data.city || data.locality || data.principalSubdivision || 'Current Location';
          setUserLocation(city);
          setIsLocationModalOpen(false);
          setIsMapView(false);
        } catch (e) {
          setUserLocation('Current Location');
          setIsLocationModalOpen(false);
          setIsMapView(false);
        }
      }, () => {
        alert("Unable to retrieve your location. Please check browser permissions.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // Extract unique locations from all salons for auto-suggest
  const suggestedLocations = useMemo(() => {
    const locs = new Set<string>();
    salons.forEach(s => {
      if (s.city) locs.add(s.city.trim());
    });
    // Add some fallbacks just in case
    ['Chennai', 'Coimbatore', 'Madurai', 'Sathyamangalam', 'Bangalore'].forEach(l => locs.add(l));
    const all = Array.from(locs);
    if (!locationSearch) return all;
    return all.filter(l => l.toLowerCase().includes(locationSearch.toLowerCase()));
  }, [salons, locationSearch]);

  useEffect(() => {
    let active = true;
    api.getSalons().then((result) => { if (active) setSalons(result.salons || []); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const venues = useMemo(() => {
    const apiVenues = salons.map((salon, index) => {
      const fullAddress = [salon.address, salon.city].filter(Boolean).join(', ');
      
      // Generate a consistent mock distance based on the salon ID for demo purposes
      const mockDistance = (parseInt(salon.id.replace(/\D/g, '') || '123') % 15 + (index * 1.5) + 1.2).toFixed(1);

      return {
        id: salon.id,
        name: salon.name,
        address: fullAddress || 'Your nearby venue',
        distance: `${mockDistance} km`,
        image: salon.logoUrl || salon.coverUrl || fallbackVenues[index % fallbackVenues.length].image,
        sports: salon.category || fallbackVenues[index % fallbackVenues.length].sports,
      };
    });
    const source = activeTab === 'turf'
      ? (apiVenues.length ? [...apiVenues, ...extraTurfs] : [...fallbackVenues, ...extraTurfs])
      : (apiVenues.length ? apiVenues : fallbackVenues);
      
    return source.filter((venue) => {
      const matchQuery = `${venue.name} ${venue.address} ${venue.sports}`.toLowerCase().includes(query.toLowerCase());
      const matchSport = selectedSport === 'All Sports' || venue.sports.toLowerCase().includes(selectedSport.toLowerCase());
      // If the user is actively searching, search globally across all locations.
      // Otherwise, filter strictly by the currently selected userLocation.
      const matchLocation = query.length > 0 || userLocation === 'All Locations' || venue.address.toLowerCase().includes(userLocation.toLowerCase());
      
      return matchQuery && matchSport && matchLocation;
    });
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

  if (selectedVenue) {
    if (bookingStep === 'slot') return <SlotSelectionView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('detail')} onContinue={(draft) => { setBookingDraft(draft); setBookingStep('summary'); }} />;
    if (bookingStep === 'summary') return <BookingSummaryView venue={selectedVenue} draft={bookingDraft} onBack={() => setBookingStep('slot')} onContinue={() => setBookingStep('payment')} />;
    if (bookingStep === 'payment') return <PaymentView venue={selectedVenue} user={user} draft={bookingDraft} onBack={() => setBookingStep('summary')} onPaid={(booking) => { setCreatedBooking(booking); setBookingStep('paid'); window.setTimeout(() => setBookingStep('ticket'), 2500); }} />;
    if (bookingStep === 'paid') return <PaidView />;
    if (bookingStep === 'ticket') return <TicketView venue={selectedVenue} user={user} booking={createdBooking} draft={bookingDraft} onHome={() => { setSelectedVenue(null); setBookingStep('detail'); }} />;
    return <TurfDetailView venue={selectedVenue} onBack={() => setSelectedVenue(null)} onProceed={() => setBookingStep('slot')} />;
  }

  return (
    <main className="bg-[var(--qp-bg)] text-[var(--qp-text)] min-h-[100dvh] pb-24 font-sans relative" aria-label="Customer home">
      
      {/* --- HOME TAB --- */}
      {activeTab === 'home' && (
        <div className="flex flex-col w-full relative">
          {/* Header Area */}
          <div className="sticky top-0 z-50 ap-glass-nav px-5 pt-10 pb-6 w-full">
            {/* Top Bar */}
            <header className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[var(--qp-primary)] rounded-xl flex items-center justify-center shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </div>
                <span className="text-[22px] font-semibold text-[var(--qp-text)] tracking-tight">QGo</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button type="button" className="relative" onClick={onOpenNotifications}>
                  <Bell size={22} className="text-[var(--qp-text)] hover:opacity-80 transition-opacity" />
                  <span className="absolute top-0 right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-[var(--qp-bg)] rounded-full"></span>
                </button>
              </div>
            </header>

            {/* Location & Greeting */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] font-semibold text-[var(--qp-text-sec)] tracking-wider mb-0.5 uppercase">Your Location</p>
                <div 
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setIsLocationModalOpen(true)}
                  title="Change Location"
                >
                  <MapPin size={18} className="text-[var(--qp-primary)]" />
                  <h2 className="text-[19px] font-semibold text-[var(--qp-text)] tracking-tight">{userLocation}</h2>
                  <ChevronDown size={16} className="text-[var(--qp-text)] mt-0.5" />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-[var(--qp-text-sec)] tracking-wider mb-0.5 uppercase">Welcome Back</p>
                <p className="text-[14px] font-medium text-[var(--qp-text)]">{user?.name || user?.displayName || 'Customer'}</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--qp-text-sec)]" />
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search venues, sports..." 
                  className="w-full bg-[var(--qp-surface)] border border-[var(--qp-border)] rounded-[14px] py-3.5 pl-11 pr-4 text-[13px] font-medium text-[var(--qp-text)] focus:outline-none focus:border-[var(--qp-primary)] transition-colors placeholder-[var(--qp-text-sec)]"
                />
              </div>
              <button type="button" className="w-[50px] h-[50px] bg-[var(--qp-surface)] border border-[var(--qp-border)] rounded-[14px] flex items-center justify-center text-[var(--qp-text)] hover:bg-black/5 transition-colors shrink-0">
                <SlidersHorizontal size={20} strokeWidth={2} />
              </button>
            </div>
          </div>



          {/* Available Venues */}
          <div className="px-5 mb-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold text-[var(--qp-text)] tracking-tight">Available Venues</h2>
              </div>
            </div>
            
            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-4 snap-x">
              <button type="button" className="flex items-center gap-1.5 shrink-0 bg-[var(--qp-primary)] text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start">
                <CalendarDays size={14} /> 14 Sep <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => setSelectedSport('All Sports')} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === 'All Sports' ? 'bg-[var(--qp-primary)] text-white border-[var(--qp-primary)]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> 
                All Sports <ChevronDown size={14} />
              </button>
              {['Cricket', 'Football', 'Tennis'].map((sport) => (
                <button key={sport} type="button" onClick={() => setSelectedSport(sport)} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === sport ? 'bg-[var(--qp-primary)] text-white border-[var(--qp-primary)]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {sport}
                </button>
              ))}
            </div>

            {/* Venues List */}
            <div className="flex flex-col gap-5">
              {loading && <p className="text-center py-8 text-slate-500 font-bold text-sm">Loading venues...</p>}
              {!loading && venues.length === 0 && <p className="text-center py-8 text-slate-500 font-bold text-sm">No venues match your search.</p>}
              {venues.map((venue) => (
                <article key={venue.name} className="bg-white rounded-[1.25rem] p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedVenue(venue)}>
                  <div className="flex justify-between items-start mb-2.5 px-1">
                    <div>
                      <h3 className="font-black text-[#0f172a] text-[17px] uppercase tracking-tight leading-none mb-1.5">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-slate-400 mt-[2px] shrink-0" />
                        <p className="text-[10px] text-slate-500 font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {userLocation !== 'All Locations' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-bold text-[var(--qp-primary)] bg-[var(--qp-primary-soft)] px-1.5 py-0.5 rounded uppercase tracking-wider">{venue.distance || '1.2 km'} Away</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                      <Star size={12} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
                      <span className="text-[11px] font-black text-slate-900">{Math.random() > 0.5 ? '4.0' : '4.5'}</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3">
                    <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-emerald-50 transition-colors" onClick={(e) => { e.stopPropagation(); toggleFavorite(venue.name); }}>
                      <Heart size={16} strokeWidth={2.5} className={favorites.includes(venue.name) ? "fill-[#ef4444] text-[#ef4444]" : "text-slate-400"} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-slate-300">•</span> Turf
                    </div>
                    <div className="flex gap-2 text-[var(--qp-primary)]">
                      <button type="button" className="p-1.5 hover:bg-emerald-50 rounded-full transition-colors"><MapPin size={18} strokeWidth={2.5} /></button>
                      <button type="button" className="p-1.5 hover:bg-emerald-50 rounded-full transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4L22 2z"/></svg></button>
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
          <h2 className="text-[22px] font-black text-[#0f172a] tracking-tight mb-4">All Turfs</h2>
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search venues, sports..." 
              className="w-full bg-white rounded-[14px] py-3.5 pl-11 pr-4 text-[13px] font-medium text-slate-800 shadow-sm border border-emerald-50 focus:outline-none focus:ring-2 focus:ring-[var(--qp-primary)]/20 placeholder-slate-400"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-4 snap-x">
             <button type="button" onClick={() => setSelectedSport('All Sports')} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === 'All Sports' ? 'bg-[var(--qp-primary)] text-white border-[var(--qp-primary)]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>All Sports</button>
             {['Cricket', 'Football', 'Tennis'].map((sport) => (
                <button key={sport} type="button" onClick={() => setSelectedSport(sport)} className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-full text-xs font-bold shadow-sm snap-start transition-colors border ${selectedSport === sport ? 'bg-[var(--qp-primary)] text-white border-[var(--qp-primary)]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {sport}
                </button>
              ))}
          </div>
          
          <div className="flex flex-col gap-5 mt-2">
            {loading && <p className="text-center py-8 text-slate-500 font-bold text-sm">Loading venues...</p>}
            {!loading && venues.length === 0 && <p className="text-center py-8 text-slate-500 font-bold text-sm">No venues match your search.</p>}
            {venues.map((venue) => (
              <article key={venue.name} className="bg-white rounded-[1.25rem] p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedVenue(venue)}>
                  <div className="flex justify-between items-start mb-2.5 px-1">
                    <div>
                      <h3 className="font-black text-[#0f172a] text-[17px] uppercase tracking-tight leading-none mb-1.5">{venue.name}</h3>
                      <div className="flex items-start gap-1">
                        <MapPin size={12} className="text-slate-400 mt-[2px] shrink-0" />
                        <p className="text-[10px] text-slate-500 font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                      </div>
                      {userLocation !== 'All Locations' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-bold text-[var(--qp-primary)] bg-[var(--qp-primary-soft)] px-1.5 py-0.5 rounded uppercase tracking-wider">{venue.distance || '1.2 km'} Away</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                      <Star size={12} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
                      <span className="text-[11px] font-black text-slate-900">4.0</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3">
                    <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
                    <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-[var(--qp-primary)] shadow-md hover:bg-emerald-50 transition-colors" onClick={(e) => { e.stopPropagation(); /* handle favorite */ }}>
                      <Heart size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                      Sports <span className="text-slate-300">•</span> Turf
                    </div>
                  </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'booking' && <BookingView />}
      {activeTab === 'profile' && <ProfileView onLogout={onLogout} />}
      {activeTab === 'favorites' && <FavoritesView venues={venues} favorites={favorites} onToggleFavorite={toggleFavorite} onSelectVenue={setSelectedVenue} />}

      <nav className={`fixed bottom-6 left-4 right-4 ap-glass-panel flex justify-between items-center px-6 h-[72px] z-50 transition-all duration-300 ${showBottomNav ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`} aria-label="Customer navigation">
        <button type="button" className={`flex flex-col items-center gap-1 font-medium text-[10px] transition-colors ${activeTab === 'home' ? 'text-[var(--qp-primary)]' : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)]'}`} onClick={() => { setActiveTab('home'); setSelectedSport('All Sports'); }}>
          <Home size={24} strokeWidth={activeTab === 'home' ? 2 : 1.5} />
          <span className={activeTab === 'home' ? 'text-[var(--qp-primary)] font-semibold' : ''}>Home</span>
        </button>
        <button type="button" className={`flex flex-col items-center gap-1 font-medium text-[10px] transition-colors ${activeTab === 'turf' ? 'text-[var(--qp-primary)]' : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)]'}`} onClick={() => { setActiveTab('turf'); setSelectedSport('All Sports'); }}>
          <Ticket size={24} strokeWidth={activeTab === 'turf' ? 2 : 1.5} />
          <span className={activeTab === 'turf' ? 'text-[var(--qp-primary)] font-semibold' : ''}>Turf</span>
        </button>
        <button type="button" className={`flex flex-col items-center gap-1 font-medium text-[10px] transition-colors ${activeTab === 'booking' ? 'text-[var(--qp-primary)]' : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)]'}`} onClick={() => setActiveTab('booking')}>
          <CalendarDays size={24} strokeWidth={activeTab === 'booking' ? 2 : 1.5} />
          <span className={activeTab === 'booking' ? 'text-[var(--qp-primary)] font-semibold' : ''}>Booking</span>
        </button>
        <button type="button" className={`flex flex-col items-center gap-1 font-medium text-[10px] transition-colors ${activeTab === 'favorites' ? 'text-[var(--qp-primary)]' : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)]'}`} onClick={() => setActiveTab('favorites')}>
          <Heart size={24} strokeWidth={activeTab === 'favorites' ? 2 : 1.5} />
          <span className={activeTab === 'favorites' ? 'text-[var(--qp-primary)] font-semibold' : ''}>Favorites</span>
        </button>
        <button type="button" className={`flex flex-col items-center gap-1 font-medium text-[10px] transition-colors ${activeTab === 'profile' ? 'text-[var(--qp-primary)]' : 'text-[var(--qp-text-sec)] hover:text-[var(--qp-text)]'}`} onClick={() => setActiveTab('profile')}>
          <UserRound size={24} strokeWidth={activeTab === 'profile' ? 2 : 1.5} />
          <span className={activeTab === 'profile' ? 'text-[var(--qp-primary)] font-semibold' : ''}>Profile</span>
        </button>
      </nav>

      {/* --- LOCATION SELECTOR MODAL --- */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/50 backdrop-blur-sm p-4 pt-20 animate-in fade-in">
          <div className="flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 relative">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between z-10 bg-white">
              <div className="flex items-center gap-2">
                {isMapView && (
                  <button onClick={() => setIsMapView(false)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500">
                    <ArrowLeft size={18} strokeWidth={2.5} />
                  </button>
                )}
                <h3 className="font-black text-slate-900">{isMapView ? 'Select on Map' : 'Select Location'}</h3>
              </div>
              <button onClick={() => { setIsLocationModalOpen(false); setIsMapView(false); }} className="p-2 rounded-full bg-slate-100 text-slate-500">
                <span className="sr-only">Close</span>
                X
              </button>
            </div>
            
            {isMapView ? (
              <div className="flex-1 relative flex flex-col bg-slate-100">
                <div className="absolute inset-0 z-0">
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80" alt="Map" className="w-full h-full object-cover opacity-70" />
                  <div className="absolute inset-0 bg-[var(--qp-primary)]/10 mix-blend-color"></div>
                </div>
                
                {/* Center Pin */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none">
                  <div className="bg-[#0f172a] text-white text-[10px] font-bold px-3 py-1.5 rounded-full mb-1 shadow-md">
                    Move map to adjust
                  </div>
                  <MapPin size={40} className="text-[var(--qp-primary)] drop-shadow-md -mt-2 fill-white" />
                </div>

                <div className="mt-auto p-4 z-10 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-[var(--qp-primary)]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Selected Location</h4>
                      <p className="text-xs text-slate-500 font-medium">Pin drop location</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setUserLocation('Map Selection');
                      setIsLocationModalOpen(false);
                      setIsMapView(false);
                    }}
                    className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-white p-3.5 rounded-xl font-bold transition-colors shadow-md"
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search city or neighborhood..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--qp-primary)]"
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
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl mb-2 transition-colors ${userLocation === 'All Locations' ? 'bg-[var(--qp-primary)]/10 text-[var(--qp-primary)]' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Globe2 size={18} className={userLocation === 'All Locations' ? 'text-[var(--qp-primary)]' : 'text-slate-500'} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">All Locations</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Search everywhere</p>
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
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors ${userLocation === loc ? 'bg-[var(--qp-primary)]/10 text-[var(--qp-primary)]' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <MapPin size={18} className={userLocation === loc ? 'text-[var(--qp-primary)]' : 'text-slate-500'} />
                      </div>
                      <div className="text-left font-bold text-sm flex-1">{loc}</div>
                      {userLocation === loc && <Check size={16} className="text-[var(--qp-primary)]" />}
                    </button>
                  ))}
                  
                  {suggestedLocations.length === 0 && (
                    <div className="p-8 text-center text-slate-400">
                      <MapPin size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-semibold">No cities found matching "{locationSearch}"</p>
                      <button 
                        onClick={() => {
                          setUserLocation(locationSearch);
                          setIsLocationModalOpen(false);
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                      >
                        Search exactly for "{locationSearch}"
                      </button>
                    </div>
                  )}
                </div>

                {/* Select via current location feature */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto shrink-0">
                  <button
                    onClick={handleGetCurrentLocation}
                    className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-slate-800 text-white p-3.5 rounded-xl font-bold transition-colors shadow-[0_4px_15px_rgba(15,23,42,0.2)]"
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
  const [details, setDetails] = useState<any>(null);
  useEffect(() => { if (!venue.id.startsWith('demo-')) api.getSalonDetail(venue.id).then(setDetails).catch(() => undefined); }, [venue.id]);
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
    <main className="bg-[#f8fafc] min-h-[100dvh] pb-24 relative animate-in fade-in zoom-in-95" aria-label={`${name} details`}>
      {/* Hero Image */}
      <div className="relative h-[20vh] min-h-[140px] w-full">
        <img src={salon?.coverUrl || venue.image || "https://images.unsplash.com/photo-1553778263-73a83bab9b0c"} alt={`${name} turf`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
        <button type="button" className="absolute top-4 left-4 w-8 h-8 bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md rounded-full flex items-center justify-center text-white z-10" onClick={onBack} aria-label="Back to venues">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <button type="button" className="absolute top-4 right-4 w-8 h-8 bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-md rounded-full flex items-center justify-center text-white z-10" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <div className="absolute bottom-4 right-4 flex gap-1 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm"></div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-t-[1.5rem] -mt-5 relative z-20 px-4 pt-4 pb-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex flex-col gap-3">
        <div>
          <div className="flex justify-between items-start">
            <h1 className="text-[22px] leading-none font-black text-[#0f172a] uppercase">{name}</h1>
            <Heart size={20} className="text-[var(--qp-primary)]" />
          </div>
          <div className="flex items-start gap-1.5 mt-1">
            <MapPin size={14} className="text-[var(--qp-primary)] shrink-0 mt-0.5" />
            <p className="text-[12px] text-slate-600 leading-tight line-clamp-2">{address}</p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Star size={14} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
            <span className="font-bold text-slate-900 text-sm">{salon?.rating || 4.0}</span>
            <span className="text-slate-400 text-[11px]">[{salon?.reviewCount || 0}]</span>
          </div>
        </div>

        <div className="flex gap-2.5 customer-turf-actions">
          <button type="button" className="bg-[#ff5722] hover:bg-[#e64a19] text-white px-5 py-2.5 rounded-[10px] font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-[13px]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Get Direction
          </button>
          <button type="button" className="w-[42px] h-[42px] shrink-0 bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-white rounded-[10px] flex items-center justify-center shadow-sm transition-colors" aria-label="Call venue">
            <Phone size={18} strokeWidth={2.5} className="fill-white"/>
          </button>
        </div>

        {/* Highlight Cards */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none snap-x">
          <div className="min-w-[100px] snap-start flex-1 bg-[#f0fdf4] border border-[#dcfce7] rounded-lg p-2 flex items-start gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <div>
              <p className="text-[10px] font-bold text-slate-900 leading-tight">Flexible offer</p>
              <p className="text-[8px] text-slate-500 mt-0.5">{salon?.bookingSettings?.cancellationPolicy || 'On all slots'}</p>
            </div>
          </div>
          <div className="min-w-[100px] snap-start flex-1 bg-[#f0fdf4] border border-[#dcfce7] rounded-lg p-2 flex items-start gap-1.5">
            <CalendarDays size={12} className="text-[var(--qp-primary)] shrink-0 mt-0.5" strokeWidth={2.5}/>
            <div>
              <p className="text-[10px] font-bold text-slate-900 leading-tight">Available slots</p>
              <p className="text-[8px] text-slate-500 mt-0.5">Book online</p>
            </div>
          </div>
          <div className="min-w-[100px] snap-start flex-1 bg-[#f0fdf4] border border-[#dcfce7] rounded-lg p-2 flex items-start gap-1.5">
            <ShieldCheck size={12} className="text-[var(--qp-primary)] shrink-0 mt-0.5" strokeWidth={2.5}/>
            <div>
              <p className="text-[10px] font-bold text-slate-900 leading-tight">Verified venue</p>
              <p className="text-[8px] text-slate-500 mt-0.5">QGo protected</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-8 mt-1">
          {/* Available Sports */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M12 9l2 3-1 6"/><path d="M14 12h4"/><path d="M7 11l4-2 3 5"/><path d="M5 22l4-5"/></svg>
              <h2 className="text-[13px] font-bold text-slate-900">Sports</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {(salon?.resources?.length ? salon.resources.map((resource: any) => resource.name) : ['Turf 1']).map((sport: string, index: number) => (
                <button className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${index === 0 ? 'bg-[var(--qp-primary)] text-white' : 'bg-slate-100 text-slate-600'}`} type="button" key={sport}>{sport}</button>
              ))}
            </div>
          </div>

          {/* Venue Info */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Info size={14} className="text-[var(--qp-primary)] fill-[var(--qp-primary)] text-white" />
              <h2 className="text-[13px] font-bold text-slate-900">Venue info</h2>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="bg-[var(--qp-primary)] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm">Pitch</span>
                <span className="text-[11px] font-medium text-slate-900">- {salon?.resources?.length || 1} Nets</span>
              </div>
              <div className="flex items-start gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M4 20h16"/><path d="M5 20V12l3 3 4-7 4 7 3-3v8"/></svg>
                <div>
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Equipment</p>
                  <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{salon?.description || 'Artificial Turf'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="mt-1">
          <div className="flex items-center gap-1 mb-1.5">
            <Star size={14} className="text-[var(--qp-primary)] fill-[var(--qp-primary)]" />
            <h2 className="text-[13px] font-bold text-slate-900">Amenities</h2>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(salon?.facilities?.length ? salon.facilities : ['Sports / Turf', 'Washroom', 'Parking']).slice(0, 3).map((amenity: string) => (
              <div key={amenity} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <div className="w-3 h-3 bg-[var(--qp-primary)] rounded-sm flex items-center justify-center">
                   <Check size={8} className="text-white" strokeWidth={4} />
                </div>
                {amenity}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-100 z-50">
        <button type="button" className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] text-white py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 shadow-sm transition-all" onClick={onProceed}>
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
  const [localDraft, setLocalDraft] = useState(draft);
  const [customerName, setCustomerName] = useState(draft.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone || '');
  const [notes, setNotes] = useState(draft.notes || '');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [slotFilter, setSlotFilter] = useState<'all' | 'morning' | 'evening'>('all');

  useEffect(() => setLocalDraft(draft), [draft]);
  const date = localDraft.date || new Date().toISOString().split('T')[0];
  const [availability, setAvailability] = useState<{ slots: any[]; isOpen?: boolean; message?: string } | null>(null);
  
  useEffect(() => { 
    if (!venue.id.startsWith('demo-')) {
      api.getAvailability(venue.id, { date, durationMinutes: 60, slotCategory: 'adult' } as any)
         .then(setAvailability)
         .catch(() => setAvailability({ slots: [] })); 
    } 
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
    onContinueDraft({ 
      ...localDraft, 
      startTime: selectedSlots[0].startTime,
      endTime: selectedSlots[selectedSlots.length - 1].endTime,
      price: totalPayable,
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
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none scroll-smooth animate-in fade-in" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="flex min-h-[100dvh] flex-col sm:items-center sm:justify-center p-0 sm:py-12 sm:px-6">
        <div className="bg-white w-full flex-1 sm:flex-none sm:max-w-2xl rounded-none sm:rounded-[1.5rem] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
          
          {/* Header */}
        <div className="bg-[var(--qp-text)] p-6 text-white relative rounded-b-[2rem] shadow-sm z-10">
          <button onClick={onBack} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
             <span className="sr-only">Close</span>
             <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12m0-12L1 13"/></svg>
          </button>
          <div className="inline-flex items-center gap-1.5 bg-[var(--qp-primary-hover)] text-white text-[10px] font-bold px-2 py-1 rounded mb-3">
             <span>🎫</span> BOOK A TURF SLOT
          </div>
          <h2 className="text-2xl font-black mb-1">{venue.name}</h2>
          <p className="text-xs text-white/70 leading-relaxed max-w-[85%]">{venue.address || 'Chennai, Tamil Nadu, India'}</p>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-5 sm:p-6 space-y-8 bg-[#f8fafc]">
          
          {/* Dates */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">1. Select Date</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
              {generateDates().map(d => (
                <button key={d.iso} onClick={() => { setLocalDraft({ ...localDraft, date: d.iso }); setSelectedSlotIds([]); }} className={`flex-shrink-0 w-[64px] h-[76px] rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${d.active ? 'bg-[var(--qp-primary-hover)] border-[var(--qp-primary-hover)] text-white shadow-md shadow-green-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-[var(--qp-primary-hover)]/50'}`}>
                  <span className={`text-[10px] font-semibold uppercase ${d.active ? 'text-white/90' : 'text-slate-400'}`}>{d.label}</span>
                  <span className="text-lg font-black">{d.day}</span>
                  <span className={`text-[10px] font-semibold ${d.active ? 'text-white/90' : 'text-slate-400'}`}>{d.mon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Slots */}
          <div className="bg-white rounded-[1rem] p-4 sm:p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Available Slots (2026-08-29)</h3>
                <p className="text-[10px] text-slate-500">Slots for {venue.name}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-full border border-slate-200">
                <button onClick={() => setSlotFilter('all')} className={`px-3 py-1 text-[10px] font-bold rounded-full shadow-sm ${slotFilter === 'all' ? 'bg-[var(--qp-primary-hover)] text-white' : 'text-slate-600 hover:bg-slate-200'}`}>All</button>
                <button onClick={() => setSlotFilter('morning')} className={`px-3 py-1 text-[10px] font-bold rounded-full shadow-sm ${slotFilter === 'morning' ? 'bg-[var(--qp-primary-hover)] text-white' : 'text-slate-600 hover:bg-slate-200'}`}>☀️ Morning</button>
                <button onClick={() => setSlotFilter('evening')} className={`px-3 py-1 text-[10px] font-bold rounded-full shadow-sm ${slotFilter === 'evening' ? 'bg-[var(--qp-primary-hover)] text-white' : 'text-slate-600 hover:bg-slate-200'}`}>🌙 Evening</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displaySlots.map((slot) => {
                const isActive = selectedSlotIds.includes(slot.id);
                const isBooked = !slot.available;
                // Day vs Night logic
                const hour = parseInt(slot.startTime.split(':')[0], 10);
                const isDayTime = hour >= 6 && hour < 18;
                const timeStr = `${isDayTime ? '☀️' : '🌙'} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                
                const theme = isDayTime ? {
                  bg: 'bg-[#FFFAF0]',
                  border: 'border-[#FDE68A]',
                  hover: 'hover:border-[#FCD34D]',
                  text: 'text-slate-900',
                  mutedText: 'text-slate-500',
                  bookedBg: 'bg-[#FFFAF0]/50',
                  bookedBorder: 'border-[#FDE68A]/50'
                } : {
                  bg: 'bg-[#EEF2FF]',
                  border: 'border-[#C7D2FE]',
                  hover: 'hover:border-[#A5B4FC]',
                  text: 'text-slate-900',
                  mutedText: 'text-slate-500',
                  bookedBg: 'bg-[#EEF2FF]/50',
                  bookedBorder: 'border-[#C7D2FE]/50'
                };
                
                if (isBooked) {
                  return (
                    <div key={slot.id} className={`border ${theme.bookedBorder} ${theme.bookedBg} rounded-xl p-2 flex flex-col items-center justify-center opacity-60`}>
                      <span className={`text-[9px] sm:text-[10px] font-semibold ${theme.mutedText} line-through mb-1.5 leading-tight text-center`}>{timeStr}</span>
                      <span className="text-[8px] sm:text-[9px] font-black text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded uppercase tracking-wider">Booked</span>
                    </div>
                  );
                }

                return (
                  <button key={slot.id} onClick={() => toggleSlot(slot.id)} className={`border rounded-xl p-2 flex flex-col items-start transition-all text-left ${isActive ? 'bg-[var(--qp-primary-hover)] border-[var(--qp-primary-hover)] text-white shadow-md shadow-green-500/20' : `${theme.bg} ${theme.border} ${theme.text} ${theme.hover}`}`}>
                    <span className="text-[9px] sm:text-[10px] font-bold leading-tight mb-1">{timeStr}</span>
                    <span className={`text-[9px] font-medium mb-0.5 ${isActive ? 'text-white/80' : theme.mutedText}`}>{slot.durationMinutes} min</span>
                    <span className="text-xs sm:text-sm font-black">₹{slot.price}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1.5">Your Name *</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Kishore C J" className="w-full border border-slate-300 rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder-slate-400 text-slate-900 font-medium" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-800 mb-1.5">Phone Number *</label>
              <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+91 98765 00000" className="w-full border border-slate-300 rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder-slate-400 text-slate-900 font-medium" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-800 mb-1.5">Expected Players / Team Size</label>
              <input type="number" value={localDraft.players} onChange={e => setLocalDraft({...localDraft, players: Number(e.target.value)})} placeholder="10" className="w-full border border-slate-300 rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder-slate-400 font-medium text-slate-900 bg-white" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-800 mb-1.5">Notes (Optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Football kits needed, 5v5 friendly match" className="w-full border border-slate-300 rounded-[0.75rem] px-4 py-3 text-sm focus:outline-none focus:border-[var(--qp-primary-hover)] focus:ring-1 focus:ring-[var(--qp-primary-hover)] placeholder-slate-400 font-medium text-slate-900 bg-white" />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-white p-4 pb-6 sm:p-6 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between rounded-none sm:rounded-b-[1.5rem]">
          <div className="flex justify-between items-center sm:block w-full sm:w-auto">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Payable</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 tracking-tight">₹{totalPayable}</span>
                <span className="text-[11px] font-semibold text-slate-500">(Pay at Venue)</span>
              </div>
            </div>
          </div>
          <button onClick={onContinue} disabled={!isFormValid} className={`w-full sm:w-auto text-white px-6 py-3.5 rounded-full font-bold text-[13px] flex items-center justify-center gap-2 transition-transform shadow-lg ${isFormValid ? 'bg-[var(--qp-primary-hover)] hover:bg-[var(--qp-primary)] active:scale-95 shadow-[var(--qp-primary-hover)]/30' : 'bg-slate-300 shadow-none'}`}>
            CONFIRM & BOOK SLOT
            <ArrowRight size={16} />
          </button>
        </div>

        </div>
      </div>
    </div>
  );
}

function BookingSummaryView({ venue, draft, onBack, onContinue }: { venue: { name: string }; draft: BookingDraft; onBack: () => void; onContinue: () => void }) {
  const [paymentMode, setPaymentMode] = useState<'advance' | 'full'>('full');
  
  const total = draft.price || 1600;
  const advance = Math.floor(total * 0.2); // e.g. 320
  const amountToPay = paymentMode === 'advance' ? advance : total;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none scroll-smooth bg-slate-50 flex flex-col items-center animate-in fade-in slide-in-from-right-10 duration-200">
      <div className="w-full sm:max-w-md relative pb-32">
        {/* Header Background */}
        <div className="bg-[#004d40] px-5 pt-6 pb-24 rounded-b-[2.5rem] relative shrink-0">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Sep 21 <span className="text-sm font-normal text-white/70">00:00 - 02:00</span>
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* Content Cards */}
        <div className="px-5 -mt-16 space-y-4 relative z-10">
          
          {/* Bill Details */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[var(--qp-primary-hover)]">
                <Receipt size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Bill Details</h3>
            </div>
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-slate-600 font-medium">Slot Cost</span>
              <span className="font-black text-slate-800">₹{total}</span>
            </div>
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-2 text-[var(--qp-primary-hover)] font-bold text-sm">
                <Wallet size={16} />
                <span>Total Payable</span>
              </div>
              <span className="text-2xl font-black text-[var(--qp-primary-hover)]">₹{total}</span>
            </div>
          </div>

          {/* Payment Options */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight">Payment Options</h3>
                <p className="text-[10px] text-slate-500">Choose your preferred payment method</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setPaymentMode('advance')} className={`border rounded-2xl p-4 flex flex-col text-left transition-all relative ${paymentMode === 'advance' ? 'border-[var(--qp-primary-hover)] bg-[var(--qp-primary-hover)]/5 shadow-sm shadow-[var(--qp-primary-hover)]/10' : 'border-slate-200 bg-slate-50/50 hover:border-[var(--qp-primary-hover)]/40'}`}>
                <div className="flex justify-between items-start mb-3 w-full">
                  <CreditCard size={18} className="text-slate-600" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'advance' ? 'border-[var(--qp-primary-hover)]' : 'border-slate-300'}`}>
                    {paymentMode === 'advance' && <div className="w-2 h-2 rounded-full bg-[var(--qp-primary-hover)]" />}
                  </div>
                </div>
                <div className="font-bold text-slate-800 text-sm mb-0.5">Advance</div>
                <div className="text-[10px] text-slate-500 mb-2">Pay ₹{advance} now</div>
                <div className="text-lg font-black text-slate-800 mt-auto">₹{advance}</div>
              </button>

              <button onClick={() => setPaymentMode('full')} className={`border rounded-2xl p-4 flex flex-col text-left transition-all relative ${paymentMode === 'full' ? 'border-[var(--qp-primary-hover)] bg-[var(--qp-primary-hover)]/5 shadow-sm shadow-[var(--qp-primary-hover)]/10' : 'border-slate-200 bg-slate-50/50 hover:border-[var(--qp-primary-hover)]/40'}`}>
                <div className="flex justify-between items-start mb-3 w-full">
                  <Wallet size={18} className={paymentMode === 'full' ? 'text-[var(--qp-primary-hover)]' : 'text-slate-600'} />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMode === 'full' ? 'border-[var(--qp-primary-hover)]' : 'border-slate-300'}`}>
                    {paymentMode === 'full' && <div className="w-2 h-2 rounded-full bg-[var(--qp-primary-hover)]" />}
                  </div>
                </div>
                <div className="font-bold text-slate-800 text-sm mb-0.5">Full Amount</div>
                <div className="text-[10px] text-slate-500 mb-2">Pay entire amount now</div>
                <div className={`text-lg font-black mt-auto ${paymentMode === 'full' ? 'text-[var(--qp-primary-hover)]' : 'text-slate-800'}`}>₹{total}</div>
              </button>
            </div>

            <div className="bg-gradient-to-r from-[#d9f2e6] to-[#e6f7ef] rounded-2xl p-4 flex items-center justify-between border border-[var(--qp-primary-hover)]/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--qp-primary-hover)] rounded-xl flex items-center justify-center text-white shadow-md shadow-[var(--qp-primary-hover)]/30">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Amount</div>
                  <div className="text-2xl font-black text-[var(--qp-primary-hover)] leading-none">₹{amountToPay}</div>
                </div>
              </div>
              <div className="bg-[var(--qp-primary-hover)]/10 text-[var(--qp-primary-hover)] px-2.5 py-1.5 rounded-full text-[9px] font-black tracking-widest flex items-center gap-1 uppercase">
                <Zap size={10} fill="currentColor" /> PROCESSED TO PAY
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-[var(--qp-primary-hover)]">
                <ShieldCheck size={16} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Cancellation Policy</h3>
            </div>
            
            <div className="bg-[#f4faf8] rounded-2xl p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-[var(--qp-primary-hover)] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cancel before <span className="font-bold text-[var(--qp-primary-hover)]">24 hours of start time</span> to avail a refund.<br />
                  <span className="text-slate-500">Service fee is non-refundable.</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-[var(--qp-primary-hover)] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  If you cancel after the above time, you will lose the entire amount paid.
                </p>
              </div>
            </div>
          </div>

        </div>
        
        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md sm:relative sm:bg-transparent z-50">
          <div className="max-w-md mx-auto">
            <button onClick={onContinue} className="w-full bg-[var(--qp-primary-hover)] hover:bg-[#00b075] active:scale-[0.98] transition-all text-white py-4 rounded-full font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[var(--qp-primary-hover)]/30">
              <LockKeyhole size={18} /> PROCEED TO PAY ₹{amountToPay} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentView({ venue, user, draft, onBack, onPaid }: { venue: { id: string; name: string; image?: string }; user: any; draft: BookingDraft; onBack: () => void; onPaid: (booking: any) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'google' | 'phonepe' | 'paytm'>('google');
  const basePrice = draft.price || 1600;
  const gst = Math.floor(basePrice * 0.18);
  const totalPayable = basePrice + gst;

  const pay = async () => {
    if (venue.id.startsWith('demo-')) { setError('This venue is demo data and cannot accept a real booking yet.'); return; }
    if (!user) { setError('Please sign in again before booking.'); return; }
    if (!draft.date || !draft.startTime || !draft.endTime || draft.endTime <= draft.startTime) { setError('Complete a valid date and time range before continuing.'); return; }
    setLoading(true);
    
    // Simulate real GPay network delay if using Google Pay
    if (paymentMethod === 'google') {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    const result = await api.createBooking({ salonId: venue.id, customerName: user.name || user.displayName || 'Customer', customerPhone: user.phone || '', mode: 'appointment', scheduledDate: draft.date, scheduledTime: draft.startTime, slotEndTime: draft.endTime, numberOfPlayers: draft.players, notes: `${draft.format}; ${draft.pitches} pitch${draft.pitches === 1 ? '' : 'es'}` });
    setLoading(false);
    if (result.success && result.booking) onPaid(result.booking);
    else setError(result.error || 'This slot is no longer available. Please choose another slot.');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-none bg-[#f9fafb] flex flex-col items-center animate-in fade-in slide-in-from-right-10 duration-200">
      
      {/* Full Screen GPay Loading Overlay */}
      {loading && paymentMethod === 'google' && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin mb-8"></div>
            <div className="flex font-black text-[42px] leading-none tracking-tight mb-3">
              <span className="text-[#34a853]">G</span>
              <span className="text-[#ea4335]">P</span>
              <span className="text-[#fbbc05]">a</span>
              <span className="text-[#4285f4]">y</span>
            </div>
            <p className="text-slate-600 font-bold text-sm">Processing your payment...</p>
            <p className="text-slate-400 font-semibold text-xs mt-2">Please do not close this window</p>
          </div>
        </div>
      )}

      <div className="w-full sm:max-w-md relative pb-24">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 pt-8 mb-2">
          <button onClick={onBack} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-slate-900" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 absolute left-1/2 -translate-x-1/2">Secure Checkout</h1>
          <div className="w-6" />
        </div>

        {/* Order Summary Card */}
        <div className="mx-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[17px] font-bold text-slate-900">Order Summary</h2>
            <ChevronDown size={20} className="text-[#3b82f6]" />
          </div>
          <div className="flex gap-4 items-start mb-5">
            <img src={venue.image || 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c'} alt="turf" className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-slate-900 text-[15px]">Turf Booking</h3>
                <span className="font-bold text-slate-900">₹{basePrice}</span>
              </div>
              <p className="text-[13px] text-slate-500">{draft.format || 'Football'} Turf - Premium</p>
              <p className="text-[11px] text-slate-400 mt-1">Qty: 1 • {draft.date} - {draft.startTime} - {draft.endTime}</p>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-4 pb-2 space-y-2">
            <div className="flex justify-between text-[13px] text-slate-700">
              <span>Base Price</span>
              <span className="font-bold text-slate-900">₹{basePrice}</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-700">
              <span>Discount</span>
              <span className="font-bold text-slate-900">- ₹0</span>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-3 pb-3 space-y-2">
            <div className="flex justify-between text-[13px] text-slate-700">
              <span>Subtotal</span>
              <span className="font-bold text-slate-900">₹{basePrice}</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-700">
              <span>GST (18%)</span>
              <span className="font-bold text-slate-900">₹{gst}</span>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
            <span className="font-bold text-slate-900 text-base">Total Payable</span>
            <span className="text-2xl font-black text-[var(--qp-primary-hover)]">₹{totalPayable}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mx-4 mb-5">
          <h2 className="text-[17px] font-bold text-slate-900 mb-0.5">Payment Method</h2>
          <p className="text-[11px] text-slate-500 mb-4">Choose your preferred payment method</p>
          
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setPaymentMethod('google')} className={`border-2 bg-white rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-all ${paymentMethod === 'google' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-slate-200 hover:border-slate-300'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'google' ? 'bg-[var(--qp-primary-hover)] text-white' : 'border border-slate-300'}`}>
                {paymentMethod === 'google' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="font-bold text-[11px] text-slate-900">Google Pay</span>
            </button>

            <button onClick={() => setPaymentMethod('phonepe')} className={`border-2 bg-white rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-all ${paymentMethod === 'phonepe' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-slate-200 hover:border-slate-300'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'phonepe' ? 'bg-[var(--qp-primary-hover)] text-white' : 'border border-slate-300'}`}>
                {paymentMethod === 'phonepe' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="w-[18px] h-[18px] bg-[#5f259f] rounded-full flex items-center justify-center text-white text-[10px] font-black leading-none pt-[1px]">Pe</div>
              </div>
              <span className="font-bold text-[11px] text-slate-900">PhonePe</span>
            </button>

            <button onClick={() => setPaymentMethod('paytm')} className={`border-2 bg-white rounded-xl p-3 flex flex-col items-center justify-center relative shadow-sm transition-all ${paymentMethod === 'paytm' ? 'border-[var(--qp-primary-hover)]' : 'border-transparent border-slate-200 hover:border-slate-300'}`}>
              <div className={`absolute top-2 right-2 w-[14px] h-[14px] rounded-full flex items-center justify-center ${paymentMethod === 'paytm' ? 'bg-[var(--qp-primary-hover)] text-white' : 'border border-slate-300'}`}>
                {paymentMethod === 'paytm' && <Check size={10} strokeWidth={4}/>}
              </div>
              <div className="mb-2 mt-1">
                <div className="flex font-black text-[14px] leading-none tracking-tight">
                  <span className="text-[#002e6e]">Pay</span><span className="text-[#00b9f5]">tm</span>
                </div>
              </div>
              <span className="font-bold text-[11px] text-slate-900">Paytm</span>
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs font-semibold mb-4 mx-4 text-center">{error}</p>}

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#f9fafb] sm:relative sm:bg-transparent z-50">
          <div className="max-w-md mx-auto">
            <button onClick={pay} disabled={loading} className="w-full bg-[var(--qp-primary)] hover:bg-[var(--qp-primary-hover)] active:scale-[0.98] transition-all text-white py-4 rounded-[14px] font-bold text-[16px] flex items-center justify-center gap-2 shadow-sm">
              <LockKeyhole size={18} /> {loading ? 'Confirming...' : 'Complete Order'} <ArrowRight size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function PaidView() { 
  return (
    <div className="fixed inset-0 bg-[var(--qp-primary)] flex flex-col items-center justify-center z-[100] animate-in slide-in-from-bottom-10">
      <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl animate-in zoom-in duration-500 delay-150">
        <Check size={56} strokeWidth={3} className="text-[var(--qp-primary)]" />
      </div>
      <h1 className="text-[28px] font-black text-white mb-3 tracking-tight">Payment Successful!</h1>
      <p className="text-emerald-100 font-bold text-sm">Generating your ticket...</p>
    </div>
  );
}

function TicketView({ venue, user, booking, draft, onHome }: { venue: { name: string }; user: any; booking: any; draft: BookingDraft; onHome: () => void }) {
  useEffect(() => {
    const handleDownload = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('.ticket-download-btn');
      if (button) window.print();
    };
    document.addEventListener('click', handleDownload);
    return () => document.removeEventListener('click', handleDownload);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#f8fafc] z-[100] overflow-y-auto flex flex-col pt-8 pb-24 px-5 items-center animate-in fade-in slide-in-from-bottom-5">
      <div className="w-full max-w-sm mb-6 text-center mt-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">You're All Set!</h1>
        <p className="text-slate-500 font-medium text-sm">Present this ticket at the venue</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl overflow-hidden relative border border-slate-100">
        {/* Ticket Header */}
        <div className="bg-[#0f172a] p-6 text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <h2 className="text-white font-black text-[22px] mb-1 tracking-tight leading-none uppercase">{venue.name}</h2>
          <p className="text-slate-400 font-bold text-[10px] tracking-widest uppercase">{draft.format}</p>
        </div>

        {/* Perforation Line */}
        <div className="relative flex items-center justify-between px-2 -my-3 z-10">
          <div className="w-6 h-6 bg-[#f8fafc] rounded-full shrink-0 shadow-inner"></div>
          <div className="flex-1 border-t-2 border-dashed border-slate-200"></div>
          <div className="w-6 h-6 bg-[#f8fafc] rounded-full shrink-0 shadow-inner"></div>
        </div>

        {/* Ticket Body */}
        <div className="p-6 pt-8 pb-8">
          <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
              <p className="font-black text-slate-900 text-sm">{draft.date}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time</p>
              <p className="font-black text-[var(--qp-primary)] text-[13px]">{draft.startTime} - {draft.endTime}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</p>
              <p className="font-black text-slate-900 text-sm line-clamp-1">{user?.name || user?.displayName || 'Customer'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
              <p className="font-black text-slate-900 text-sm">₹{booking?.amount || draft.price || '1600'}</p>
            </div>
          </div>

          <div className="flex flex-col items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
            <div className="absolute inset-0 bg-white opacity-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <QrCode size={110} className="text-slate-900 mb-3 relative z-10" strokeWidth={1.5} />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center relative z-10">Scan at Entrance</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 relative z-10">ID: {booking?.id?.slice(0,8).toUpperCase() || 'QGO-8X92K'}</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm mt-8 flex flex-col gap-3">
        <button className="ticket-download-btn w-full bg-[#0f172a] hover:bg-slate-800 text-white p-4 rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center gap-2">
          <Download size={18} /> Download Ticket
        </button>
        <button onClick={onHome} className="w-full bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-[14px] font-bold transition-colors flex items-center justify-center gap-2">
          Back to Home
        </button>
      </div>
    </div>
  );
}

function BookingView() {
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
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#f8fafc] px-5 pt-8 pb-32">
      <h2 className="text-2xl font-black text-[#0f172a] tracking-tight mb-6">My Bookings</h2>
      
      <div className="flex bg-white rounded-full p-1 shadow-sm border border-slate-100 mb-6 relative z-10">
        <button className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${activeTab === 'upcoming' ? 'bg-[var(--qp-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setActiveTab('upcoming')}>Upcoming</button>
        <button className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-colors ${activeTab === 'past' ? 'bg-[var(--qp-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setActiveTab('past')}>Past</button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && <p className="text-center py-8 text-slate-500 font-bold text-sm">Loading bookings...</p>}
        {!loading && bookings.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><CalendarDays size={24} className="text-slate-400" /></div>
            <p className="text-slate-500 font-bold text-sm">No {activeTab} bookings found.</p>
          </div>
        )}
        {!loading && bookings.map(b => (
          <article key={b.id} className="bg-white rounded-[1.25rem] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-emerald-50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-black text-[#0f172a] text-[15px] tracking-tight">{b.salonName || 'Venue'}</h3>
                <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex inline-flex items-center gap-1 mt-1"><Clock size={12}/> {new Date(b.date).toLocaleDateString()} • {b.startTime}</p>
              </div>
              <div className="bg-slate-50 px-2 py-1 rounded-lg text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Paid</p>
                <p className="text-xs font-black text-slate-900">₹{b.amount || '0'}</p>
              </div>
            </div>
            <div className="flex gap-2">
               <button className="flex-1 bg-emerald-50 text-[var(--qp-primary)] py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-emerald-100">Get Directions</button>
               <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-slate-50">View Ticket</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ onLogout }: { onLogout: () => void }) {
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
      icon: <Globe2 size={20} strokeWidth={2} className="text-[#3b82f6]" />, 
      bg: 'bg-[#dbeafe]',
      onClick: () => setLang(l => l === 'EN' ? 'TA' : 'EN')
    },
    { 
      id: 'account', 
      label: 'Account', 
      sub: 'Manage your personal details', 
      icon: <UserCircle size={20} strokeWidth={2} className="text-[var(--qp-primary)]" />, 
      bg: 'bg-[#e0f5eb]' 
    },
    { 
      id: 'booking', 
      label: 'Your Booking', 
      sub: 'View and manage your bookings', 
      icon: <CalendarDays size={20} strokeWidth={2} className="text-[var(--qp-primary)]" />, 
      bg: 'bg-[#e0f5eb]' 
    },
    { 
      id: 'refunds', 
      label: 'Refunds', 
      sub: 'Track your refunds and wallet', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 8h8M8 12h8M9 8v10M11 12l4 4"/></svg>, 
      bg: 'bg-[#e0f5eb]' 
    },
    { 
      id: 'favorites', 
      label: 'Favourite Venues', 
      sub: 'Your saved venues', 
      icon: <Heart size={20} strokeWidth={2} className="text-[#ef4444]" />, 
      bg: 'bg-[#fee2e2]' 
    },
    { 
      id: 'support', 
      label: 'Support', 
      sub: 'Get help & contact us', 
      icon: <Headphones size={20} strokeWidth={2} className="text-[#8b5cf6]" />, 
      bg: 'bg-[#ede9fe]' 
    },
    { 
      id: 'privacy', 
      label: 'Privacy Policy', 
      sub: 'How we protect your data', 
      icon: <ShieldCheck size={20} strokeWidth={2} className="text-[#3b82f6]" />, 
      bg: 'bg-[#dbeafe]' 
    },
    { 
      id: 'terms', 
      label: 'Terms of use', 
      sub: 'Read our terms and conditions', 
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 12v4M12 16h.01"/></svg>, 
      bg: 'bg-[#fef3c7]' 
    },
  ];

  const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6"/></svg>
  );

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#f8fafc] dark:bg-slate-950 px-4 pt-4 pb-[88px] animate-in fade-in">
      {/* Header Card */}
      <div className="w-full rounded-[2rem] bg-gradient-to-br from-[#e0f5eb] to-[#bbf7d0] dark:from-emerald-900/40 dark:to-emerald-800/20 p-5 mb-5 relative overflow-hidden shadow-sm">
        {/* Decorative Graphic */}
        <div className="absolute top-1/2 right-[-20px] -translate-y-1/2 w-48 h-48 opacity-[0.15] mix-blend-multiply dark:mix-blend-lighten pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-[var(--qp-primary)]">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            <path d="M11 6.5v4l-3.5 2 1.5 2.5 4.5-2.5 4.5 2.5 1.5-2.5-3.5-2v-4h-5z"/>
          </svg>
        </div>

        {/* Edit Button */}
        <button type="button" className="absolute top-4 right-4 w-9 h-9 bg-white/70 dark:bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shadow-sm text-slate-700 dark:text-white hover:bg-white dark:hover:bg-white/20 transition-colors z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>

        <div className="relative z-10 flex flex-col items-center justify-center text-center pt-2">
          <div className="w-[64px] h-[64px] rounded-full bg-[var(--qp-primary)] flex items-center justify-center text-3xl font-black text-white shadow-md mb-3">
            {user?.name?.charAt(0) || user?.displayName?.charAt(0) || 'C'}
          </div>
          <h2 className="text-xl font-black text-[#0f172a] dark:text-white tracking-tight mb-0.5">{user?.name || user?.displayName || 'Customer'}</h2>
          <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 mb-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className="text-xs font-medium">{user?.email || 'customer@gmail.com'}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-white/80 dark:bg-emerald-950/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm mb-4">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--qp-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="2 4 5 18 19 18 22 4 17 8 12 4 7 8 2 4"/></svg>
            <span className="text-[10px] font-black text-[var(--qp-primary)] dark:text-emerald-400 uppercase tracking-wide">Premium Member</span>
          </div>

          {/* Theme Switcher Toggle */}
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm border border-slate-200 dark:border-slate-800">
            <button 
              type="button" 
              onClick={() => handleThemeChange('light')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Sun size={12} strokeWidth={2.5} /> LIGHT
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button 
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-colors ${theme === 'system' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              SYSTEM
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button 
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold transition-colors ${theme === 'dark' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Moon size={12} strokeWidth={2.5} /> DARK
            </button>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="flex flex-col gap-2 mb-2">
        {menuItems.map((item) => (
          <button type="button" key={item.id} onClick={item.onClick} className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-slate-100 active:scale-[0.98] transition-transform text-left">
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
              {item.icon}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-black text-[#0f172a] mb-0">{item.label}</h3>
              <p className="text-[10px] font-medium text-slate-500">{item.sub}</p>
            </div>
            <ChevronRightIcon className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button type="button" onClick={onLogout} className="w-full bg-[#fff5f5] rounded-2xl p-3 flex items-center gap-3 border border-[#fee2e2] shadow-[0_2px_15px_rgba(239,68,68,0.05)] active:scale-[0.98] transition-transform text-left mt-1">
        <div className="w-10 h-10 rounded-xl bg-[#fee2e2] flex items-center justify-center shrink-0">
          <LogOut size={20} strokeWidth={2.5} className="text-[#ef4444]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-black text-[#ef4444] mb-0">Logout</h3>
          <p className="text-[10px] font-medium text-[#ef4444]/70">Sign out from your account</p>
        </div>
        <ChevronRightIcon className="text-[#ef4444]/40 shrink-0" />
      </button>

    </div>
  );
}

function FavoritesView({ venues, favorites, onToggleFavorite, onSelectVenue }: { venues: any[], favorites: string[], onToggleFavorite: (name: string) => void, onSelectVenue: (v: any) => void }) {
  const favVenues = venues.filter(v => favorites.includes(v.name));

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-[#f8fafc] px-5 pt-8 pb-32">
      <h2 className="text-2xl font-black text-[#0f172a] tracking-tight mb-6">Favourite Venues</h2>
      <div className="flex flex-col gap-5">
        {favVenues.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4"><Heart size={24} className="text-rose-300" /></div>
            <p className="text-slate-500 font-bold text-sm">You haven't saved any venues yet.</p>
          </div>
        )}
        {favVenues.map((venue) => (
          <article key={venue.name} className="bg-white rounded-[1.25rem] p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectVenue(venue)}>
            <div className="flex justify-between items-start mb-2.5 px-1">
              <div>
                <h3 className="font-black text-[#0f172a] text-[17px] uppercase tracking-tight leading-none mb-1.5">{venue.name}</h3>
                <div className="flex items-start gap-1">
                  <MapPin size={12} className="text-slate-400 mt-[2px] shrink-0" />
                  <p className="text-[10px] text-slate-500 font-medium leading-snug line-clamp-2 pr-4">{venue.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full shrink-0">
                <Star size={12} className="fill-[var(--qp-primary)] text-[var(--qp-primary)]" />
                <span className="text-[11px] font-black text-slate-900">4.0</span>
              </div>
            </div>
            
            <div className="relative w-full h-[150px] rounded-xl overflow-hidden mb-3">
              <img src={venue.image} alt={venue.name} className="w-full h-full object-cover" />
              <button type="button" className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-rose-50 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFavorite(venue.name); }}>
                <Heart size={16} strokeWidth={2.5} className="fill-[#ef4444] text-[#ef4444]" />
              </button>
            </div>
            
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                Sports <span className="text-slate-300">•</span> Turf
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
