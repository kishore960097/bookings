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
  <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
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
      <div className="w-full h-full flex items-center justify-center text-slate-300">
        <ImageIcon className="w-8 h-8" />
      </div>
    )}
    {label && (
      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-900/70 text-white px-1.5 py-0.5 rounded-md backdrop-blur-sm">
        {label}
      </span>
    )}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm"
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
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-sm font-semibold text-slate-900 mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>
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
    `w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors ${
      err ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
    }`;

  const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5';

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── SUCCESS BANNER ── */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-black">Business details updated successfully.</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Changes are now live and visible to all customers.
            </p>
          </div>
        </div>
      )}

      {/* ── HEADER CARD ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Cover photo banner */}
        <div
          className="h-32 sm:h-40 w-full bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden"
          style={
            (isEditing ? form.coverUrl : salon.coverUrl)
              ? { backgroundImage: `url(${isEditing ? form.coverUrl : salon.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {}
          }
        >
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="absolute bottom-3 left-4 text-white/60 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            Cover Photo
          </div>
        </div>

        {/* Business Info */}
        <div className="px-5 sm:px-6 pb-5 -mt-8 flex items-start gap-4">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-md bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-2xl font-black shrink-0 overflow-hidden">
            {(isEditing ? form.logoUrl : salon.logoUrl) ? (
              <img
                src={isEditing ? form.logoUrl : salon.logoUrl}
                alt={salon.name}
                className="w-full h-full object-cover"
              />
            ) : (
              salon.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Name & Category */}
          <div className="pt-8 min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-900 truncate">
              {isEditing ? form.name || 'Your Business' : salon.name}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              {isEditing ? form.category || salon.category : salon.category}
            </p>
          </div>

          {/* Edit / Action Buttons */}
          {!isEditing ? (
            <button
              id="btn-edit-business-details"
              onClick={enterEdit}
              className="mt-8 shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Details
            </button>
          ) : (
            <div className="mt-8 shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs shadow-sm transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
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
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
                About
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{salon.description}</p>
            </div>
          )}

          {/* Business Images */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              Business Images
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ImageCard url={salon.logoUrl} label="Logo" />
              <ImageCard url={salon.coverUrl} label="Cover" />
            </div>

            {salon.photos && salon.photos.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
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
              <div className="py-8 text-center text-slate-400 space-y-1">
                <Camera className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">No images added yet.</p>
                <p className="text-[11px] text-slate-400">Click "Edit Details" to add your business photos.</p>
              </div>
            )}
          </div>

          {/* Business Code */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Internal Business Code</p>
              <p className="text-sm font-mono font-bold text-slate-700 mt-0.5">{salon.joinCode || '—'}</p>
            </div>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {isEditing && (
        <div className="space-y-5">
          {/* Save Error Banner */}
          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-black">Save failed</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          {/* Dirty indicator */}
          {dirty && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              You have unsaved changes
            </div>
          )}

          {/* ── SECTION: BASIC INFO ── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-3 border-b border-slate-100">
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
                  <p className="text-rose-600 text-[11px] font-bold mt-1">{validationErrors.name}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className={inputCls(validationErrors.phone)}
                />
                {validationErrors.phone && (
                  <p className="text-rose-600 text-[11px] font-bold mt-1">{validationErrors.phone}</p>
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
                  <p className="text-rose-600 text-[11px] font-bold mt-1">{validationErrors.email}</p>
                )}
              </div>

              {/* Instagram */}
              <div>
                <label className={labelCls}>Instagram Handle</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">@</span>
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
                <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className={`${inputCls(validationErrors.website)} pl-9`}
                />
              </div>
              {validationErrors.website && (
                <p className="text-rose-600 text-[11px] font-bold mt-1">{validationErrors.website}</p>
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
              <p className="text-[10px] text-slate-400 mt-1 text-right">{form.description.length} / 500 chars</p>
            </div>
          </div>

          {/* ── SECTION: LOCATION ── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-900 pb-3 border-b border-slate-100">
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
                <p className="text-rose-600 text-[11px] font-bold mt-1">{validationErrors.address}</p>
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
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-xs font-mono text-emerald-800">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION: IMAGES ── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Business Images</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Use image URLs (from your CDN, Google Drive, or any public link). Changes are previewed instantly.
              </p>
            </div>

            {/* Logo & Cover */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-2">
                <label className={labelCls}>Logo Image URL</label>
                <input
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setField('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className={inputCls()}
                />
                {form.logoUrl && (
                  <div className="relative">
                    <ImageCard url={form.logoUrl} label="Logo Preview" />
                    <button
                      type="button"
                      onClick={() => setField('logoUrl', '')}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Cover */}
              <div className="space-y-2">
                <label className={labelCls}>Cover / Banner Image URL</label>
                <input
                  type="url"
                  value={form.coverUrl}
                  onChange={(e) => setField('coverUrl', e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className={inputCls()}
                />
                {form.coverUrl && (
                  <div className="relative">
                    <ImageCard url={form.coverUrl} label="Cover Preview" />
                    <button
                      type="button"
                      onClick={() => setField('coverUrl', '')}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center"
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
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
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
                <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                  <Camera className="w-6 h-6 mx-auto mb-1 stroke-1" />
                  <p className="text-xs font-bold">No gallery photos yet.</p>
                  <p className="text-[11px]">Paste image URLs above to build your gallery.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── SAVE & CANCEL FOOTER ── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {dirty ? (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unsaved changes
                </span>
              ) : (
                <span className="text-slate-400">No changes made yet</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-sm transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full animate-in zoom-in-95 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Discard Changes?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  You have unsaved changes. If you cancel now, your edits will be lost.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700"
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
