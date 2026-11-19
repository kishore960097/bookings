import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Check, CheckCircle2, Camera } from 'lucide-react';
import { haptics } from '../../../../utils/haptics';
import { api } from '../../../../services/api';

export interface AccountSubViewProps {
  user: any;
  setUser: (u: any) => void;
  onBack: () => void;
}

export function AccountSubView({ 
  user, 
  setUser, 
  onBack 
}: AccountSubViewProps) {
  const [name, setName] = useState(user?.name || user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || user?.phoneNumber || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setPhotoUrl(dataUrl);
        const updated = { ...user, photoUrl: dataUrl };
        setUser(updated);
        try {
          localStorage.setItem('qgo_user', JSON.stringify(updated));
        } catch {}
        api.updateProfile({ photoUrl: dataUrl }).catch(() => {});
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    haptics.success();
    const updatedUser = {
      ...user,
      name,
      displayName: name,
      phone,
      phoneNumber: phone,
      photoUrl,
    };
    setUser(updatedUser);
    try {
      localStorage.setItem('qgo_user', JSON.stringify(updatedUser));
    } catch {}
    api.updateProfile({ name, phone, photoUrl }).catch(() => {});
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2400);
  };

  const initial = (name.trim().charAt(0) || 'K').toUpperCase();

  return (
    <motion.div
      key="subview-account"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col w-full px-4 pt-3 pb-8"
    >
      {/* iOS Style Navigation Header */}
      <div className="flex items-center justify-between mb-5 sticky top-0 bg-[#F5F5F7] dark:bg-[#000000] py-2 z-10 transition-colors">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-[#E73229] min-h-[44px] cursor-pointer"
        >
          <ChevronLeft size={20} strokeWidth={2.8} /> Back
        </motion.button>
        <h2 className="text-base font-bold text-[#111111] dark:text-[#FFFFFF] tracking-tight">
          Account
        </h2>
        <div className="w-12" />
      </div>

      {/* User Avatar Circle */}
      <div className="flex flex-col items-center justify-center my-4">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer"
          title="Click to change profile photo"
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name || 'Profile'}
              className="w-20 h-20 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] flex items-center justify-center text-4xl font-black text-[#FFFFFF] shadow-md">
              {initial}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
            <Camera size={22} />
          </div>
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#111111] dark:bg-[#FFFFFF] text-white dark:text-[#111111] flex items-center justify-center shadow-xs">
            <Check size={12} strokeWidth={3} />
          </div>
        </button>
        <p className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] mt-2">
          Customer Profile
        </p>
      </div>

      {/* Account Edit Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-4 mt-2">
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-4 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex flex-col gap-4">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8E8E93] mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-3 text-sm font-semibold text-[#111111] dark:text-[#FFFFFF] focus:outline-none focus:border-[#E73229] transition-colors"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8E8E93] mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.12)] rounded-xl px-3.5 py-3 text-sm font-semibold text-[#111111] dark:text-[#FFFFFF] focus:outline-none focus:border-[#E73229] transition-colors"
            />
          </div>

          {/* Email Address (Read-only) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#8E8E93]">
                Email Address
              </label>
              <span className="text-[10px] font-bold text-[#16845B] dark:text-[#4ADE80] bg-[#E7F5EE] dark:bg-[rgba(22,132,91,0.2)] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check size={10} strokeWidth={3} /> Verified
              </span>
            </div>
            <input
              type="email"
              value={user?.email || 'customer@gmail.com'}
              disabled
              className="w-full bg-[#EFEFEF] dark:bg-[#252528] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-xl px-3.5 py-3 text-sm font-medium text-[#767676] dark:text-[#8E8E93] cursor-not-allowed"
            />
          </div>
        </div>

        {/* Member Status Card */}
        <div className="bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-2xl p-4 border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#111111] dark:text-[#FFFFFF]">Membership Tier</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#8E8E93]">Exclusive turf booking privileges</p>
          </div>
          <span className="text-[11px] font-bold text-[#B3231B] dark:text-[#F39887] bg-[#FDECEA] dark:bg-[rgba(231,50,41,0.14)] px-3 py-1 rounded-full uppercase tracking-wider">
            Premium
          </span>
        </div>

        {isSaved && (
          <div className="p-3 bg-[#E7F5EE] dark:bg-[rgba(22,132,91,0.2)] border border-[#16845B]/30 rounded-xl text-center text-xs font-bold text-[#16845B] dark:text-[#4ADE80] flex items-center justify-center gap-1.5 animate-in fade-in">
            <CheckCircle2 size={16} /> Profile changes saved successfully!
          </div>
        )}

        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          className="w-full bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-white font-bold py-3.5 rounded-2xl shadow-md min-h-[48px] cursor-pointer mt-2"
        >
          Save Changes
        </motion.button>
      </form>
    </motion.div>
  );
}
