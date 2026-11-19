import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Salon, SalonHours, BusinessStatus, isTurfBusiness } from '../../types';
import { api } from '../../services/api';
import { BusinessCategoryInput } from '../common/BusinessCategoryInput';
import { AddressLocationInput } from '../common/AddressLocationInput';
import {
  Pencil,
  X,
  Check,
  Building2,
  Phone,
  Mail,
  Globe,
  Instagram,
  MapPin,
  Camera,
  Image as ImageIcon,
  Plus,
  AlertTriangle,
  Loader2,
  Tag,
  Building,
  Info,
  Save,
  Trash2,
  Clock,
  CheckCircle2,
  Link,
  Wallet,
  ShieldCheck,
} from 'lucide-react';

interface OwnerBusinessProfileEditorProps {
  salon: Salon;
  onUpdateSalon: (updated: Salon) => void;
}

interface EditForm {
  name: string;
  category: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
  logoUrl: string;
  coverUrl: string;
  photos: string[];
  payoutCycle: 'weekly' | 'monthly';
  upiId: string;
  bankAccountHolder: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  payoutAgreementAccepted: boolean;
}

function buildForm(salon: Salon): EditForm {
  return {
    name: salon.name || '',
    category: salon.category || '',
    phone: salon.phone || '',
    email: salon.email || '',
    website: salon.website || '',
    instagram: salon.instagram || '',
    address: salon.address || '',
    city: salon.city || '',
    lat: salon.lat || 0,
    lng: salon.lng || 0,
    description: salon.description || '',
    logoUrl: salon.logoUrl || '',
    coverUrl: salon.coverUrl || '',
    photos: salon.photos || [],
    payoutCycle: salon.payoutCycle || 'weekly',
    upiId: salon.upiId || '',
    bankAccountHolder: salon.bankAccountHolder || '',
    bankName: salon.bankName || '',
    accountNumber: salon.accountNumber || '',
    ifscCode: salon.ifscCode || '',
    payoutAgreementAccepted: salon.payoutAgreementAccepted !== false,
  };
}

function hasChanges(orig: EditForm, curr: EditForm): boolean {
  return JSON.stringify(orig) !== JSON.stringify(curr);
}

// ─── Simple image preview card ───
const ImageCard: React.FC<{
  url: string;
  label?: string;
  onRemove?: () => void;
}> = ({ url, label, onRemove }) => (
  <div className="relative group rounded-2xl overflow-hidden border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] aspect-video">
    {url ? (
      <img
        src={url}
        alt={label || 'Business image'}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-[rgba(10,10,10,0.70)]">
        <ImageIcon className="w-8 h-8" />
      </div>
    )}
    {label && (
      <span className="absolute bottom-1.5 left-1.5 text-[11px] font-black uppercase tracking-wider bg-[#FFFFFF] text-[#0A0A0A] px-1.5 py-0.5 rounded-md">
        {label}
      </span>
    )}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// ─── Field row for VIEW mode ───
const ViewField: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | undefined | null;
  mono?: boolean;
}> = ({ icon, label, value, mono }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[rgba(10,10,10,0.12)] last:border-0">
      <div className="w-8 h-8 rounded-xl bg-[#FFFFFF] border border-[rgba(10,10,10,0.12)] flex items-center justify-center text-[rgba(10,10,10,0.70)] shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)]">{label}</p>
        <p className={`text-sm font-semibold text-[#0A0A0A] mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
};

export const OwnerBusinessProfileEditor: React.FC<OwnerBusinessProfileEditorProps> = ({
  salon,
  onUpdateSalon,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(buildForm(salon));
  const [originalForm, setOriginalForm] = useState<EditForm>(buildForm(salon));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof EditForm, string>>>({});

  // New photo input
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleFileUpload = async (file: File, field: 'logoUrl' | 'coverUrl' | 'photo') => {
    try {
      setUploadingField(field);
      setSaveError('');
      const res = await api.uploadImage(file, `salons/${salon.id}`);
      if (res.success && res.url) {
        if (field === 'logoUrl') setField('logoUrl', res.url);
        else if (field === 'coverUrl') setField('coverUrl', res.url);
        else if (field === 'photo') setField('photos', [...form.photos, res.url]);
      } else {
        setSaveError(res.error || 'Failed to upload image.');
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to upload image.');
    } finally {
      setUploadingField(null);
    }
  };

  // Unsaved changes protection
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Sync form when salon prop changes externally
  useEffect(() => {
    const fresh = buildForm(salon);
    setForm(fresh);
    setOriginalForm(fresh);
  }, [salon.id]);

  const dirty = isEditing && hasChanges(originalForm, form);

  // ─── Validate ───
  const validate = (): boolean => {
    const errors: Partial<Record<keyof EditForm, string>> = {};
    if (!form.name.trim()) errors.name = 'Business name is required.';
    if (!form.phone.trim()) errors.phone = 'Phone number is required.';
    if (!form.address.trim()) errors.address = 'Address is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (form.website && !/^https?:\/\/.+/.test(form.website)) {
      errors.website = 'Website must start with http:// or https://';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Enter edit mode ───
  const enterEdit = () => {
    const fresh = buildForm(salon);
    setForm(fresh);
    setOriginalForm(fresh);
    setValidationErrors({});
    setSaveError('');
    setSaveSuccess(false);
    setIsEditing(true);
  };

  // ─── Cancel edit ───
  const handleCancel = () => {
    if (dirty) {
      setShowDiscardConfirm(true);
    } else {
      setIsEditing(false);
    }
  };

  const confirmDiscard = () => {
    setForm(originalForm);
    setIsEditing(false);
    setShowDiscardConfirm(false);
    setValidationErrors({});
    setSaveError('');
  };

  // ─── Save changes ───
  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setSaveError('');

    try {
      const payload: Partial<Salon> = {
        name: form.name.trim(),
        category: form.category,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim(),
        lat: form.lat,
        lng: form.lng,
        description: form.description.trim(),
        logoUrl: form.logoUrl.trim() || undefined,
        coverUrl: form.coverUrl.trim() || undefined,
        photos: form.photos.filter((p) => p.trim()),
        payoutCycle: form.payoutCycle,
        upiId: form.upiId.trim() || undefined,
        bankAccountHolder: form.bankAccountHolder.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        ifscCode: form.ifscCode.trim().toUpperCase() || undefined,
        payoutAgreementAccepted: form.payoutAgreementAccepted,
        payoutAgreementAcceptedAt: salon.payoutAgreementAcceptedAt || new Date().toISOString(),
      };

      const res = await api.updateSalon(salon.id, payload);
      if (res && res.salon) {
        onUpdateSalon(res.salon);
        const updated = buildForm(res.salon);
        setForm(updated);
        setOriginalForm(updated);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError((res as any)?.error || 'Failed to save. Please try again.');
      }
    } catch (e: any) {
      setSaveError(e?.message || 'Network error. Please check your connection and retry.');
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (validationErrors[key]) {
      setValidationErrors((e) => ({ ...e, [key]: undefined }));
    }
  };

  const addPhoto = () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    if (form.photos.includes(url)) return;
    setField('photos', [...form.photos, url]);
    setNewPhotoUrl('');
  };

  const removePhoto = (idx: number) => {
    setField('photos', form.photos.filter((_, i) => i !== idx));
  };

  const isTurf = isTurfBusiness(salon.category, salon.bookingMode);

  // ─── INPUT STYLES ───
  const inputCls = (err?: string) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#E73229] transition-colors ${
      err ? 'border-[#E73229] bg-[rgba(231,50,41,0.08)]' : 'border-[rgba(10,10,10,0.12)] bg-[#FFFFFF]'
    }`;

  const labelCls = 'block text-[11px] font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── SUCCESS BANNER ── */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] rounded-2xl text-[#C9281F] animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-[#C9281F] shrink-0" />
          <div>
            <p className="text-xs font-black">Business details updated successfully.</p>
            <p className="text-[11px] text-[#C9281F] mt-0.5">
              Changes are now live and visible to all customers.
            </p>
          </div>
        </div>
      )}

      {/* ── HEADER CARD ── */}
      <div className="bg-[#FFFFFF] dark:bg-[#17171C] rounded-3xl border border-[rgba(10,10,10,0.12)] dark:border-white/10 shadow-xs overflow-hidden">
        {/* Cover photo banner */}
        <div
          className="h-36 sm:h-44 w-full bg-gradient-to-br from-neutral-800 to-neutral-900 relative overflow-hidden"
          style={
            (isEditing ? form.coverUrl : salon.coverUrl)
              ? { backgroundImage: `url(${isEditing ? form.coverUrl : salon.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {}
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-3 left-4 text-white/90 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 drop-shadow">
            <ImageIcon className="w-3.5 h-3.5" />
            Cover Photo
          </div>
        </div>

        {/* Business Info */}
        <div className="px-5 sm:px-6 pb-5 -mt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center sm:items-end gap-3.5 sm:gap-4 min-w-0 flex-1">
            {/* Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 border-white dark:border-zinc-800 shadow-md bg-[linear-gradient(135deg,#F0554A_0%,#E73229_100%)] flex items-center justify-center text-white text-2xl font-black shrink-0 overflow-hidden">
              {(isEditing ? form.logoUrl : salon.logoUrl) ? (
                <img
                  src={isEditing ? form.logoUrl : salon.logoUrl}
                  alt={salon.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (() => {
                  const parts = (salon.name || 'KS').trim().split(/\s+/);
                  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : salon.name.substring(0, 2)).toUpperCase();
                })()
              )}
            </div>

            {/* Name & Category */}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#0A0A0A] dark:text-[#FFFFFF] truncate">
                {isEditing ? form.name || 'Your Business' : salon.name}
              </h2>
              <p className="text-xs text-[rgba(10,10,10,0.70)] dark:text-[#A1A1AA] font-semibold mt-0.5">
                {isEditing ? form.category || salon.category : salon.category}
              </p>
            </div>
          </div>

          {/* Edit / Action Buttons */}
          {!isEditing ? (
            <button
              id="btn-edit-business-details"
              onClick={enterEdit}
              className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] font-black text-xs shadow-sm hover:opacity-90 transition-opacity cursor-pointer min-h-[40px]"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Details
            </button>
          ) : (
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-[rgba(10,10,10,0.70)] font-bold text-xs hover:bg-[rgba(10,10,10,0.05)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E73229] hover:bg-[#D42B22] disabled:opacity-60 text-[#FFFFFF] font-black text-xs shadow-sm transition-colors duration-150 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── VIEW MODE ── */}
      {!isEditing && (
        <div className="space-y-4">
          {/* Contact & Identity */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-3 pb-2 border-b border-[rgba(10,10,10,0.12)]">
              Contact & Identity
            </h3>
            <ViewField icon={<Building2 className="w-4 h-4" />} label="Business Name" value={salon.name} />
            <ViewField icon={<Tag className="w-4 h-4" />} label="Category" value={salon.category} />
            <ViewField icon={<Phone className="w-4 h-4" />} label="Phone Number" value={salon.phone} mono />
            <ViewField icon={<Mail className="w-4 h-4" />} label="Email Address" value={salon.email} mono />
            <ViewField icon={<Globe className="w-4 h-4" />} label="Website" value={salon.website} mono />
            <ViewField icon={<Instagram className="w-4 h-4" />} label="Instagram" value={salon.instagram} />
          </div>

          {/* Location */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-3 pb-2 border-b border-[rgba(10,10,10,0.12)]">
              Location
            </h3>
            <ViewField icon={<MapPin className="w-4 h-4" />} label="Full Address" value={salon.address} />
            <ViewField icon={<MapPin className="w-4 h-4" />} label="City" value={salon.city} />
            {salon.lat !== 0 && salon.lng !== 0 && (
              <ViewField
                icon={<MapPin className="w-4 h-4" />}
                label="Coordinates (GPS)"
                value={`${salon.lat.toFixed(6)}, ${salon.lng.toFixed(6)}`}
                mono
              />
            )}
          </div>

          {/* About */}
          {salon.description && (
            <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-3 pb-2 border-b border-[rgba(10,10,10,0.12)]">
                About
              </h3>
              <p className="text-sm text-[rgba(10,10,10,0.70)] leading-relaxed font-medium">{salon.description}</p>
            </div>
          )}

          {/* Business Images */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] pb-2 border-b border-[rgba(10,10,10,0.12)]">
              Business Images
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ImageCard url={salon.logoUrl} label="Logo" />
              <ImageCard url={salon.coverUrl} label="Cover" />
            </div>

            {salon.photos && salon.photos.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-2">
                  Photo Gallery ({salon.photos.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {salon.photos.map((p, i) => (
                    <ImageCard key={i} url={p} label={`Photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}

            {(!salon.photos || salon.photos.length === 0) && !salon.logoUrl && !salon.coverUrl && (
              <div className="py-8 text-center text-[rgba(10,10,10,0.70)] space-y-1">
                <Camera className="w-8 h-8 mx-auto stroke-1 text-[rgba(10,10,10,0.70)]" />
                <p className="text-xs font-bold text-[rgba(10,10,10,0.70)]">No images added yet.</p>
                <p className="text-[11px] text-[rgba(10,10,10,0.70)]">Click "Edit Details" to add your business photos.</p>
              </div>
            )}
          </div>

          {/* Payout & Settlement Settings */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(10,10,10,0.12)]">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#E73229]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)]">
                  Payout &amp; Settlement Settings
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                {salon.payoutCycle === 'monthly' ? 'Monthly Payout' : 'Weekly Payout'}
              </span>
            </div>

            <ViewField
              icon={<Clock className="w-4 h-4" />}
              label="Agreed Settlement Cycle"
              value={salon.payoutCycle === 'monthly' ? 'Monthly (1st of every month)' : 'Weekly (Every Monday for previous Mon–Sun)'}
            />
            {salon.upiId && (
              <ViewField
                icon={<Wallet className="w-4 h-4" />}
                label="Registered UPI ID"
                value={salon.upiId}
                mono
              />
            )}
            {salon.accountNumber && (
              <ViewField
                icon={<Building2 className="w-4 h-4" />}
                label="Bank Account"
                value={`${salon.bankName || 'Bank'} • A/C: ${salon.accountNumber} (IFSC: ${salon.ifscCode || '—'}) • Holder: ${salon.bankAccountHolder || '—'}`}
                mono
              />
            )}

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold text-[#0A0A0A] dark:text-white block mb-0.5">
                  QGo Partner Terms Accepted
                </span>
                100% of collected slot bookings are disbursed on your {salon.payoutCycle === 'monthly' ? 'Monthly' : 'Weekly'} cycle. QGo retains only the ₹35.40 platform convenience fee (₹30 + 18% GST) paid by customers.
              </div>
            </div>
          </div>

          {/* Business Code */}
          <div className="bg-[#FFFFFF] rounded-2xl border border-[rgba(10,10,10,0.12)] p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[rgba(10,10,10,0.70)]">Internal Business Code</p>
              <p className="text-sm font-mono font-bold text-[rgba(10,10,10,0.70)] mt-0.5">{salon.joinCode || '—'}</p>
            </div>
            <Info className="w-4 h-4 text-[rgba(10,10,10,0.70)]" />
          </div>
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {isEditing && (
        <div className="space-y-5">
          {/* Save Error Banner */}
          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] rounded-2xl text-[#C9281F]">
              <AlertTriangle className="w-4 h-4 text-[#C9281F] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black">Save failed</p>
                <p className="text-[11px] text-[#C9281F] mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          {/* Dirty indicator */}
          {dirty && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)] rounded-xl text-[#C9281F] text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-[#C9281F]" />
              You have unsaved changes
            </div>
          )}

          {/* ── SECTION: BASIC INFO ── */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black text-[#0A0A0A] pb-3 border-b border-[rgba(10,10,10,0.12)]">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Business Name */}
              <div>
                <label className={labelCls}>Business Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. KSR Sports Arena"
                  className={inputCls(validationErrors.name)}
                />
                {validationErrors.name && (
                  <p className="text-[#C9281F] text-[11px] font-bold mt-1">{validationErrors.name}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="10-digit business phone"
                  className={inputCls(validationErrors.phone)}
                />
                {validationErrors.phone && (
                  <p className="text-[#C9281F] text-[11px] font-bold mt-1">{validationErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <BusinessCategoryInput
                value={form.category}
                onChange={(v) => setField('category', v)}
                label="Business Category"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="contact@yourbusiness.com"
                  className={inputCls(validationErrors.email)}
                />
                {validationErrors.email && (
                  <p className="text-[#C9281F] text-[11px] font-bold mt-1">{validationErrors.email}</p>
                )}
              </div>

              {/* Instagram */}
              <div>
                <label className={labelCls}>Instagram Handle</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(10,10,10,0.70)] text-xs font-bold">@</span>
                  <input
                    type="text"
                    value={form.instagram?.replace(/^@/, '')}
                    onChange={(e) => setField('instagram', e.target.value)}
                    placeholder="yourbusiness"
                    className={`${inputCls()} pl-7`}
                  />
                </div>
              </div>
            </div>

            {/* Website */}
            <div>
              <label className={labelCls}>Website URL</label>
              <div className="relative">
                <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(10,10,10,0.70)]" />
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className={`${inputCls(validationErrors.website)} pl-9`}
                />
              </div>
              {validationErrors.website && (
                <p className="text-[#C9281F] text-[11px] font-bold mt-1">{validationErrors.website}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>About / Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Describe your business, facilities, amenities, and what makes you special..."
                className={`${inputCls()} resize-none leading-relaxed`}
              />
              <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-1 text-right">{form.description.length} / 500 chars</p>
            </div>
          </div>

          {/* ── SECTION: LOCATION ── */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black text-[#0A0A0A] pb-3 border-b border-[rgba(10,10,10,0.12)]">
              Location & Address
            </h3>

            <div>
              <label className={labelCls}>Full Address *</label>
              <AddressLocationInput
                value={form.address}
                onChange={(address, lat, lng, city) => {
                  setField('address', address);
                  if (lat !== undefined) setField('lat', lat);
                  if (lng !== undefined) setField('lng', lng);
                  if (city) setField('city', city);
                }}
                required
                placeholder="Search your business address..."
              />
              {validationErrors.address && (
                <p className="text-[#C9281F] text-[11px] font-bold mt-1">{validationErrors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* City */}
              <div>
                <label className={labelCls}>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="e.g. Chennai"
                  className={inputCls()}
                />
              </div>

              {/* GPS Coordinates Preview */}
              {form.lat !== 0 && form.lng !== 0 && (
                <div>
                  <label className={labelCls}>GPS Coordinates (auto-filled)</label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] bg-[rgba(231,50,41,0.08)] text-xs font-mono text-[#C9281F]">
                    <MapPin className="w-3.5 h-3.5 text-[#C9281F]" />
                    {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION: IMAGES ── */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-[rgba(10,10,10,0.12)]">
              <h3 className="text-sm font-black text-[#0A0A0A]">Business Images</h3>
              <p className="text-[11px] text-[rgba(10,10,10,0.70)] mt-0.5">
                Use image URLs (from your CDN, Google Drive, or any public link). Changes are previewed instantly.
              </p>
            </div>

            {/* Logo & Cover */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-2">
                <label className={labelCls}>Logo Image</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => setField('logoUrl', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className={`${inputCls()} flex-1`}
                  />
                  <label className="cursor-pointer px-3 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-xs font-bold text-[#C9281F] hover:bg-[rgba(231,50,41,0.06)] flex items-center justify-center shrink-0">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingField === 'logoUrl'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'logoUrl');
                      }}
                      className="hidden"
                    />
                    {uploadingField === 'logoUrl' ? 'Uploading...' : 'Upload'}
                  </label>
                </div>
                {form.logoUrl && (
                  <div className="relative">
                    <ImageCard url={form.logoUrl} label="Logo Preview" />
                    <button
                      type="button"
                      onClick={() => setField('logoUrl', '')}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Cover */}
              <div className="space-y-2">
                <label className={labelCls}>Cover / Banner Image</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={form.coverUrl}
                    onChange={(e) => setField('coverUrl', e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    className={`${inputCls()} flex-1`}
                  />
                  <label className="cursor-pointer px-3 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-xs font-bold text-[#C9281F] hover:bg-[rgba(231,50,41,0.06)] flex items-center justify-center shrink-0">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingField === 'coverUrl'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, 'coverUrl');
                      }}
                      className="hidden"
                    />
                    {uploadingField === 'coverUrl' ? 'Uploading...' : 'Upload'}
                  </label>
                </div>
                {form.coverUrl && (
                  <div className="relative">
                    <ImageCard url={form.coverUrl} label="Cover Preview" />
                    <button
                      type="button"
                      onClick={() => setField('coverUrl', '')}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Gallery */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Photo Gallery ({form.photos.length} photos)</label>
              </div>

              {/* Add new photo */}
              <div className="flex gap-2 mb-3">
                <input
                  type="url"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="Paste image URL to add to gallery..."
                  className={`${inputCls()} flex-1`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhoto();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addPhoto}
                  disabled={!newPhotoUrl.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-bold text-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add URL
                </button>
                <label className="cursor-pointer px-3.5 py-2 rounded-xl border border-[rgba(10,10,10,0.12)] text-xs font-bold text-[#C9281F] hover:bg-[rgba(231,50,41,0.06)] flex items-center justify-center shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingField === 'photo'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'photo');
                    }}
                    className="hidden"
                  />
                  {uploadingField === 'photo' ? 'Uploading...' : 'Upload File'}
                </label>
              </div>

              {/* Gallery grid */}
              {form.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {form.photos.map((url, i) => (
                    <ImageCard
                      key={i}
                      url={url}
                      label={`Photo ${i + 1}`}
                      onRemove={() => removePhoto(i)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center border-2 border-dashed border-[rgba(10,10,10,0.12)] rounded-2xl text-[rgba(10,10,10,0.70)]">
                  <Camera className="w-6 h-6 mx-auto mb-1 stroke-1" />
                  <p className="text-xs font-bold">No gallery photos yet.</p>
                  <p className="text-[11px]">Paste image URLs above to build your gallery.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION: PAYOUT & SETTLEMENT AGREEMENT ── */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[rgba(10,10,10,0.12)]">
              <Wallet className="w-4 h-4 text-[#E73229]" />
              <h3 className="text-sm font-black text-[#0A0A0A]">
                Payout &amp; Settlement Settings
              </h3>
            </div>

            {/* Settlement Cycle Choice */}
            <div className="space-y-2">
              <label className={labelCls}>Settlement Cycle *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setField('payoutCycle', 'weekly')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    form.payoutCycle === 'weekly'
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
                    {form.payoutCycle === 'weekly' && <CheckCircle2 size={16} className="text-[#E73229]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-snug">
                    Settled every Monday for bookings completed during the previous Mon–Sun cycle.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setField('payoutCycle', 'monthly')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    form.payoutCycle === 'monthly'
                      ? 'border-[#E73229] bg-[#E73229]/5 dark:bg-[#E73229]/10 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-[#0A0A0A] dark:text-white">
                      Monthly Settlement
                    </span>
                    {form.payoutCycle === 'monthly' && <CheckCircle2 size={16} className="text-[#E73229]" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-snug">
                    Settled on the 1st of every month for all bookings in the previous calendar month.
                  </p>
                </button>
              </div>
            </div>

            {/* UPI & Bank Account */}
            <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850/50 border border-gray-200 dark:border-zinc-800">
              <div>
                <label className={labelCls}>UPI ID (Instant Payouts)</label>
                <input
                  type="text"
                  value={form.upiId}
                  onChange={(e) => setField('upiId', e.target.value)}
                  placeholder="e.g. business@okaxis"
                  className={inputCls()}
                />
              </div>

              <div className="pt-2 border-t border-gray-200/80 dark:border-zinc-700/80 space-y-3">
                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-zinc-500 block">
                  Bank Account Transfer (IMPS / NEFT)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Account Holder Name</label>
                    <input
                      type="text"
                      value={form.bankAccountHolder}
                      onChange={(e) => setField('bankAccountHolder', e.target.value)}
                      placeholder="Account holder name"
                      className={inputCls()}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Bank Name</label>
                    <input
                      type="text"
                      value={form.bankName}
                      onChange={(e) => setField('bankName', e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className={inputCls()}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Account Number</label>
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={(e) => setField('accountNumber', e.target.value)}
                      placeholder="Bank account number"
                      className={inputCls()}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>IFSC Code</label>
                    <input
                      type="text"
                      value={form.ifscCode}
                      onChange={(e) => setField('ifscCode', e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className={inputCls()}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Agreement Terms */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-zinc-900 dark:text-zinc-100 space-y-2">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <span className="font-extrabold text-zinc-950 dark:text-white block mb-0.5">
                    QGo Partner Settlement Terms
                  </span>
                  Customers pay the online advance plus QGo's ₹30 convenience fee and 18% GST (₹35.40 per booking). QGo retains the ₹35.40 platform fee + GST and transfers 100% of your collected booking amount to your registered UPI/Bank account on your chosen Weekly or Monthly cycle.
                </div>
              </div>
              <label className="flex items-center gap-2.5 pt-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.payoutAgreementAccepted}
                  onChange={(e) => setField('payoutAgreementAccepted', e.target.checked)}
                  className="w-4 h-4 rounded text-[#E73229] border-gray-300 dark:border-zinc-700 focus:ring-[#E73229]"
                />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  I agree to the QGo Weekly/Monthly Payout Terms
                </span>
              </label>
            </div>
          </div>

          {/* ── SAVE & CANCEL FOOTER ── */}
          <div className="bg-[#FFFFFF] rounded-3xl border border-[rgba(10,10,10,0.12)] shadow-xs p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="text-xs text-[rgba(10,10,10,0.70)]">
              {dirty ? (
                <span className="text-[#C9281F] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unsaved changes
                </span>
              ) : (
                <span className="text-[rgba(10,10,10,0.70)]">No changes made yet</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[rgba(10,10,10,0.70)] font-bold text-xs hover:bg-[rgba(10,10,10,0.05)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#E73229] hover:bg-[#E73229] disabled:opacity-50 text-[#FFFFFF] font-black text-xs shadow-sm transition-colors duration-150"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DISCARD CONFIRMATION MODAL ── */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#FFFFFF]">
          <div className="bg-[#FFFFFF] rounded-3xl shadow-lg border border-[rgba(10,10,10,0.12)] p-6 max-w-sm w-full animate-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[rgba(231,50,41,0.08)] text-[#C9281F] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-[#0A0A0A]">Discard Changes?</h3>
                <p className="text-xs text-[rgba(10,10,10,0.70)] mt-1">
                  You have unsaved changes. If you cancel now, your edits will be lost.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[rgba(10,10,10,0.12)] text-[rgba(10,10,10,0.70)] font-bold text-xs hover:bg-[rgba(10,10,10,0.05)]"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="flex-1 py-3 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] font-black text-xs hover:bg-[#E73229]"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
