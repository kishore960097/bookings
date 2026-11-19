import { useState, useEffect, useMemo, useCallback } from 'react';
import { Salon, isTurfBusiness } from '../../../types';
import { api } from '../../../services/api';
import { CustomerVenue } from '../types';
import { UserCoordinates } from './useCustomerLocation';

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface AdvancedFilterOptions {
  category?: string;
  priceRange?: 'all' | 'under_500' | '500_1000' | '1000_plus';
  minRating?: number;
  sortBy?: 'nearest' | 'rating' | 'price_asc';
  timeFilter?: 'all' | 'morning' | 'evening';
  radiusKmOverride?: number | null;
}

export interface UseCustomerVenuesOptions {
  userLocation: string;
  userCoords?: UserCoordinates | null;
  isAutoDetectActive?: boolean;
  radiusKm?: number;
  filters?: AdvancedFilterOptions;
}

export function useCustomerVenues(optionsOrLocation: UseCustomerVenuesOptions | string) {
  const options =
    typeof optionsOrLocation === 'string'
      ? { userLocation: optionsOrLocation, userCoords: null, isAutoDetectActive: false, radiusKm: 15, filters: undefined }
      : optionsOrLocation;

  const locStr = options.userLocation;
  const coords = options.userCoords || null;
  const autoDetect = Boolean(options.isAutoDetectActive);
  const radius = options.radiusKm || 15;
  const filters = options.filters;

  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [query, setQueryState] = useState(() => {
    try {
      return sessionStorage.getItem('qgo_cust_query') || '';
    } catch {
      return '';
    }
  });

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    try {
      sessionStorage.setItem('qgo_cust_query', q);
    } catch {
      // ignore
    }
  }, []);

  const [selectedSport, setSelectedSportState] = useState(() => {
    try {
      return sessionStorage.getItem('qgo_cust_sport') || 'All';
    } catch {
      return 'All';
    }
  });

  const setSelectedSport = useCallback((s: string) => {
    setSelectedSportState(s);
    try {
      sessionStorage.setItem('qgo_cust_sport', s);
    } catch {
      // ignore
    }
  }, []);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('qgo_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((venueName: string) => {
    setFavorites((prev) => {
      const newFavs = prev.includes(venueName)
        ? prev.filter((name) => name !== venueName)
        : [...prev, venueName];
      try {
        localStorage.setItem('qgo_favorites', JSON.stringify(newFavs));
      } catch {
        // ignore
      }
      return newFavs;
    });
  }, []);

  const fetchVenues = useCallback(() => {
    if (salons.length === 0) {
      setLoading(true);
    }
    setLoadError(false);
    api.getSalons()
      .then((result) => {
        setSalons(result.salons || []);
      })
      .catch((err) => {
        console.error('[CustomerPage] Failed to fetch salons:', err);
        if (salons.length === 0) {
          setLoadError(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [salons.length]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const venues: CustomerVenue[] = useMemo(() => {
    const isAllSport = selectedSport === 'All' || selectedSport === 'All Sports';
    const trimmedQuery = query.trim().toLowerCase();

    // Map salons to customer venues with computed Haversine distance
    const parsedVenues = salons
      .filter((salon) => salon.status === 'approved' || salon.status === 'live' || !salon.status)
      .map((salon) => {
        const fullAddress = [salon.address, salon.city].filter(Boolean).join(', ');

        const vLat = typeof salon.latitude === 'number' && Number.isFinite(salon.latitude)
          ? salon.latitude
          : typeof salon.lat === 'number' && Number.isFinite(salon.lat)
          ? salon.lat
          : undefined;

        const vLon = typeof salon.longitude === 'number' && Number.isFinite(salon.longitude)
          ? salon.longitude
          : typeof salon.lng === 'number' && Number.isFinite(salon.lng)
          ? salon.lng
          : undefined;

        let distanceKm: number | undefined;
        let distanceLabel = '';

        if (coords && vLat !== undefined && vLon !== undefined) {
          distanceKm = calculateHaversineDistanceKm(coords.lat, coords.lng, vLat, vLon);
          distanceLabel = `${distanceKm.toFixed(1)} km away`;
        } else if (salon.distanceKm !== undefined) {
          distanceKm = salon.distanceKm;
          distanceLabel = `${distanceKm.toFixed(1)} km away`;
        }

        const price = (salon as any).price || (salon as any).hourlyRate || salon.resources?.[0]?.pricePerHour || salon.services?.[0]?.price || 800;
        const rating = (salon as any).rating || (salon as any).averageRating || 4.8;

        return {
          id: salon.id,
          name: salon.name,
          address: fullAddress || 'Address unavailable',
          city: salon.city || '',
          distance: distanceLabel,
          distanceKm,
          hasValidCoords: vLat !== undefined && vLon !== undefined,
          image: salon.logoUrl || salon.coverUrl || '',
          sports: salon.category || 'General',
          category: salon.category || 'General',
          rating,
          minPrice: price,
          salon,
        };
      });

    // ── Helper: Matches sport / category filter ──
    const matchesCategory = (sportsStr: string, catFilter?: string) => {
      const activeCat = catFilter || selectedSport;
      if (!activeCat || activeCat === 'All' || activeCat === 'All Sports') return true;
      const lower = activeCat.toLowerCase();
      const sportsLower = sportsStr.toLowerCase();

      if (lower === 'turf') {
        return isTurfBusiness(sportsStr);
      }
      if (lower === 'salon') {
        return !isTurfBusiness(sportsStr) || sportsLower.includes('salon') || sportsLower.includes('barber') || sportsLower.includes('spa');
      }
      return sportsLower.includes(lower);
    };

    // ── Helper: Matches price range ──
    const matchesPrice = (price?: number) => {
      if (!filters?.priceRange || filters.priceRange === 'all') return true;
      const p = price || 0;
      if (filters.priceRange === 'under_500') return p < 500;
      if (filters.priceRange === '500_1000') return p >= 500 && p <= 1000;
      if (filters.priceRange === '1000_plus') return p > 1000;
      return true;
    };

    // ── Helper: Matches minimum rating ──
    const matchesRating = (rating?: number) => {
      if (!filters?.minRating || filters.minRating <= 0) return true;
      return (rating || 0) >= filters.minRating;
    };

    // ── CASE 1: Strict Surrounding-Radius Mode (Auto Detect Active) ──
    if (autoDetect && coords) {
      const effRadius = filters?.radiusKmOverride !== undefined && filters.radiusKmOverride !== null
        ? filters.radiusKmOverride
        : radius;

      const filtered = parsedVenues
        .filter((venue) => {
          // Zero leakage: must have valid coordinates and distance within selected radius
          if (effRadius > 0 && (venue.distanceKm === undefined || venue.distanceKm > effRadius)) {
            return false;
          }

          // Filter by search query if user entered text
          if (trimmedQuery.length > 0) {
            const matchQuery = `${venue.name} ${venue.address} ${venue.sports}`
              .toLowerCase()
              .includes(trimmedQuery);
            if (!matchQuery) return false;
          }

          if (!matchesCategory(venue.sports, filters?.category)) return false;
          if (!matchesPrice(venue.minPrice)) return false;
          if (!matchesRating(venue.rating)) return false;

          return true;
        });

      // Sort
      if (filters?.sortBy === 'rating') {
        return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }
      if (filters?.sortBy === 'price_asc') {
        return filtered.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
      }
      return filtered.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    // ── CASE 2: Manual City Browsing / Global Search Mode ──
    const filtered = parsedVenues.filter((venue) => {
      const matchQuery =
        trimmedQuery.length === 0 ||
        `${venue.name} ${venue.address} ${venue.sports}`.toLowerCase().includes(trimmedQuery);

      const matchCat = matchesCategory(venue.sports, filters?.category);
      const matchP = matchesPrice(venue.minPrice);
      const matchR = matchesRating(venue.rating);

      const matchLocation =
        trimmedQuery.length > 0 ||
        locStr === 'All Locations' ||
        locStr === 'Current Location' ||
        locStr === 'Map Selection' ||
        venue.address.toLowerCase().includes(locStr.toLowerCase()) ||
        (venue.city && locStr.toLowerCase().includes(venue.city.toLowerCase()));

      return matchQuery && matchCat && matchP && matchR && matchLocation;
    });

    if (filters?.sortBy === 'rating') {
      return filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (filters?.sortBy === 'price_asc') {
      return filtered.sort((a, b) => (a.minPrice || 0) - (b.minPrice || 0));
    }
    if (coords) {
      return filtered.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }
    return filtered;
  }, [salons, query, selectedSport, locStr, coords, autoDetect, radius, filters]);

  return {
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
  };
}
