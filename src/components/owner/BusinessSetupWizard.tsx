import React, { useState } from 'react';
import {
  Salon,
  SalonHours,
  SalonHoliday,
  TurfResource,
  TurfAvailabilitySchedule,
  isTurfBusiness,
} from '../../types';
import { api } from '../../services/api';
import { NumberInput } from '../common/NumberInput';
import { useAuth } from '../../context/AuthContext';
import { AddressLocationInput } from '../common/AddressLocationInput';
import { BusinessCategoryInput } from '../common/BusinessCategoryInput';
import { WorkingHoursEditor } from './WorkingHoursEditor';
import { TurfDetailsEditor } from './TurfDetailsEditor';
import { TurfAvailabilityBuilder } from './TurfAvailabilityBuilder';
import {
  Building2,
  MapPin,
  Image,
  Scissors,
  Users,
  Clock,
  Settings,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  X,
  ArrowRight,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Layers,
  Pencil,
} from 'lucide-react';

interface BusinessSetupWizardProps {
  existingSalon?: Salon | null;
  onComplete: (salon: Salon) => void;
}

const DEFAULT_HOURS: SalonHours[] = [
  { dayOfWeek: 0, dayName: 'Sunday', openTime: '09:00', closeTime: '21:00', isOpen: false },
  { dayOfWeek: 1, dayName: 'Monday', openTime: '09:00', closeTime: '21:00', isOpen: true },
  { dayOfWeek: 2, dayName: 'Tuesday', openTime: '09:00', closeTime: '21:00', isOpen: true },
  { dayOfWeek: 3, dayName: 'Wednesday', openTime: '09:00', closeTime: '21:00', isOpen: true },
  { dayOfWeek: 4, dayName: 'Thursday', openTime: '09:00', closeTime: '21:00', isOpen: true },
  { dayOfWeek: 5, dayName: 'Friday', openTime: '09:00', closeTime: '21:00', isOpen: true },
  { dayOfWeek: 6, dayName: 'Saturday', openTime: '09:00', closeTime: '21:00', isOpen: true },
];

interface DraftService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string;
  description: string;
}

interface DraftStaff {
  id: string;
  name: string;
  title: string;
  phone: string;
}

export const BusinessSetupWizard: React.FC<BusinessSetupWizardProps> = ({
  existingSalon,
  onComplete,
}) => {
  const { user } = useAuth();
  const startStep = existingSalon?.setupStep || 1;

  const [step, setStep] = useState(startStep);
  const [salonId, setSalonId] = useState<string | null>(existingSalon?.id || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Business Basics
  const [name, setName] = useState(existingSalon?.name || '');
  const [category, setCategory] = useState(existingSalon?.category || 'Barber Shop');
  const [phone, setPhone] = useState(existingSalon?.phone || user?.phone || '');
  const [email, setEmail] = useState(existingSalon?.email || '');
  const [description, setDescription] = useState(existingSalon?.description || '');
  const [website, setWebsite] = useState(existingSalon?.website || '');
  const [instagram, setInstagram] = useState(existingSalon?.instagram || '');

  // Step 2 — Location
  const [address, setAddress] = useState(existingSalon?.address || '');
  const [city, setCity] = useState(existingSalon?.city || '');
  const [lat, setLat] = useState<number | undefined>(existingSalon?.lat || undefined);
  const [lng, setLng] = useState<number | undefined>(existingSalon?.lng || undefined);

  // Step 3 — Photos
  const [logoUrl, setLogoUrl] = useState(existingSalon?.logoUrl || '');
  const [photos, setPhotos] = useState<string[]>(
    existingSalon?.photos?.length ? existingSalon.photos : (existingSalon?.coverUrl ? [existingSalon.coverUrl] : [])
  );

  // Turf-Specific State (Steps 4 & 5 for Turf)
  const isTurf = isTurfBusiness(category);
  const [turfs, setTurfs] = useState<TurfResource[]>(
    existingSalon?.resources || [
      {
        id: 'turf_1',
        salonId: existingSalon?.id || '',
        name: 'Turf 1',
        type: '7-a-side Football',
        capacity: 14,
        pricePerHour: 800,
        description: 'Synthetic grass surface with floodlights and spectator seating.',
        isActive: true,
      },
    ]
  );
  const [turfSchedule, setTurfSchedule] = useState<TurfAvailabilitySchedule[]>(
    existingSalon?.turfSchedule || []
  );

  // Salon-Specific State (Steps 4 & 5 for Barber/Salon)
  const [services, setServices] = useState<DraftService[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: '', price: 0, durationMinutes: 30, category: 'General', description: '' });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [bookingHandling, setBookingHandling] = useState<'none' | 'staff' | 'resource'>('none');
  const [staffList, setStaffList] = useState<DraftStaff[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', title: '', phone: '' });

  // Working Hours (For non-turf)
  const [workingHours, setWorkingHours] = useState<SalonHours[]>(existingSalon?.workingHours || DEFAULT_HOURS);
  const [holidays, setHolidays] = useState<SalonHoliday[]>(existingSalon?.holidays || []);

  // Booking Settings / Rules
  const [advanceBookingDays, setAdvanceBookingDays] = useState(
    existingSalon?.bookingSettings?.advanceBookingDays || 30
  );
  const [minNoticeMinutes, setMinNoticeMinutes] = useState(
    existingSalon?.bookingSettings?.minNoticeMinutes || 30
  );
  const [cancellationAllowed, setCancellationAllowed] = useState(
    existingSalon?.bookingSettings?.cancellationAllowed ?? true
  );
  const [cancellationDeadlineHours, setCancellationDeadlineHours] = useState(
    existingSalon?.bookingSettings?.cancellationDeadlineHours || 2
  );
  const [refundPercentage, setRefundPercentage] = useState(
    existingSalon?.bookingSettings?.refundPercentage ?? 70
  );
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(
    existingSalon?.bookingSettings?.reminderMinutesBefore ?? 30
  );
  const [enableQueue, setEnableQueue] = useState(existingSalon?.enableQueue || false);

  // ─── Dynamic Steps List based on Category ───
  const steps = isTurf
    ? [
        { id: 1, label: 'Your Business', icon: Building2 },
        { id: 2, label: 'Location', icon: MapPin },
        { id: 3, label: 'Photos', icon: Image },
        { id: 4, label: 'Turf Details', icon: Layers },
        { id: 5, label: 'Turf Availability', icon: Clock },
        { id: 6, label: 'Booking Rules', icon: Settings },
        { id: 7, label: 'Review & Submit', icon: CheckCircle2 },
      ]
    : [
        { id: 1, label: 'Your Business', icon: Building2 },
        { id: 2, label: 'Location', icon: MapPin },
        { id: 3, label: 'Photos', icon: Image },
        { id: 4, label: 'Services', icon: Scissors },
        { id: 5, label: 'Staff', icon: Users },
        { id: 6, label: 'Hours', icon: Clock },
        { id: 7, label: 'Settings', icon: Settings },
        { id: 8, label: 'Review', icon: CheckCircle2 },
      ];

  const totalSteps = steps.length;
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // ─── Save Draft to Backend ───
  const saveDraft = async (updates: Record<string, unknown>, nextStep: number) => {
    setSaving(true);
    setError('');
    try {
      const bookingMode = isTurf ? 'resource_slot' : 'appointment';
      if (!salonId) {
        // Create the business
        const res = await api.createSalon({
          name: name.trim(),
          category,
          phone: phone.trim(),
          email: email.trim(),
          description: description.trim(),
          website: website.trim(),
          instagram: instagram.trim(),
          address: address.trim() || 'To be added',
          city: city.trim(),
          lat,
          lng,
          bookingMode,
          setupStep: nextStep,
          resources: isTurf ? turfs : [{ id: 'salon_general', salonId: 'new', name: 'General Appointments', type: 'General', isActive: true, pricePerHour: 0 }],
          turfSchedule: turfSchedule,
          ...updates,
        } as any);
        if (res?.salon) {
          setSalonId(res.salon.id);
          setStep(nextStep);
          return res.salon;
        }
        throw new Error('Failed to create business profile');
      } else {
        const res = await api.updateSalon(salonId, {
          setupStep: nextStep,
          bookingMode,
          resources: isTurf ? turfs : [{ id: 'salon_general', salonId, name: 'General Appointments', type: 'General', isActive: true, pricePerHour: 0 }],
          turfSchedule: turfSchedule,
          ...updates,
        } as any);
        if (res?.salon) {
          setStep(nextStep);
          return res.salon;
        }
        throw new Error('Failed to save progress');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ─── Step Handlers ───
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !category) {
      setError('Business name, category, and phone are required.');
      return;
    }
    await saveDraft({ name, category, phone, email, description, website, instagram }, 2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Please enter your business address.');
      return;
    }
    await saveDraft({ address, city, lat, lng }, 3);
  };

  const handleStep3 = async () => {
    await saveDraft({ logoUrl, coverUrl: photos[0] || '', photos }, 4);
  };

  // ── Turf Specific Step Handlers ──
  const handleTurfDetailsNext = async () => {
    if (turfs.length === 0) {
      setError('Please add at least one turf.');
      return;
    }
    await saveDraft({ resources: turfs }, 5);
  };

  const handleTurfAvailabilityNext = async () => {
    await saveDraft({ turfSchedule, resources: turfs }, 6);
  };

  const handleTurfBookingRulesNext = async () => {
    await saveDraft(
      {
        bookingSettings: {
          advanceBookingDays,
          minNoticeMinutes,
          cancellationAllowed,
          cancellationDeadlineHours,
          refundPercentage,
          reminderMinutesBefore,
          customerChoosesStaff: false,
        },
        enableQueue: false, // Turf uses slot booking, not walk-in haircut queue
      },
      7
    );
  };

  // ── Salon Specific Step Handlers ──
  const handleAddService = () => {
    if (!newSvc.name.trim()) return;
    setServices((prev) => [...prev, { ...newSvc, id: `draft_srv_${Date.now()}` }]);
    setNewSvc({ name: '', price: 0, durationMinutes: 30, category: 'General', description: '' });
    setShowAddService(false);
  };

  const handleSalonServicesNext = async () => {
    if (salonId && services.length > 0) {
      setSaving(true);
      try {
        for (const svc of services) {
          await api.addService(salonId, {
            name: svc.name,
            price: svc.price,
            durationMinutes: svc.durationMinutes,
            category: svc.category,
            description: svc.description,
            isActive: true,
          });
        }
        setServices([]);
      } catch {
        /* ignore */
      }
      setSaving(false);
    }
    await saveDraft({ setupStep: 5 }, 5);
  };

  const handleAddStaff = () => {
    if (!newStaff.name.trim()) return;
    setStaffList((prev) => [...prev, { ...newStaff, id: `draft_stf_${Date.now()}` }]);
    setNewStaff({ name: '', title: '', phone: '' });
    setShowAddStaff(false);
  };

  const handleSalonStaffNext = async () => {
    if (salonId && staffList.length > 0) {
      setSaving(true);
      try {
        for (const st of staffList) {
          await api.addStaff(salonId, {
            name: st.name,
            title: st.title,
            phone: st.phone,
            status: 'available',
            isActive: true,
          });
        }
        setStaffList([]);
      } catch {
        /* ignore */
      }
      setSaving(false);
    }
    await saveDraft({ setupStep: 6 }, 6);
  };

  const handleSalonHoursNext = async () => {
    await saveDraft({ workingHours, holidays, turfSchedule, setupStep: 7 }, 7);
  };

  const handleSalonSettingsNext = async () => {
    await saveDraft(
      {
        enableQueue,
        bookingSettings: {
          advanceBookingDays,
          minNoticeMinutes,
          cancellationAllowed,
          cancellationDeadlineHours,
          refundPercentage,
          reminderMinutesBefore,
          customerChoosesStaff: bookingHandling === 'staff',
        },
        setupStep: 8,
      },
      8
    );
  };

  // ── Final Submit Handler ──
  const handleSubmit = async () => {
    if (!salonId) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.updateSalon(salonId, {
        status: 'under_review',
        setupStep: totalSteps,
        isPublished: true, // Go live on submit
        bookingMode: isTurf ? 'resource_slot' : 'appointment',
        resources: isTurf ? turfs : [{ id: 'salon_general', salonId, name: 'General Appointments', type: 'General', isActive: true, pricePerHour: 0 }],
        turfSchedule: turfSchedule,
      } as any);

      if (res?.salon) {
        onComplete(res.salon);
      }
    } catch (e: any) {
      setError(e?.message || 'Submission failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── UI Helpers ───
  const stepHeader = (title: string, subtitle: string) => (
    <div className="mb-5">
      <p className="text-[11px] text-emerald-600 font-black uppercase tracking-widest mb-0.5">
        Step {step} of {totalSteps}
      </p>
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );

  const formInput = (label: string, required = false, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );

  const inputCls =
    'w-full px-3.5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-slate-900 bg-white';

  const navButtons = (
    onBackBtn?: () => void,
    onNextBtn?: () => void | Promise<void>,
    nextLabel = 'Save & Continue',
    canNext = true
  ) => (
    <div className="flex items-center justify-between pt-6 mt-8 border-t border-slate-100 gap-4">
      {onBackBtn ? (
        <button
          type="button"
          onClick={onBackBtn}
          className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-[14px] border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors w-full sm:w-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      ) : (
        <div className="hidden sm:block" />
      )}
      {onNextBtn && (
        <button
          type="button"
          onClick={onNextBtn}
          disabled={saving || !canNext}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 rounded-[14px] bg-[#00a870] hover:bg-[#009665] text-white font-bold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8">
        {/* Step Progress Bar */}
        <div className="flex items-center gap-1 mb-6 flex-wrap">
          {steps.map((s) => {
            const Icon = s.icon;
            const done = step > s.id;
            const current = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                    current
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </div>
                {s.id < totalSteps && (
                  <div className={`h-0.5 w-3 rounded ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-700 flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── STEP 1: BUSINESS BASICS ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            {stepHeader("Let's set up your business", 'Tell players & customers who you are and what you offer.')}

            {formInput(
              isTurf ? 'Turf / Sports Arena Name' : 'Business Name',
              true,
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isTurf ? 'e.g. QGo Turf Arena & Sports Club' : 'e.g. Royal Touch Barber'}
                className={inputCls}
              />
            )}

            <BusinessCategoryInput
              value={category}
              onChange={setCategory}
              label="Business Category"
              required
            />

            {formInput(
              'Contact Phone',
              true,
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className={inputCls}
              />
            )}

            {formInput(
              'Short Description',
              false,
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isTurf
                    ? 'e.g. Premium 7-a-side and box cricket turf with FIFA-grade grass and floodlights.'
                    : 'e.g. Premium grooming studio in Anna Nagar.'
                }
                className={inputCls}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formInput(
                'Email (optional)',
                false,
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@qgoturf.com"
                  className={inputCls}
                />
              )}
              {formInput(
                'Instagram (optional)',
                false,
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@qgoturf"
                  className={inputCls}
                />
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !name.trim() || !phone.trim()}
              className="w-full py-3.5 mt-6 rounded-[14px] bg-[#00a870] hover:bg-[#009665] text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Save &amp; Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ── STEP 2: LOCATION ── */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            {stepHeader(
              'Where is your venue located?',
              'Help customers and players find directions easily via Google Maps & GPS.'
            )}

            <AddressLocationInput
              value={address}
              onChange={(addr, lt, ln, ct) => {
                setAddress(addr);
                if (lt !== undefined) setLat(lt);
                if (ln !== undefined) setLng(ln);
                if (ct) setCity(ct);
              }}
              placeholder="Start typing turf address..."
              required
            />

            <div className="pt-6 mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-[14px] border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 w-full sm:w-auto"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="submit"
                disabled={saving || !address.trim()}
                className="flex-1 sm:flex-none px-8 py-3.5 rounded-[14px] bg-[#00a870] hover:bg-[#009665] text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                Save &amp; Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: PHOTOS ── */}
        {step === 3 && (
          <div className="space-y-4">
            {stepHeader(
              'Add photos of your venue',
              'Photos of your turf, lighting, and amenities build trust with players. You can skip and add later.'
            )}

            {formInput(
              'Logo Image (optional)',
              false,
              <div className="space-y-3">
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-100 transition-colors">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setLogoUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Image className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">Upload Gallery</span>
                  </label>
                  <label className="flex-1 cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setLogoUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Sparkles className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">Take Photo</span>
                  </label>
                </div>
                {logoUrl && (
                  <div className="flex items-start gap-4 mt-2">
                    <img src={logoUrl} alt="Logo preview" className="h-16 rounded-md object-contain border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        const input = document.getElementById('logo-upload') as HTMLInputElement;
                        if (input) input.value = '';
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {formInput(
              'Venue Photos (optional)',
              false,
              <div className="space-y-3">
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-100 transition-colors">
                    <input
                      id="photos-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          const newPhotos: string[] = [];
                          let loaded = 0;
                          files.forEach((file: File) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              newPhotos.push(reader.result as string);
                              loaded++;
                              if (loaded === files.length) {
                                setPhotos(prev => [...prev, ...newPhotos]);
                              }
                            };
                            reader.readAsDataURL(file);
                          });
                        }
                      }}
                      className="hidden"
                    />
                    <Image className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">Upload Gallery</span>
                  </label>
                  <label className="flex-1 cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          const newPhotos: string[] = [];
                          let loaded = 0;
                          files.forEach((file: File) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              newPhotos.push(reader.result as string);
                              loaded++;
                              if (loaded === files.length) {
                                setPhotos(prev => [...prev, ...newPhotos]);
                              }
                            };
                            reader.readAsDataURL(file);
                          });
                        }
                      }}
                      className="hidden"
                    />
                    <Sparkles className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">Take Photo</span>
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {photos.map((photo, idx) => (
                      <div key={idx} className="flex flex-col items-start gap-2">
                        <img src={photo} alt={`Venue photo ${idx + 1}`} className="h-32 w-full object-cover rounded-md border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhotos(prev => prev.filter((_, i) => i !== idx));
                            if (photos.length === 1) {
                              const input = document.getElementById('photos-upload') as HTMLInputElement;
                              if (input) input.value = '';
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 italic">
              Upload an image file from your device.
            </p>

            {navButtons(
              goBack,
              handleStep3,
              photos.length > 0 || logoUrl ? 'Save & Continue' : 'Skip for Now'
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TURF-SPECIFIC FLOW (Steps 4, 5, 6, 7)
           ══════════════════════════════════════════════════ */}

        {/* ── TURF STEP 4: TURF DETAILS (Multiple Turfs) ── */}
        {isTurf && step === 4 && (
          <div className="space-y-4">
            {stepHeader('Turf & Resource Details', 'Set up your pitches, courts, or multi-purpose grounds.')}

            <TurfDetailsEditor resources={turfs} onChange={setTurfs} />

            {navButtons(goBack, handleTurfDetailsNext, 'Save & Continue')}
          </div>
        )}

        {/* ── TURF STEP 5: TURF AVAILABILITY & CUSTOM SLOTS ── */}
        {isTurf && step === 5 && (
          <div className="space-y-4">
            {stepHeader(
              'Turf Availability & Slot Builder',
              'Define when players can book. Choose durations (30m, 1h, 90m, custom), set prices, and add breaks.'
            )}

            <TurfAvailabilityBuilder
              resources={turfs}
              turfSchedule={turfSchedule}
              onChange={setTurfSchedule}
            />

            {navButtons(goBack, handleTurfAvailabilityNext, 'Save & Continue')}
          </div>
        )}

        {/* ── TURF STEP 6: BOOKING RULES ── */}
        {isTurf && step === 6 && (
          <div className="space-y-5">
            {stepHeader('Booking Rules & Preferences', 'Configure how far ahead players can book and cancellation policies.')}

            <div className="space-y-4">
              {/* Advance Booking Window */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  How many days ahead can players book?
                </label>
                <select
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={1}>1 day ahead</option>
                  <option value={3}>3 days ahead</option>
                  <option value={7}>7 days ahead</option>
                  <option value={14}>14 days ahead</option>
                  <option value={30}>30 days ahead (Default · Recommended)</option>
                  <option value={60}>60 days ahead</option>
                  <option value={90}>90 days ahead</option>
                </select>
              </div>

              {/* Minimum Notice */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  Minimum notice before slot start
                </label>
                <select
                  value={minNoticeMinutes}
                  onChange={(e) => setMinNoticeMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={0}>No minimum notice (Book anytime)</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before (Default)</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                </select>
              </div>

              {/* Player Cancellation Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-800">Allow Player Cancellations?</p>
                  <p className="text-[11px] text-slate-500">Allow players to cancel their slot in advance</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancellationAllowed(!cancellationAllowed)}
                >
                  {cancellationAllowed ? (
                    <ToggleRight className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-300" />
                  )}
                </button>
              </div>

              {cancellationAllowed && (
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3.5">
                  {/* Cancellation Deadline */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Cancellation Deadline
                    </label>
                    <select
                      value={cancellationDeadlineHours}
                      onChange={(e) => setCancellationDeadlineHours(Number(e.target.value))}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={0.5}>30 minutes before slot</option>
                      <option value={1}>1 hour before slot</option>
                      <option value={2}>2 hours before slot (Default)</option>
                      <option value={3}>3 hours before slot</option>
                      <option value={6}>6 hours before slot</option>
                      <option value={12}>12 hours before slot</option>
                      <option value={24}>24 hours before slot</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cancellations made after this cutoff become disabled and non-refundable.
                    </p>
                  </div>

                  {/* Cancellation Refund Percentage */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                      Cancellation Refund Percentage
                    </label>
                    <select
                      value={refundPercentage}
                      onChange={(e) => setRefundPercentage(Number(e.target.value))}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={100}>100% Refund (Full Refund)</option>
                      <option value={80}>80% Refund</option>
                      <option value={70}>70% Refund (Default · Recommended)</option>
                      <option value={60}>60% Refund</option>
                      <option value={50}>50% Refund</option>
                      <option value={40}>40% Refund</option>
                      <option value={30}>30% Refund</option>
                      <option value={20}>20% Refund</option>
                      <option value={10}>10% Refund</option>
                      <option value={0}>0% Refund / No Refund</option>
                    </select>
                  </div>

                  {/* Live Refund Calculation Example Card */}
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-slate-900">
                      💡 Policy Preview (on a ₹1,000 booking):
                    </p>
                    <p className="text-emerald-700 font-semibold">
                      • Player receives: <strong>₹{Math.round((1000 * refundPercentage) / 100)}</strong> ({refundPercentage}%)
                    </p>
                    <p className="text-slate-500">
                      • Non-refundable fee retained: <strong>₹{1000 - Math.round((1000 * refundPercentage) / 100)}</strong> ({100 - refundPercentage}%)
                    </p>
                  </div>
                </div>
              )}

              {/* Booking Reminder Notification Setting */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  Booking Reminder Notification
                </label>
                <select
                  value={reminderMinutesBefore}
                  onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={15}>15 minutes before slot</option>
                  <option value={30}>30 minutes before slot (Default)</option>
                  <option value={60}>1 hour before slot</option>
                  <option value={120}>2 hours before slot</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Automated notification sent to customer before their booked slot starts.
                </p>
              </div>
            </div>

            {navButtons(goBack, handleTurfBookingRulesNext, 'Save & Continue')}
          </div>
        )}

        {/* ── TURF STEP 7: REVIEW & SUBMIT ── */}
        {isTurf && step === 7 && (
          <div className="space-y-5">
            {stepHeader('Review & Launch Turf', 'Review your setup and publish your turf on QGo.')}

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                <span className="text-2xl">🏟️</span>
                <div>
                  <h4 className="text-base font-black text-slate-900">{name}</h4>
                  <p className="text-xs text-emerald-800 font-bold mt-0.5">{category}</p>
                  <p className="text-xs text-slate-500 mt-1">{address}, {city}</p>
                </div>
              </div>

              {/* Turf Resources Summary */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Turfs / Pitches ({turfs.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {turfs.map((t, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs">
                      <p className="font-black text-slate-900">{t.name}</p>
                      <p className="text-[10px] text-slate-500">{t.type} · Max {t.capacity || 14} players</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules summary */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase tracking-wider text-slate-500">
                    Booking & Availability Overview
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="font-bold text-emerald-600 hover:underline"
                  >
                    Edit Slots
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Advance Booking</span>
                    <span className="font-bold">Up to {advanceBookingDays} days</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Min Notice</span>
                    <span className="font-bold">{minNoticeMinutes} minutes</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-xl active:scale-98"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span>Launch Turf on QGo</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            SALON / BARBER FLOW (Steps 4, 5, 6, 7, 8)
           ══════════════════════════════════════════════════ */}

        {/* ── SALON STEP 4: SERVICES ── */}
        {!isTurf && step === 4 && (
          <div className="space-y-4">
            {stepHeader('Your Services', 'Add the services customers can book.')}

            {services.length === 0 ? (
              <div className="py-6 text-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                <Scissors className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No services added yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{svc.name}</p>
                      <p className="text-xs text-slate-500">₹{svc.price} · {svc.durationMinutes} min</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setNewSvc({
                            name: svc.name,
                            price: svc.price,
                            durationMinutes: svc.durationMinutes,
                            category: svc.category,
                            description: svc.description || ''
                          });
                          setEditingServiceId(svc.id);
                          setShowAddService(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setServices((prev) => prev.filter((s) => s.id !== svc.id))}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddService ? (
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <h4 className="text-sm font-black text-slate-900">{editingServiceId ? 'Edit Service' : 'New Service'}</h4>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput
                    placeholder="Price (₹)"
                    value={newSvc.price || ''}
                    onChange={(val) => setNewSvc((p) => ({ ...p, price: val }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  />
                  <NumberInput
                    placeholder="Duration (min)"
                    value={newSvc.durationMinutes}
                    onChange={(val) => setNewSvc((p) => ({ ...p, durationMinutes: val }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Service name *"
                  value={newSvc.name}
                  onChange={(e) => setNewSvc((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setShowAddService(false);
                      setEditingServiceId(null);
                      setNewSvc({ name: '', price: 0, durationMinutes: 30, category: 'General', description: '' });
                    }} 
                    className="flex-1 py-2 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (!newSvc.name.trim()) return;
                      if (editingServiceId) {
                        setServices(prev => prev.map(s => s.id === editingServiceId ? { ...s, ...newSvc } : s));
                        setEditingServiceId(null);
                      } else {
                        setServices(prev => [...prev, { ...newSvc, id: 'svc_' + Date.now() }]);
                      }
                      setShowAddService(false);
                      setNewSvc({ name: '', price: 0, durationMinutes: 30, category: 'General', description: '' });
                    }} 
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black"
                  >
                    {editingServiceId ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddService(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            )}

            {navButtons(goBack, handleSalonServicesNext, 'Save & Continue')}
          </div>
        )}

        {/* ── SALON STEP 5: STAFF ── */}
        {!isTurf && step === 5 && (
          <div className="space-y-4">
            {stepHeader('Team & Stylists', 'Add staff members if customers select a specific person.')}

            <div className="space-y-2">
              {staffList.map((st) => (
                <div key={st.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-sm font-bold">{st.name}</p>
                    <p className="text-xs text-slate-500">{st.title}</p>
                  </div>
                  <button onClick={() => setStaffList((prev) => prev.filter((s) => s.id !== st.id))}>
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>

            {showAddStaff ? (
              <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <input
                  type="text"
                  placeholder="Staff Name *"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
                <input
                  type="text"
                  placeholder="Role (e.g. Master Stylist)"
                  value={newStaff.title}
                  onChange={(e) => setNewStaff((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowAddStaff(false)} className="flex-1 py-2 text-xs font-bold">
                    Cancel
                  </button>
                  <button onClick={handleAddStaff} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddStaff(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Team Member
              </button>
            )}

            {navButtons(goBack, handleSalonStaffNext, 'Save & Continue')}
          </div>
        )}

        {/* ── SALON STEP 6: HOURS ── */}
        {!isTurf && step === 6 && (
          <div className="space-y-4">
            {stepHeader('Availability & Slot Builder', 'Define when customers can book your services.')}
            <TurfAvailabilityBuilder
              resources={[{ id: 'salon_general', salonId: salonId || 'new', name: 'General Appointments', type: 'General', isActive: true, pricePerHour: 0 }]}
              turfSchedule={turfSchedule}
              onChange={setTurfSchedule}
            />

            {navButtons(goBack, handleSalonHoursNext, 'Save & Continue')}
          </div>
        )}

        {/* ── SALON STEP 7: SETTINGS ── */}
        {!isTurf && step === 7 && (
          <div className="space-y-4">
            {stepHeader('Booking & Queue Settings', 'Control how appointments and live walk-in queues behave.')}

            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50">
              <div>
                <p className="text-sm font-black text-indigo-900">Enable Live Walk-in Queue</p>
                <p className="text-[11px] text-indigo-700">Allow customers to take digital queue tokens from home</p>
              </div>
              <button type="button" onClick={() => setEnableQueue(!enableQueue)}>
                {enableQueue ? <ToggleRight className="w-8 h-8 text-indigo-600" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
              </button>
            </div>

            {navButtons(goBack, handleSalonSettingsNext, 'Save & Continue')}
          </div>
        )}

        {/* ── SALON STEP 8: REVIEW ── */}
        {!isTurf && step === 8 && (
          <div className="space-y-4">
            {stepHeader('Review Your Salon', 'Ready to submit for verification?')}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl"
            >
              <Sparkles className="w-4 h-4" />
              Submit for Verification
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
