import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { MapPin, Navigation, Loader2, Check } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

interface AddressLocationInputProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number, city?: string) => void;
  required?: boolean;
  placeholder?: string;
}

export const AddressLocationInput: React.FC<AddressLocationInputProps> = ({
  value,
  onChange,
  required = true,
  placeholder = 'e.g. #14, Main Road, Indiranagar, Bengaluru',
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<
    Array<{
      placeId: number;
      displayName: string;
      lat: number;
      lon: number;
      city: string;
      state: string;
      country: string;
    }>
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // If query matches the currently selected value exactly, don't re-search
    if (query === value && suggestions.length === 0) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchAddress(query);
        if (res && res.results) {
          setSuggestions(res.results);
          setIsOpen(res.results.length > 0);
        }
      } catch (err) {
        console.error('Failed to search address:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: {
    displayName: string;
    lat: number;
    lon: number;
    city: string;
  }) => {
    setQuery(item.displayName);
    setIsOpen(false);
    setSuggestions([]);
    setLocationError(null);
    onChange(item.displayName, item.lat, item.lon, item.city || undefined);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocationError(null);

    try {
      let lat: number;
      let lon: number;

      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (capError) {
        console.warn('Capacitor Geolocation failed, trying web fallback:', capError);
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by your browser.');
        }
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }

      const res = await api.reverseGeocode(lat, lon);
      if (res && res.success && res.address) {
        setQuery(res.address);
        onChange(res.address, lat, lon, res.city || undefined);
      } else {
        setLocationError('Unable to detect your location address. Please try again.');
      }
    } catch (error: any) {
      console.error('Location error:', error);
      if (error.code === 1 || error?.message?.toLowerCase().includes('permission') || error?.code?.toLowerCase() === 'permission_denied') {
        setLocationError('Location permission is required. Please enable it in your device settings.');
      } else if (error.code === 2 || error?.message?.toLowerCase().includes('unavailable') || error?.code?.toLowerCase() === 'position_unavailable') {
        setLocationError('GPS position unavailable. Please ensure your device location services are turned on.');
      } else {
        setLocationError('Unable to access your location. Please try again or enter manually.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B665F]">
          Address &amp; Location *
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="text-[11px] font-bold text-[#E8342A] hover:opacity-80 flex items-center gap-1 transition-colors disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          <span>{isLocating ? 'Detecting GPS…' : 'Use current location'}</span>
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-3 pr-10 rounded-xl border border-[rgba(11,11,11,0.12)] focus:outline-none focus:ring-2 focus:ring-[#0B0B0B] font-semibold text-[#0B0B0B] bg-[#FFFFFF]"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B665F]">
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#0B0B0B]" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
      </div>

      {locationError && (
        <p className="text-[11px] font-semibold text-[#B3261E] mt-1 bg-[rgba(179,38,30,0.10)] px-2.5 py-1 rounded-lg border border-[rgba(179,38,30,0.20)]">
          {locationError}
        </p>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#FFFFFF] rounded-2xl shadow-xl border border-[#0B0B0B] z-50 overflow-hidden divide-y divide-[rgba(11,11,11,0.06)] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-[#FFFFFF] text-[10px] font-bold uppercase tracking-wider text-[#6B665F]">
            Suggested Locations
          </div>
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 hover:bg-[rgba(11,11,11,0.05)] transition-colors text-xs text-[#0B0B0B]"
            >
              <MapPin className="w-4 h-4 text-[#E8342A] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-semibold block leading-tight">{item.displayName}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
