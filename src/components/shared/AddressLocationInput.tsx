import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { MapPin, Navigation, Loader2, Check } from 'lucide-react';

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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const res = await api.reverseGeocode(lat, lon);
          if (res && res.success && res.address) {
            setQuery(res.address);
            onChange(res.address, lat, lon, res.city || undefined);
          } else {
            const fallbackAddr = `Location Selected`;
            setQuery(fallbackAddr);
            onChange(fallbackAddr, lat, lon, undefined);
          }
        } catch (err) {
          console.error('Reverse geocoding failed:', err);
          const fallbackAddr = `Location Selected`;
          setQuery(fallbackAddr);
          onChange(fallbackAddr, lat, lon, undefined);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please search or enter address manually.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError('GPS position unavailable. Please search or enter address manually.');
        } else {
          setLocationError('Unable to access your location. Please enter address manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Address &amp; Location *
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors disabled:opacity-50"
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
          className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 bg-white"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
      </div>

      {locationError && (
        <p className="text-[11px] font-semibold text-amber-700 mt-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
          {locationError}
        </p>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Suggested Locations
          </div>
          {suggestions.map((item) => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 hover:bg-indigo-50/70 transition-colors text-xs text-slate-800"
            >
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
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
