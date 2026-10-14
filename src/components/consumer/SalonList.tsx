import React, { useState, useEffect } from 'react';
import { Salon } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import {
  Search,
  MapPin,
  Star,
  Users,
  Clock,
  CheckCircle2,
  Filter,
  Ticket,
  ChevronRight,
  LocateFixed,
  Map,
  Navigation} from 'lucide-react';

interface SalonListProps {
  onSelectSalon: (salon: Salon) => void;
  onOpenActiveTicket: () => void;
}

export const SalonList: React.FC<SalonListProps> = ({ onSelectSalon, onOpenActiveTicket }) => {
  const { t } = useAuth();
  const { activeBooking } = useQueue();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [maxWaitFilter, setMaxWaitFilter] = useState<number | undefined>(undefined);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [locationMessage, setLocationMessage] = useState('Showing all available shops');
  const [showMapView, setShowMapView] = useState(false);

  const fallbackLocation = { lat: 13.0827, lng: 80.2707 };

  const getDistanceKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDistance = (distance?: number) => {
    if (distance === undefined || Number.isNaN(distance)) return 'Distance unavailable';
    if (distance < 1) return `${Math.round(distance * 1000)} m away`;
    return `${distance.toFixed(distance < 10 ? 1 : 0)} km away`;
  };

  const formatTime = (value?: string) => {
    if (!value) return '';
    const [hour, minute] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute || 0, 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const isSalonOpen = (salon: Salon) => {
    const now = new Date();
    const hours = salon.workingHours?.find((h) => h.dayOfWeek === now.getDay());
    if (!hours?.isOpen) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = hours.openTime.split(':').map(Number);
    const [closeH, closeM] = hours.closeTime.split(':').map(Number);
    return current >= openH * 60 + openM && current <= closeH * 60 + closeM;
  };

  const enhancedSalons = React.useMemo(() => {
    const baseLocation = customerLocation || fallbackLocation;
    return salons
      .map((salon) => ({
        ...salon,
        distanceKm: getDistanceKm(baseLocation, { lat: salon.lat, lng: salon.lng }),
        isOpenNow: isSalonOpen(salon),
      }))
      .sort((a, b) => {
        if (customerLocation) return (a.distanceKm || 0) - (b.distanceKm || 0);
        if (a.isOpenNow !== b.isOpenNow) return a.isOpenNow ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [salons, customerLocation]);

  const nearbySalons = React.useMemo(() => {
    if (!customerLocation) return enhancedSalons;
    return enhancedSalons.filter((salon) => (salon.distanceKm || 0) <= 50);
  }, [enhancedSalons, customerLocation]);

  const requestLiveLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Live location is not supported on this device.');
      return;
    }

    setLocationStatus('loading');
    setLocationMessage('Detecting your current location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('active');
        setShowMapView(true);
        setLocationMessage('Showing nearby available shops by distance');
      },
      () => {
        setLocationStatus('error');
        setLocationMessage('Location permission was denied. Showing all available shops.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const fetchSalons = async () => {
    setLoading(true);
    try {
      const res = await api.getSalons({
        search: searchQuery,
        category: selectedCategory,
        maxWait: maxWaitFilter,
      });
      if (res && res.salons) {
        setSalons(res.salons);
      }
    } catch (e) {
      console.error('Error fetching salons:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalons();
  }, [searchQuery, selectedCategory, maxWaitFilter]);

  // Dynamically aggregate categories from salons and presets
  const dynamicCategories = React.useMemo(() => {
    const set = new Set<string>();
    salons.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    // Add default popular ones if not present
    ['Barber Shop', 'Unisex Salon', 'Spa & Salon', 'Doctor Clinic / OPD', 'Restaurant & Dine-In Queue', 'Car Service & Repair Garage'].forEach((c) => set.add(c));
    return [
      { id: 'all', label: t.allCategories },
      ...Array.from(set).map((cat) => ({ id: cat, label: cat })),
    ];
  }, [salons, t.allCategories]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 pb-28 md:pb-8">
      {/* Active Token Floating Alert Banner */}
      {activeBooking && (
        <div
          onClick={onOpenActiveTicket}
          className="cursor-pointer bg-[#FF9F1C] rounded-2xl p-5 text-[#171717] shadow-md flex flex-wrap items-center justify-between gap-4 hover:bg-[#FF9F1C] transition-colors duration-150 border border-[#FF9F1C]"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#FF9F1C] border border-[#FF9F1C] flex items-center justify-center shrink-0">
              <Ticket className="w-6 h-6 text-[#171717]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest font-black bg-[#FFFFFF] text-[#FF9F1C] px-2 py-0.5 rounded">
                  Live Queue Token
                </span>
                <span className="font-mono font-black text-sm">
                  #{activeBooking.tokenNumber?.split('-').pop()}
                </span>
              </div>
              <h3 className="text-base font-bold mt-0.5">{activeBooking.salonName}</h3>
              <p className="text-xs text-[#FF9F1C]">
                {activeBooking.queuePosition === 1
                  ? "🎉 You're next in line! Head to chair."
                  : `${activeBooking.peopleAhead || 0} ahead of you • Estimated wait ~${activeBooking.estimatedWaitMinutes || 10} mins`}
              </p>
            </div>
          </div>

          <button
            id="view-active-ticket-btn"
            className="px-4 py-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0 uppercase tracking-wider"
          >
            <span>{t.viewTicket}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Search & Location Bar */}
      <div className="bg-[#FFFFFF] rounded-2xl p-6 border border-[rgba(23,23,23,0.12)] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgba(23,23,23,0.70)]">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-[rgba(23,23,23,0.70)]">
            <MapPin className="w-4 h-4 text-[#FF9F1C] shrink-0" />
            <span>{t.currentLocation}</span>
          </div>
          <span className="text-[rgba(23,23,23,0.70)] font-mono text-[11px]">{locationMessage}</span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-[rgba(23,23,23,0.70)] absolute left-4 top-3.5" />
          <input
            id="salon-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] text-sm font-semibold text-[#171717] placeholder:text-[rgba(23,23,23,0.70)] focus:outline-none focus:ring-2 focus:ring-[#FF9F1C] focus:border-[#FF9F1C] transition-colors duration-150"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={requestLiveLocation}
            disabled={locationStatus === 'loading'}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors duration-150 border ${
              locationStatus === 'active'
                ? 'bg-[rgba(255,159,28,0.15)] border-[rgba(23,23,23,0.12)] text-[#FF9F1C]'
                : 'bg-[#FFFFFF] border-[rgba(23,23,23,0.12)] text-[#171717] hover:bg-[rgba(23,23,23,0.05)] disabled:bg-[#FFFFFF] disabled:border-[rgba(23,23,23,0.12)]'
            }`}
          >
            <LocateFixed className={`w-4 h-4 ${locationStatus === 'loading' ? 'animate-spin' : ''}`} />
            <span>{locationStatus === 'active' ? 'Live Location On' : 'Use My Live Location'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMapView((prev) => !prev)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] border border-[rgba(23,23,23,0.12)] hover:bg-[rgba(255,159,28,0.15)] flex items-center justify-center gap-2"
          >
            <Map className="w-4 h-4" />
            <span>{showMapView ? 'Hide Map' : 'Map View'}</span>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {dynamicCategories.map((cat) => (
            <button
              key={cat.id}
              id={`filter-cat-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-150 ${
                selectedCategory === cat.id
                  ? 'bg-[#FF9F1C] text-[#171717] shadow-xs'
                  : 'bg-[#FFFFFF] text-[rgba(23,23,23,0.70)] hover:bg-[rgba(23,23,23,0.05)] border border-[rgba(23,23,23,0.12)]/60'
              }`}
            >
              {cat.label}
            </button>
          ))}

          {/* Quick Filter: < 20 min wait */}
          <button
            id="filter-fast-wait"
            onClick={() => setMaxWaitFilter(maxWaitFilter === 20 ? undefined : 20)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap border flex items-center gap-1.5 transition-colors duration-150 ${
              maxWaitFilter === 20
                ? 'bg-[rgba(255,159,28,0.15)] border-[#FF9F1C] text-[#171717] font-black'
                : 'border-[rgba(23,23,23,0.12)] text-[rgba(23,23,23,0.70)] hover:bg-[rgba(23,23,23,0.05)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#FF9F1C]" />
            <span>Wait &lt; 20m</span>
          </button>
        </div>
      </div>

      {/* Salons Grid Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold uppercase tracking-widest text-[rgba(23,23,23,0.70)]">{t.nearYou}</h2>
        <span className="text-xs text-[rgba(23,23,23,0.70)] font-mono">
          {nearbySalons.length} {nearbySalons.length === 1 ? 'shop' : 'shops'} available
        </span>
      </div>

      {showMapView && nearbySalons.length > 0 && (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-3 sm:p-4 shadow-xs overflow-hidden">
          <div className="h-72 rounded-xl bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_42%,rgba(23,23,23,0.12)_100%)] border border-[rgba(23,23,23,0.12)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(23,23,23,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FF9F1C] text-[#171717] border-4 border-white shadow-lg flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            {nearbySalons.slice(0, 8).map((salon, index) => {
              const left = 16 + ((index * 23) % 68);
              const top = 18 + ((index * 31) % 62);
              return (
                <button
                  key={salon.id}
                  type="button"
                  onClick={() => onSelectSalon(salon)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFFFF] text-[#FF9F1C] border-2 border-white shadow-lg transition-transform">
                    <MapPin className="w-4 h-4 fill-[#FF9F1C]" />
                  </span>
                  <span className="absolute left-1/2 top-10 -translate-x-1/2 w-32 rounded-lg bg-[#FFFFFF] px-2 py-1 text-[11px] font-bold text-[#171717] shadow-md border border-[rgba(23,23,23,0.12)] opacity-0 group-hover:opacity-100 pointer-events-none">
                    {salon.name} - {formatDistance(salon.distanceKm)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Salons Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-4 space-y-3 animate-pulse"
            >
              <div className="h-44 bg-[#FFFFFF] rounded-xl" />
              <div className="h-5 bg-[#FFFFFF] rounded w-2/3" />
              <div className="h-4 bg-[#FFFFFF] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : nearbySalons.length === 0 ? (
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-12 text-center text-[rgba(23,23,23,0.70)]">
          <Search className="w-12 h-12 mx-auto stroke-1 text-[rgba(23,23,23,0.70)] mb-3" />
          <p className="font-bold text-base text-[#171717]">No shops available yet</p>
          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-1">
            When businesses register on QGo, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nearbySalons.map((salon) => {
            const openNow = isSalonOpen(salon);
            const todayHours = salon.workingHours?.find((h) => h.dayOfWeek === new Date().getDay());
            return (
            <div
              key={salon.id}
              id={`salon-card-${salon.id}`}
              onClick={() => onSelectSalon(salon)}
              className="group bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] overflow-hidden hover:border-[#FF9F1C] hover:shadow-lg transition-colors duration-150 cursor-pointer flex flex-col justify-between"
            >
              {/* Cover Image & Live Badge */}
              <div className="relative h-48 w-full overflow-hidden bg-[#FFFFFF] flex items-center justify-center">
                {salon.coverUrl ? (
                  <img
                    src={salon.coverUrl}
                    alt={salon.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[rgba(23,23,23,0.70)]">
                    
                    <span className="text-xs font-bold text-[rgba(23,23,23,0.70)]">{salon.name}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF] to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider bg-[#FFFFFF] text-[#171717] shadow-xs">
                    {salon.category}
                  </span>
                  {salon.verified && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#FF9F1C] text-[#171717] flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>

                {/* Live Queue Floating Pill */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[#171717] text-xs">
                  <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-3 py-1.5 rounded-lg border border-[rgba(23,23,23,0.12)]">
                    <Users className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    <span className="font-semibold text-[11px]">
                      Queue: <strong className="text-[#FF9F1C]">{salon.queueLength} waiting</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#FFFFFF] px-3 py-1.5 rounded-lg border border-[rgba(23,23,23,0.12)]">
                    <Clock className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    <span className="text-[11px]">~{salon.estimatedWaitMinutes || 0}m wait</span>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-[#171717] group-hover:text-[#FF9F1C] transition-colors">
                      {salon.name}
                    </h3>
                    <div className="flex items-center gap-1 bg-[rgba(255,159,28,0.15)] border border-[rgba(23,23,23,0.12)] px-2 py-0.5 rounded text-[#171717] text-xs font-bold shrink-0">
                      <Star className="w-3.5 h-3.5 fill-[#FF9F1C] text-[#FF9F1C]" />
                      <span>{salon.rating > 0 ? salon.rating.toFixed(1) : 'New'}</span>
                      <span className="text-[rgba(23,23,23,0.70)] font-normal">({salon.reviewCount || 0})</span>
                    </div>
                  </div>

                  <p className="text-xs text-[rgba(23,23,23,0.70)] mt-1 flex items-center gap-1 line-clamp-1">
                    <MapPin className="w-3.5 h-3.5 text-[rgba(23,23,23,0.70)] shrink-0" />
                    {salon.address}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <span className="rounded-lg bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] px-2 py-1 font-bold text-[rgba(23,23,23,0.70)]">
                      {formatDistance(salon.distanceKm)}
                    </span>
                    <span className="rounded-lg bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] px-2 py-1 font-bold text-[rgba(23,23,23,0.70)]">
                      From Rs {salon.startingPrice || 0}
                    </span>
                  </div>
                </div>

                {/* Bottom CTA Row */}
                <div className="pt-3 border-t border-[rgba(23,23,23,0.12)] flex items-center justify-between">
                  <span className={`text-xs font-semibold flex items-center gap-1 ${openNow ? 'text-[#FF9F1C]' : 'text-[#FF9F1C]'}`}>
                    <span className={`w-2 h-2 rounded-full ${openNow ? 'bg-[#FF9F1C] animate-pulse' : 'bg-[#FF9F1C]'}`} />
                    {openNow ? t.openNow : todayHours ? `Opens ${formatTime(todayHours.openTime)}` : 'Unavailable'}
                  </span>

                  <button
                    id={`view-salon-btn-${salon.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-[#FF9F1C] group-hover:bg-[#FF9F1C] text-[#171717] font-bold text-xs transition-colors flex items-center gap-1 shadow-xs uppercase tracking-wider"
                  >
                    <span>Book Now / Explore</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
};
