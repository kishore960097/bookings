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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-[rgba(23,23,23,0.70)] animate-pulse">
        <Scissors className="w-8 h-8 mx-auto mb-2 text-[#FF9F1C] animate-spin" />
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
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[rgba(23,23,23,0.70)] hover:text-[#171717] bg-[#FFFFFF] px-3.5 py-2 rounded-xl border border-[rgba(23,23,23,0.12)] shadow-xs transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.back}</span>
      </button>

      {/* Hero Header Card */}
      <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(23,23,23,0.12)] overflow-hidden shadow-sm">
        {/* Cover Photo */}
        <div className="relative h-60 sm:h-72 w-full bg-[#FFFFFF] overflow-hidden flex items-center justify-center">
          {salon.coverUrl ? (
            <img
              src={salon.coverUrl}
              alt={salon.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[rgba(23,23,23,0.70)]">
              
              <span className="text-sm font-bold text-[#171717]">{salon.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF] to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 text-[#171717] flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF9F1C] text-[#171717]">
                  {salon.category}
                </span>
                {salon.verified && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FF9F1C] text-[#171717] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{salon.name}</h1>
              <p className="text-xs text-[rgba(23,23,23,0.70)] mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
                {salon.address}, {salon.city}
              </p>
            </div>

            <div className="bg-[rgba(23,23,23,0.05)] px-3.5 py-2 rounded-2xl border border-white/20 text-right">
              <div className="flex items-center gap-1 text-[#FF9F1C] font-bold text-base justify-end">
                <Star className="w-4 h-4 fill-[#FF9F1C]" />
                <span>{salon.rating > 0 ? salon.rating.toFixed(1) : 'New'}</span>
              </div>
              <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
                {salon.reviewCount > 0 ? `(${salon.reviewCount} reviews)` : 'Not rated yet'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Queue / Turf Slot Booking Banner */}
        {isTurfBusiness(salon.category, salon.bookingMode) ? (
          <div className="bg-[#FF9F1C] text-[#171717] p-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#FF9F1C]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9F1C]/30 border border-[rgba(23,23,23,0.12)]0/40 flex items-center justify-center text-[#FF9F1C] font-bold">
                🏟️
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-[#FF9F1C] font-black">
                  Turf Arena &amp; Slot Booking
                </span>
                <div className="text-sm font-bold text-[#171717] flex items-center gap-2">
                  <span>{(salon.resources || []).length || 1} Playable Turfs Available</span>
                  <span className="text-[#FF9F1C]">•</span>
                  <span className="text-[#FF9F1C] font-medium">Custom Slots &amp; Hourly Rates</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${salon.phone}`}
                className="p-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#FF9F1C] transition-colors border border-[#FF9F1C]"
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
                className="p-2.5 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#FF9F1C] transition-colors border border-[#FF9F1C]"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFFFFF] text-[#171717] p-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(23,23,23,0.12)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF9F1C] border border-[#FF9F1C] flex items-center justify-center text-[#FF9F1C]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-[rgba(23,23,23,0.70)] font-black">
                  {t.liveQueue}
                </span>
                <div className="text-sm font-bold text-[#171717] flex items-center gap-2">
                  <span>{queue.length} customers in line</span>
                  <span className="text-[rgba(23,23,23,0.70)]">•</span>
                  <span className="text-[#FF9F1C] font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{queue.estimatedWaitMinutes} mins est. wait
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${salon.phone}`}
                className="p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] text-[rgba(23,23,23,0.70)] transition-colors border border-[rgba(23,23,23,0.12)]"
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
                className="p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[rgba(23,23,23,0.05)] text-[rgba(23,23,23,0.70)] transition-colors border border-[rgba(23,23,23,0.12)]"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[rgba(23,23,23,0.12)] bg-[#FFFFFF] overflow-x-auto scrollbar-none">
          <button
            id="tab-services"
            onClick={() => setActiveTab('services')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors duration-150 whitespace-nowrap ${
              activeTab === 'services'
                ? 'border-[#FF9F1C] text-[#FF9F1C] bg-[#FFFFFF]'
                : 'border-transparent text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
            }`}
          >
            {isTurfBusiness(salon.category, salon.bookingMode) ? 'Turfs & Pitches' : t.servicesTab}
          </button>
          {!isTurfBusiness(salon.category, salon.bookingMode) && (
            <button
              id="tab-staff"
              onClick={() => setActiveTab('staff')}
              className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors duration-150 whitespace-nowrap ${
                activeTab === 'staff'
                  ? 'border-[#FF9F1C] text-[#FF9F1C] bg-[#FFFFFF]'
                  : 'border-transparent text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
              }`}
            >
              {t.stylistsTab} ({staff.length})
            </button>
          )}
          <button
            id="tab-reviews"
            onClick={() => setActiveTab('reviews')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors duration-150 whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'border-[#FF9F1C] text-[#FF9F1C] bg-[#FFFFFF]'
                : 'border-transparent text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
            }`}
          >
            {t.reviewsTab} ({reviews.length})
          </button>
          <button
            id="tab-hours"
            onClick={() => setActiveTab('hours')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors duration-150 whitespace-nowrap ${
              activeTab === 'hours'
                ? 'border-[#FF9F1C] text-[#FF9F1C] bg-[#FFFFFF]'
                : 'border-transparent text-[rgba(23,23,23,0.70)] hover:text-[#171717]'
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
                      className="p-5 rounded-3xl border border-[rgba(23,23,23,0.12)]/90 bg-[#FFFFFF] hover:border-[#FF9F1C] hover:shadow-md transition-colors duration-150 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#FF9F1C] bg-[rgba(255,159,28,0.15)] px-2 py-0.5 rounded-md">
                              {turf.type}
                            </span>
                            <h4 className="font-extrabold text-base text-[#171717] mt-1">
                              {turf.name}
                            </h4>
                            {turf.capacity && (
                              <p className="text-xs text-[rgba(23,23,23,0.70)] mt-0.5">
                                Capacity: Up to {turf.capacity} players
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-[#FF9F1C]">
                              ₹{turf.pricePerHour || salon.startingPrice || 800}
                            </span>
                            <span className="block text-[11px] text-[rgba(23,23,23,0.70)] font-bold">/ slot</span>
                          </div>
                        </div>
                        {turf.description && (
                          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-2.5 leading-relaxed">
                            {turf.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[rgba(23,23,23,0.12)] flex items-center justify-end">
                        <button
                          onClick={() => onBookAppointment(salon)}
                          className="px-5 py-2 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] text-xs font-black shadow-sm transition-colors duration-150 flex items-center gap-1.5"
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
                      className="p-4 rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[#FFFFFF] hover:border-[rgba(23,23,23,0.12)] hover:shadow-sm transition-colors duration-150 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-[#171717]">
                              {language === 'ta' && srv.nameTa ? srv.nameTa : srv.name}
                            </h4>
                            <span className="text-[11px] font-semibold text-[#FF9F1C] bg-[rgba(255,159,28,0.15)] px-2 py-0.5 rounded-md mt-1 inline-block">
                              {srv.category}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-extrabold text-[#171717]">
                              {t.rupees}
                              {srv.price}
                            </span>
                            <span className="block text-[11px] text-[rgba(23,23,23,0.70)] font-medium">
                              {srv.durationMinutes} {t.mins}
                            </span>
                          </div>
                        </div>
                        {srv.description && (
                          <p className="text-xs text-[rgba(23,23,23,0.70)] mt-2 line-clamp-2 leading-relaxed">
                            {srv.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-[rgba(23,23,23,0.12)] flex items-center justify-end gap-2">
                        <button
                          onClick={() => onJoinQueue(salon, srv)}
                          className="px-3 py-1.5 rounded-xl border border-[rgba(23,23,23,0.12)] text-[#171717] text-xs font-bold hover:bg-[rgba(23,23,23,0.05)] transition-colors"
                        >
                          Join Queue
                        </button>
                        <button
                          onClick={() => onBookAppointment(salon, srv)}
                          className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] text-[#171717] text-xs font-bold hover:bg-[rgba(23,23,23,0.05)] transition-colors"
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
                  className="p-4 rounded-2xl border border-[rgba(23,23,23,0.12)] bg-[#FFFFFF] flex items-start gap-3.5"
                >
                  <img
                    src={st.photoUrl}
                    alt={st.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover bg-[#FFFFFF]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[#171717]">{st.name}</h4>
                      <div className="flex items-center gap-1 text-xs font-bold text-[#FF9F1C] bg-[rgba(255,159,28,0.15)] px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-[#FF9F1C] text-[#FF9F1C]" />
                        <span>{st.rating}</span>
                      </div>
                    </div>
                    <span className="text-xs text-[rgba(23,23,23,0.70)] block">{st.title}</span>

                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          st.status === 'available'
                            ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                            : st.status === 'busy'
                            ? 'bg-[rgba(255,159,28,0.15)] text-[#FF9F1C]'
                            : 'bg-[#FFFFFF] text-[rgba(23,23,23,0.70)]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st.status === 'available'
                              ? 'bg-[#FF9F1C]'
                              : st.status === 'busy'
                              ? 'bg-[#FF9F1C]'
                              : 'bg-[#FFFFFF]'
                          }`}
                        />
                        {st.status === 'available'
                          ? t.available
                          : st.status === 'busy'
                          ? t.busy
                          : t.onBreak}
                      </span>

                      {st.waitingCount !== undefined && st.waitingCount > 0 && (
                        <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
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
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(23,23,23,0.12)]">
                <div>
                  <h4 className="font-bold text-sm text-[#171717]">Verified Customer Reviews</h4>
                  <span className="text-xs text-[rgba(23,23,23,0.70)]">
                    Overall Rating {salon.rating} / 5.0
                  </span>
                </div>
                <button
                  id="write-review-btn"
                  onClick={() => onWriteReview(salon)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] text-[#171717] font-bold text-xs hover:bg-[rgba(23,23,23,0.05)] transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t.writeReview}</span>
                </button>
              </div>

              {reviews.length === 0 ? (
                <p className="text-xs text-[rgba(23,23,23,0.70)] text-center py-8">
                  No reviews yet. Be the first to review after your service!
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-2xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#FFFFFF] text-[#171717] text-xs font-bold flex items-center justify-center">
                            {rev.customerName.charAt(0)}
                          </div>
                          <div>
                            <h5 className="font-bold text-xs text-[#171717]">
                              {rev.customerName}
                            </h5>
                            {rev.staffName && (
                              <span className="text-[11px] text-[rgba(23,23,23,0.70)]">
                                Stylist: {rev.staffName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-[#FF9F1C]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating ? 'fill-[#FF9F1C] text-[#FF9F1C]' : 'text-[rgba(23,23,23,0.70)]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-[rgba(23,23,23,0.70)] leading-relaxed">{rev.comment}</p>

                      {rev.ownerResponse && (
                        <div className="mt-2 p-3 rounded-xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] text-xs text-[rgba(23,23,23,0.70)]">
                          <strong className="text-[#171717] block text-[11px] mb-0.5">
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
                <h4 className="font-bold text-sm text-[#171717] mb-2">{t.workingHours}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {salon.workingHours.map((wh) => (
                    <div
                      key={wh.dayOfWeek}
                      className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] flex items-center justify-between"
                    >
                      <span className="font-semibold text-[#171717]">{wh.dayName}</span>
                      <span className={wh.isOpen ? 'text-[rgba(23,23,23,0.70)] font-mono' : 'text-[#FF9F1C] font-bold'}>
                        {wh.isOpen ? `${wh.openTime} - ${wh.closeTime}` : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-bold text-sm text-[#171717] mb-1">About Salon</h4>
                <p className="text-xs text-[rgba(23,23,23,0.70)] leading-relaxed">{salon.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <IndianRupee className="w-4 h-4" />
          </div>
          <span className="text-[11px] uppercase tracking-widest font-black text-[rgba(23,23,23,0.70)]">Starting Price</span>
          <div className="text-lg font-black text-[#171717]">Rs {startingPrice}</div>
        </div>
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-[11px] uppercase tracking-widest font-black text-[rgba(23,23,23,0.70)]">Distance</span>
          <div className="text-sm font-black text-[#171717]">{distanceLabel}</div>
        </div>
        <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-4 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] flex items-center justify-center mb-2">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[11px] uppercase tracking-widest font-black text-[rgba(23,23,23,0.70)]">Today</span>
          <div className="text-sm font-black text-[#171717]">
            {todayHours?.isOpen ? `${todayHours.openTime} - ${todayHours.closeTime}` : 'Closed'}
          </div>
        </div>
      </div>

      <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(23,23,23,0.12)] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-[#171717] uppercase tracking-wider">Photos, Facilities & Map</h3>
            <p className="text-xs text-[rgba(23,23,23,0.70)]">{salon.address}, {salon.city}</p>
          </div>
          <Map className="w-5 h-5 text-[#FF9F1C] shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[salon.coverUrl, salon.logoUrl].filter(Boolean).slice(0, 4).map((photo, idx) => (
            <img
              key={`${photo}-${idx}`}
              src={photo}
              alt={`${salon.name} photo ${idx + 1}`}
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-xl object-cover bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)]"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {facilities.map((facility) => (
            <span key={facility} className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] text-xs font-bold text-[rgba(23,23,23,0.70)]">
              {facility}
            </span>
          ))}
        </div>
        <div className="h-48 rounded-2xl border border-[rgba(23,23,23,0.12)] overflow-hidden relative bg-[#FFFFFF]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(23,23,23,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.05) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#FFFFFF] text-[#FF9F1C] border-4 border-white shadow-lg flex items-center justify-center mx-auto">
                <MapPin className="w-5 h-5 fill-[#FF9F1C]" />
              </div>
              <div className="mt-2 px-3 py-1 rounded-lg bg-[#FFFFFF] border border-[rgba(23,23,23,0.12)] shadow-sm text-xs font-bold text-[#171717]">
                {salon.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Thumb-Accessible on Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[rgba(23,23,23,0.12)] px-3 sm:px-4 py-2.5 sm:py-3.5 shadow-lg pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
          <div className="hidden sm:block">
            <span className="text-[11px] text-[rgba(23,23,23,0.70)] uppercase tracking-widest font-black">
              {isTurfBusiness(salon.category, salon.bookingMode) ? 'Ready to play?' : 'Ready for a turn?'}
            </span>
            <div className="text-sm font-bold text-[#171717]">
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
                className="flex-1 sm:flex-initial px-4 sm:px-5 py-3 rounded-xl bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717] font-black text-xs uppercase tracking-wider shadow-sm transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Ticket className="w-4 h-4" />
                <span>{t.joinQueue}</span>
              </button>
            )}

            <button
              id="sticky-book-apt-btn"
              onClick={() => onBookAppointment(salon)}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer  ${
                isTurfBusiness(salon.category, salon.bookingMode)
                  ? 'bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717]'
                  : 'bg-[#FF9F1C] hover:bg-[#FF9F1C] text-[#171717]'
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
