import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/api';
import { Geolocation } from '@capacitor/geolocation';

export interface UserCoordinates {
  lat: number;
  lng: number;
}

export function useCustomerLocation() {
  const [userLocation, setUserLocationState] = useState<string>(() => {
    try {
      return localStorage.getItem('qgo_user_location') || 'All Locations';
    } catch {
      return 'All Locations';
    }
  });

  const setUserLocation = useCallback((loc: string) => {
    setUserLocationState(loc);
    try {
      localStorage.setItem('qgo_user_location', loc);
    } catch {
      // ignore
    }
  }, []);

  const [userCoords, setUserCoordsState] = useState<UserCoordinates | null>(() => {
    try {
      const saved = localStorage.getItem('qgo_user_coords');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setUserCoords = useCallback((coords: UserCoordinates | null) => {
    setUserCoordsState(coords);
    try {
      if (coords) {
        localStorage.setItem('qgo_user_coords', JSON.stringify(coords));
      } else {
        localStorage.removeItem('qgo_user_coords');
      }
    } catch {
      // ignore
    }
  }, []);

  const [isAutoDetectActive, setIsAutoDetectActiveState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qgo_autodetect_active') === 'true';
    } catch {
      return false;
    }
  });

  const setAutoDetectActive = useCallback((active: boolean) => {
    setIsAutoDetectActiveState(active);
    try {
      localStorage.setItem('qgo_autodetect_active', String(active));
    } catch {
      // ignore
    }
  }, []);

  const [radiusKm, setRadiusKmState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('qgo_radius_km');
      const num = saved ? Number(saved) : 15;
      return [5, 10, 15, 25].includes(num) ? num : 15;
    } catch {
      return 15;
    }
  });

  const setRadiusKm = useCallback((r: number) => {
    setRadiusKmState(r);
    try {
      localStorage.setItem('qgo_radius_km', String(r));
    } catch {
      // ignore
    }
  }, []);

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
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleGetCurrentLocation = useCallback(async (fallbackLocation?: string) => {
    setIsLocating(true);
    setLocationError(null);

    try {
      let lat: number | undefined;
      let lon: number | undefined;

      // 1. Try native Capacitor Geolocation
      try {
        const permStatus = await Geolocation.checkPermissions().catch(() => null);
        if (permStatus?.location === 'prompt' || permStatus?.location === 'prompt-with-rationale') {
          await Geolocation.requestPermissions().catch(() => null);
        }
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (capErr) {
        // 2. Fallback to browser standard navigator.geolocation
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const pos: GeolocationPosition = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              });
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
          } catch (browserErr) {
            console.warn('[useCustomerLocation] Browser GPS unavailable or denied:', browserErr);
          }
        }
      }

      // 3. Save coordinates and set auto-detect mode active
      if (lat !== undefined && lon !== undefined) {
        const coords = { lat: Number(lat.toFixed(6)), lng: Number(lon.toFixed(6)) };
        setUserCoords(coords);
        setAutoDetectActive(true);

        // Reverse geocode GPS coordinates
        const res = await api.reverseGeocode(lat, lon);
        if (res && res.success) {
          const d = res.details || {};
          const locality =
            d.city ||
            d.town ||
            d.suburb ||
            d.neighbourhood ||
            d.municipality ||
            d.district ||
            res.city ||
            '';
          const state = d.state || '';
          const locationName = locality && state ? `${locality}, ${state}` : (locality || res.city || 'Nearby Location');

          setUserLocation(locationName);
          setLocationError(null);
          setIsLocationModalOpen(false);
          setIsMapView(false);
          return;
        }
        setUserLocation('Nearby Location');
        setLocationError(null);
        setIsLocationModalOpen(false);
        setIsMapView(false);
        return;
      }

      // 4. GPS denied or unavailable
      setLocationError('Location access was denied or timed out. Please allow location access or choose your city manually.');
      if (fallbackLocation && fallbackLocation !== 'All Locations') {
        setUserLocation(fallbackLocation);
        setAutoDetectActive(false);
      }
    } catch (err: any) {
      console.warn('[useCustomerLocation] Location resolution error:', err);
      setLocationError('Could not auto-detect location. Please select your city manually.');
      if (fallbackLocation && fallbackLocation !== 'All Locations') {
        setUserLocation(fallbackLocation);
        setAutoDetectActive(false);
      }
    } finally {
      setIsLocating(false);
    }
  }, [setUserLocation, setUserCoords, setAutoDetectActive]);

  const selectManualLocation = useCallback((loc: string) => {
    setUserLocation(loc);
    if (loc === 'All Locations') {
      setUserCoords(null);
    }
    setAutoDetectActive(false);
    setLocationError(null);
    setIsLocationModalOpen(false);
    setIsMapView(false);
  }, [setUserLocation, setUserCoords, setAutoDetectActive]);

  return {
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
    setLocationError,
    handleGetCurrentLocation,
    selectManualLocation,
  };
}
