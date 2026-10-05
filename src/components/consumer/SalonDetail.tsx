import React, { useState, useEffect } from 'react';
import { Salon, Service, Staff, Review, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Phone,
  Share2,
  Calendar,
  Users,
  CheckCircle2,
  Ticket,
  Scissors,
  ChevronRight,
  MessageSquare,
  IndianRupee,
  Navigation,
  Map,
  Layers,
  Zap} from 'lucide-react';

interface SalonDetailProps {
  salonId: string;
  onBack: () => void;
  onBookAppointment: (salon: Salon, preselectedService?: Service) => void;
  onJoinQueue: (salon: Salon, preselectedService?: Service) => void;
  onWriteReview: (salon: Salon) => void;
}

export const SalonDetail: React.FC<SalonDetailProps> = ({
  salonId,
  onBack,
  onBookAppointment,
  onJoinQueue,
  onWriteReview,
}) => {
  const { t, language } = useAuth();
  const [data, setData] = useState<{
    salon: Salon;
    services: Service[];
    staff: Staff[];
    reviews: Review[];
    queue: { length: number; estimatedWaitMinutes: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'services' | 'staff' | 'reviews' | 'hours'>('services');

  const fetchDetail = async () => {
    try {
      const res = await api.getSalonDetail(salonId);
      if (res && res.salon) {
        setData(res);
      }
    } catch (e) {
      console.error('Error loading salon details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 5000);
    return () => clearInterval(interval);
  }, [salonId]);

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-neutral-400 animate-pulse">
        <Scissors className="w-8 h-8 mx-auto mb-2 text-amber-500 animate-spin" />
        <p className="text-sm font-medium">Loading salon details...</p>
      </div>
    );
  }

  const { salon, services, staff, reviews, queue } = data;
  const startingPrice = salon.startingPrice || (services.length ? Math.min(...services.map((srv) => srv.price)) : 0);
  const facilities = salon.facilities?.length
    ? salon.facilities
    : Array.from(new Set(services.map((srv) => srv.category)));
  const todayHours = salon.workingHours.find((wh) => wh.dayOfWeek === new Date().getDay());
  const distanceLabel = salon.distanceKm
    ? `${salon.distanceKm.toFixed(salon.distanceKm < 10 ? 1 : 0)} km away`
    : 'Enable live location for exact distance';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Back Button */}
      <button
        id="salon-detail-back-btn"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-white px-3.5 py-2 rounded-xl border border-neutral-200 shadow-xs transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.back}</span>
      </button>

      {/* Hero Header Card */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 overflow-hidden shadow-sm">
        {/* Cover Photo */}
        <div className="relative h-60 sm:h-72 w-full bg-slate-900 overflow-hidden flex items-center justify-center">
          {salon.coverUrl ? (
            <img
              src={salon.coverUrl}
              alt={salon.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              
              <span className="text-sm font-bold text-slate-200">{salon.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 text-white flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-neutral-950">
                  {salon.category}
                </span>
                {salon.verified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{salon.name}</h1>
              <p className="text-xs text-neutral-300 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {salon.address}, {salon.city}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 text-right">
              <div className="flex items-center gap-1 text-amber-400 font-bold text-base justify-end">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{salon.rating > 0 ? salon.rating.toFixed(1) : 'New'}</span>
              </div>
              <span className="text-[10px] text-neutral-300">
                {salon.reviewCount > 0 ? `(${salon.reviewCount} reviews)` : 'Not rated yet'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Queue / Turf Slot Booking Banner */}
        {isTurfBusiness(salon.category, salon.bookingMode) ? (
          <div className="bg-emerald-950 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                🏟️
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">
                  Turf Arena &amp; Slot Booking
                </span>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{(salon.resources || []).length || 1} Playable Turfs Available</span>
                  <span className="text-emerald-700">•</span>
                  <span className="text-emerald-300 font-medium">Custom Slots &amp; Hourly Rates</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${salon.phone}`}
                className="p-2.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 transition-colors border border-emerald-800"
                title="Call Turf"
              >
                <Phone className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: salon.name, url: window.location.href });
                  }
                }}
                className="p-2.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 transition-colors border border-emerald-800"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                  {t.liveQueue}
                </span>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{queue.length} customers in line</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{queue.estimatedWaitMinutes} mins est. wait
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${salon.phone}`}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                title="Call salon"
              >
                <Phone className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: salon.name, url: window.location.href });
                  }
                }}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto scrollbar-none">
          <button
            id="tab-services"
            onClick={() => setActiveTab('services')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'services'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {isTurfBusiness(salon.category, salon.bookingMode) ? 'Turfs & Pitches' : t.servicesTab}
          </button>
          {!isTurfBusiness(salon.category, salon.bookingMode) && (
            <button
              id="tab-staff"
              onClick={() => setActiveTab('staff')}
              className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'staff'
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.stylistsTab} ({staff.length})
            </button>
          )}
          <button
            id="tab-reviews"
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.reviewsTab} ({reviews.length})
          </button>
          <button
            id="tab-hours"
            onClick={() => setActiveTab('hours')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'hours'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.aboutTab}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 sm:p-7">
          {/* 1. SERVICES OR TURFS TAB */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              {isTurfBusiness(salon.category, salon.bookingMode) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(salon.resources && salon.resources.length > 0
                    ? salon.resources
                    : [
                        {
                          id: 'turf_1',
                          salonId: salon.id,
                          name: 'Main Turf Ground',
                          type: '7-a-side Football / Box Cricket',
                          capacity: 14,
                          pricePerHour: salon.startingPrice || 800,
                          description: salon.description || 'Premium artificial grass turf with floodlights.',
                          isActive: true,
                        },
                      ]
                  ).map((turf) => (
                    <div
                      key={turf.id}
                      className="p-5 rounded-3xl border border-emerald-200/90 bg-white hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {turf.type}
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900 mt-1">
                              {turf.name}
                            </h4>
                            {turf.capacity && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Capacity: Up to {turf.capacity} players
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-emerald-800">
                              ₹{turf.pricePerHour || salon.startingPrice || 800}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-bold">/ slot</span>
                          </div>
                        </div>
                        {turf.description && (
                          <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                            {turf.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                        <button
                          onClick={() => onBookAppointment(salon)}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Book This Turf</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map((srv) => (
                    <div
                      key={srv.id}
                      className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-neutral-400 hover:shadow-sm transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-neutral-900">
                              {language === 'ta' && srv.nameTa ? srv.nameTa : srv.name}
                            </h4>
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                              {srv.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-extrabold text-neutral-900">
                              {t.rupees}
                              {srv.price}
                            </span>
                            <span className="block text-[10px] text-neutral-500 font-medium">
                              {srv.durationMinutes} {t.mins}
                            </span>
                          </div>
                        </div>
                        {srv.description && (
                          <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
                            {srv.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => onJoinQueue(salon, srv)}
                          className="px-3 py-1.5 rounded-xl border border-neutral-300 text-neutral-800 text-xs font-bold hover:bg-neutral-100 transition-colors"
                        >
                          Join Queue
                        </button>
                        <button
                          onClick={() => onBookAppointment(salon, srv)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition-colors"
                        >
                          Book Slot
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. STAFF TAB */}
          {activeTab === 'staff' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {staff.map((st) => (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl border border-neutral-200/90 bg-white flex items-start gap-3.5"
                >
                  <img
                    src={st.photoUrl}
                    alt={st.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover bg-neutral-100"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-neutral-900">{st.name}</h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{st.rating}</span>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500 block">{st.title}</span>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          st.status === 'available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : st.status === 'busy'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st.status === 'available'
                              ? 'bg-emerald-500'
                              : st.status === 'busy'
                              ? 'bg-amber-500'
                              : 'bg-neutral-400'
                          }`}
                        />
                        {st.status === 'available'
                          ? t.available
                          : st.status === 'busy'
                          ? t.busy
                          : t.onBreak}
                      </span>

                      {st.waitingCount !== undefined && st.waitingCount > 0 && (
                        <span className="text-[10px] text-neutral-500">
                          {st.waitingCount} in chair queue
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">Verified Customer Reviews</h4>
                  <span className="text-xs text-neutral-500">
                    Overall Rating {salon.rating} / 5.0
                  </span>
                </div>
                <button
                  id="write-review-btn"
                  onClick={() => onWriteReview(salon)}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t.writeReview}</span>
                </button>
              </div>

              {reviews.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-8">
                  No reviews yet. Be the first to review after your service!
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
                            {rev.customerName.charAt(0)}
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-neutral-900">
                              {rev.customerName}
                            </h5>
                            {rev.staffName && (
                              <span className="text-[10px] text-neutral-500">
                                Stylist: {rev.staffName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-neutral-700 leading-relaxed">{rev.comment}</p>

                      {rev.ownerResponse && (
                        <div className="mt-2 p-3 rounded-xl bg-white border border-neutral-200 text-xs text-neutral-600">
                          <strong className="text-neutral-900 block text-[11px] mb-0.5">
                            {t.ownerResponse}:
                          </strong>
                          {rev.ownerResponse}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. HOURS & LOCATION TAB */}
          {activeTab === 'hours' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-neutral-900 mb-2">{t.workingHours}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {salon.workingHours.map((wh) => (
                    <div
                      key={wh.dayOfWeek}
                      className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between"
                    >
                      <span className="font-semibold text-neutral-800">{wh.dayName}</span>
                      <span className={wh.isOpen ? 'text-neutral-600 font-mono' : 'text-red-500 font-bold'}>
                        {wh.isOpen ? `${wh.openTime} - ${wh.closeTime}` : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-bold text-sm text-neutral-900 mb-1">About Salon</h4>
                <p className="text-xs text-neutral-600 leading-relaxed">{salon.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <IndianRupee className="w-4 h-4" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Starting Price</span>
          <div className="text-lg font-black text-slate-900">Rs {startingPrice}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Distance</span>
          <div className="text-sm font-black text-slate-900">{distanceLabel}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Today</span>
          <div className="text-sm font-black text-slate-900">
            {todayHours?.isOpen ? `${todayHours.openTime} - ${todayHours.closeTime}` : 'Closed'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Photos, Facilities & Map</h3>
            <p className="text-xs text-slate-500">{salon.address}, {salon.city}</p>
          </div>
          <Map className="w-5 h-5 text-indigo-600 shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[salon.coverUrl, salon.logoUrl].filter(Boolean).slice(0, 4).map((photo, idx) => (
            <img
              key={`${photo}-${idx}`}
              src={photo}
              alt={`${salon.name} photo ${idx + 1}`}
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-xl object-cover bg-slate-100 border border-slate-100"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {facilities.map((facility) => (
            <span key={facility} className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
              {facility}
            </span>
          ))}
        </div>
        <div className="h-48 rounded-2xl border border-slate-200 overflow-hidden relative bg-[linear-gradient(135deg,#eef2ff,#f8fafc,#dcfce7)]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-slate-950 text-amber-300 border-4 border-white shadow-lg flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5 fill-amber-300" />
              </div>
              <div className="mt-2 px-3 py-1 rounded-lg bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-800">
                {salon.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Thumb-Accessible on Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3.5 shadow-2xl pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
          <div className="hidden sm:block">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">
              {isTurfBusiness(salon.category, salon.bookingMode) ? 'Ready to play?' : 'Ready for a turn?'}
            </span>
            <div className="text-sm font-bold text-slate-900">
              {isTurfBusiness(salon.category, salon.bookingMode)
                ? `${(salon.resources || []).length || 1} Turf(s) • Custom Slot Booking`
                : `Queue: ${queue.length} waiting • ~${queue.estimatedWaitMinutes}m wait`}
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-3 justify-end">
            {!isTurfBusiness(salon.category, salon.bookingMode) && (
              <button
                id="sticky-join-queue-btn"
                onClick={() => onJoinQueue(salon)}
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Ticket className="w-4 h-4" />
                <span>{t.joinQueue}</span>
              </button>
            )}

            <button
              id="sticky-book-apt-btn"
              onClick={() => onBookAppointment(salon)}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                isTurfBusiness(salon.category, salon.bookingMode)
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{isTurfBusiness(salon.category, salon.bookingMode) ? 'Book Turf Slot' : t.bookAppointment}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
