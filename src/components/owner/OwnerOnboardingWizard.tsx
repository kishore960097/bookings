import React, { useState } from 'react';
import {
  X,
  Store,
  MapPin,
  Clock,
  Coins,
  Crosshair,
  CheckCircle2,
  ArrowRight,
  Building2,
  Wallet,
  CreditCard,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { haptics } from '../../utils/haptics';

interface OwnerOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OwnerOnboardingWizard: React.FC<OwnerOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, setUser } = useAuth();

  const [category, setCategory] = useState<'Turf' | 'Salon'>('Turf');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('23:00');
  const [price, setPrice] = useState<number>(1200);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(60);

  // 5. Payout Agreement & Destination Details
  const [payoutCycle, setPayoutCycle] = useState<'weekly' | 'monthly'>('weekly');
  const [upiId, setUpiId] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState(user?.name || '');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [payoutAgreementAccepted, setPayoutAgreementAccepted] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAutoDetectGPS = async () => {
    setIsLocating(true);
    setError(null);
    haptics.light();

    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);

        // Reverse geocode city/address
        const res = await api.reverseGeocode(lat, lng);
        if (res?.success) {
          const d = res.details || {};
          const detectedCity =
            d.city ||
            d.town ||
            d.suburb ||
            d.neighbourhood ||
            d.municipality ||
            d.district ||
            res.city ||
            '';
          if (detectedCity) {
            setCity(detectedCity);
          }
          if (res.address && !address) {
            setAddress(res.address.split(',').slice(0, 3).join(', ').trim());
          }
        }
      } else {
        setError('GPS Geolocation is not supported by your browser.');
      }
    } catch (err: any) {
      console.warn('[OnboardingWizard] GPS error:', err);
      setError('Could not auto-detect location. Please enter your coordinates or address manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a venue or business name.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter a city or town name.');
      return;
    }
    if (!address.trim()) {
      setError('Please enter the full venue street address.');
      return;
    }

    const hasValidUpi = Boolean(upiId.trim() && upiId.includes('@'));
    const hasValidBank = Boolean(accountNumber.trim() && ifscCode.trim());
    if (!hasValidUpi && !hasValidBank) {
      setError('Please provide at least a valid UPI ID (e.g. name@okaxis) or complete Bank Account details (Account Number & IFSC Code) for payouts.');
      return;
    }
    if (!payoutAgreementAccepted) {
      setError('You must accept the QGo Weekly/Monthly Payout Terms to register your venue.');
      return;
    }

    setIsSubmitting(true);
    haptics.selection();

    try {
      const res = await api.onboardBusiness({
        category,
        name: name.trim(),
        description: description.trim(),
        city: city.trim(),
        address: address.trim(),
        latitude: typeof latitude === 'number' ? latitude : 11.5034,
        longitude: typeof longitude === 'number' ? longitude : 77.2444,
        phone: phone.trim() || user?.phone || '',
        openingTime,
        closingTime,
        price: Number(price) || (category === 'Turf' ? 1200 : 250),
        slotDurationMinutes,
        payoutCycle,
        upiId: upiId.trim(),
        bankAccountHolder: bankAccountHolder.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        payoutAgreementAccepted: true,
        payoutAgreementAcceptedAt: new Date().toISOString(),
      });

      if (res.success && res.user) {
        setUser(res.user);
        haptics.success();
        onSuccess();
      } else {
        setError(res.error || 'Failed to register venue. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F9FAFB] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col animate-in fade-in duration-200">
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-gray-200/80 dark:border-zinc-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E73229] flex items-center justify-center text-white font-black text-sm shadow-sm">
            Q
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-gray-950 dark:text-white">
                Register Your Venue
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E73229]/10 text-[#E73229] dark:bg-[#E73229]/20">
                Partner Portal
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 hidden sm:block">
              Setup your sports turf or grooming salon to start accepting verified live bookings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
        >
          <X size={14} />
          <span>Cancel &amp; Return</span>
        </button>
      </header>

      {/* Main Spacious Onboarding Container */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 flex-1">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200/80 dark:border-zinc-800 shadow-xl overflow-hidden">
          {/* Subheader Hero Banner */}
          <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E73229] text-white flex items-center justify-center shadow-md shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0A0A0A] dark:text-white tracking-tight">
                Business &amp; Venue Onboarding
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 mt-0.5">
                Complete the 4 quick sections below. Your owner account and real-time dashboard activate immediately.
              </p>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-[#E73229] dark:text-red-400">
                {error}
              </div>
            )}

            {/* 1. Business Category */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                1. Business Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setCategory('Turf');
                    setPrice(1200);
                    setSlotDurationMinutes(60);
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    category === 'Turf'
                      ? 'border-[#E73229] bg-[#E73229]/5 dark:bg-[#E73229]/10 shadow-sm'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-sm sm:text-base text-[#0A0A0A] dark:text-white">
                      Turf / Sports Ground
                    </span>
                    {category === 'Turf' && <CheckCircle2 size={18} className="text-[#E73229]" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                    Football, Cricket, Badminton pitches with hourly court slot reservations.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategory('Salon');
                    setPrice(350);
                    setSlotDurationMinutes(30);
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    category === 'Salon'
                      ? 'border-[#E73229] bg-[#E73229]/5 dark:bg-[#E73229]/10 shadow-sm'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-sm sm:text-base text-[#0A0A0A] dark:text-white">
                      Salon / Grooming Lounge
                    </span>
                    {category === 'Salon' && <CheckCircle2 size={18} className="text-[#E73229]" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                    Haircuts, spa, grooming chairs with live virtual queues and appointments.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Venue Identity & Contact Phone */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                2. Venue Identity &amp; Contact
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Venue / Ground Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Apex Arena Turf or En Vogue Salon"
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Primary Contact Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                  Venue Description &amp; Amenities
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Highlights: FIFA approved turf, LED floodlights, shower room, shaded dugouts..."
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                />
              </div>
            </div>

            {/* 3. Location, Address & Coordinates */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                  3. Location &amp; GPS Coordinates
                </label>
                <button
                  type="button"
                  onClick={handleAutoDetectGPS}
                  disabled={isLocating}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 text-[#E73229] dark:text-red-400 text-xs font-bold transition cursor-pointer self-start sm:self-auto"
                >
                  {isLocating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#E73229] border-t-transparent rounded-full animate-spin" />
                      <span>Detecting My GPS Location...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair size={13} />
                      <span>Detect My GPS Location</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    City / Town *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Sathyamangalam / Coimbatore"
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Full Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Door No, Street Name, Landmark"
                    className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="e.g. 11.5034"
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-[#E73229]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="e.g. 77.2444"
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-[#E73229]"
                  />
                </div>
              </div>
            </div>

            {/* 4. Operating Hours & Pricing */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                4. Operating Hours &amp; Pricing
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    {category === 'Turf' ? 'Court Hourly Rate (₹)' : 'Service Base Price (₹)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full h-10 pl-8 pr-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Default Slot Duration
                  </label>
                  <select
                    value={slotDurationMinutes}
                    onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes (Standard)</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes (2 Hours)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 5. Payout Agreement & Settlement Destination */}
            <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-[#E73229]" />
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                    5. Partner Payout Cycle &amp; Settlement Details
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                  Choose your settlement cycle and where QGo transfers your collected earnings.
                </p>
              </div>

              {/* Settlement Cycle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPayoutCycle('weekly')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    payoutCycle === 'weekly'
                      ? 'border-[#E73229] bg-[#E73229]/5 dark:bg-[#E73229]/10 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-[#0A0A0A] dark:text-white flex items-center gap-1.5">
                      <span>Weekly Settlement</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                        Popular
                      </span>
                    </span>
                    {payoutCycle === 'weekly' && <CheckCircle2 size={16} className="text-[#E73229]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-snug">
                    Settled every Monday for bookings completed during the previous Mon–Sun cycle.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayoutCycle('monthly')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    payoutCycle === 'monthly'
                      ? 'border-[#E73229] bg-[#E73229]/5 dark:bg-[#E73229]/10 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-[#0A0A0A] dark:text-white">
                      Monthly Settlement
                    </span>
                    {payoutCycle === 'monthly' && <CheckCircle2 size={16} className="text-[#E73229]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-snug">
                    Settled on the 1st of every month for all bookings in the previous calendar month.
                  </p>
                </button>
              </div>

              {/* UPI & Bank Account Details */}
              <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-zinc-300 block">
                  Payout Destination (Provide UPI ID or Bank Details)
                </span>

                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                    Owner UPI ID (Recommended for instant settlements)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. yourname@okaxis or turfksr@upi"
                    className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                  />
                </div>

                <div className="pt-2 border-t border-gray-200/60 dark:border-zinc-700/60">
                  <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-zinc-500 block mb-2">
                    Or Bank Account Transfer (IMPS / NEFT)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                        Account Holder Name
                      </label>
                      <input
                        type="text"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        placeholder="Name as in Bank Passbook"
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. HDFC Bank / SBI"
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Enter Bank Account Number"
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 dark:text-zinc-400 mb-1 font-medium">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        placeholder="e.g. HDFC0001234"
                        className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono font-semibold text-[#0A0A0A] dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E73229]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Partner Payout Agreement Consent Box */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-zinc-900 dark:text-zinc-100 space-y-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    <span className="font-extrabold text-zinc-950 dark:text-white block mb-1">
                      QGo Partner Settlement Terms &amp; Transparency Guarantee
                    </span>
                    Customers pay the online advance plus QGo's ₹30 convenience fee and 18% GST (₹35.40 per booking). QGo retains the ₹35.40 platform fee + GST and transfers 100% of your collected booking amount to your registered UPI/Bank account on your chosen Weekly or Monthly cycle.
                  </div>
                </div>

                <label className="flex items-center gap-3 pt-2 border-t border-amber-500/20 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={payoutAgreementAccepted}
                    onChange={(e) => setPayoutAgreementAccepted(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E73229] border-gray-300 dark:border-zinc-700 focus:ring-[#E73229]"
                  />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    I agree to the QGo Weekly/Monthly Payout Terms *
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-[#E73229] hover:bg-[#D42B22] text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-[#E73229]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registering Venue &amp; Launching Dashboard...</span>
                  </>
                ) : (
                  <>
                    <span>Create Venue &amp; Open Owner Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
