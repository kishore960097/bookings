import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Shield, HelpCircle, ChevronRight, FileText, Settings } from 'lucide-react';

interface OwnerProfileViewProps {
  onOpenSettings: () => void;
}

export const OwnerProfileView: React.FC<OwnerProfileViewProps> = ({ onOpenSettings }) => {
  const { user, logout } = useAuth();

  const getInitial = (name?: string) => name ? name.charAt(0).toUpperCase() : 'O';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Profile Header */}
      <div className="bg-[#FFFFFF] rounded-[24px] p-6 border border-[rgba(23,23,23,0.12)] shadow-sm flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#FFFFFF] text-[#171717] flex items-center justify-center text-2xl font-black mb-4 shadow-lg">
          {getInitial(user?.name)}
        </div>
        <h2 className="text-xl font-black text-[#171717]">{user?.name || 'Business Owner'}</h2>
        <p className="text-sm font-semibold text-[rgba(23,23,23,0.70)] mt-1">{user?.email || 'owner@example.com'}</p>
        <div className="mt-3 px-3 py-1 bg-[rgba(255,159,28,0.15)] text-[#FF9F1C] text-[11px] font-black uppercase tracking-widest rounded-full">
          Owner Account
        </div>
      </div>

      {/* Menu Options */}
      <div className="bg-[#FFFFFF] rounded-[24px] border border-[rgba(23,23,23,0.12)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[rgba(23,23,23,0.12)] text-xs font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)]">
          Account Settings
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: User, label: 'Personal Information', desc: 'Update your name and phone number' },
            { icon: Shield, label: 'Security', desc: 'Password and 2FA settings' },
            { icon: Settings, label: 'Business Settings', desc: 'Manage your business details, working hours, and services', action: onOpenSettings },
          ].map((item, idx) => (
            <button key={idx} onClick={item.action} className="w-full flex items-center p-4 hover:bg-[rgba(23,23,23,0.05)] transition-colors text-left group">
              <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] flex items-center justify-center mr-4 group-hover:bg-[rgba(23,23,23,0.05)] group-hover:shadow-sm transition-colors duration-150">
                <item.icon size={18} className="text-[rgba(23,23,23,0.70)]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#171717]">{item.label}</div>
                <div className="text-xs font-medium text-[rgba(23,23,23,0.70)]">{item.desc}</div>
              </div>
              <ChevronRight size={16} className="text-[rgba(23,23,23,0.70)] group-hover:text-[#FF9F1C] transition-colors" />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#FFFFFF] rounded-[24px] border border-[rgba(23,23,23,0.12)] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[rgba(23,23,23,0.12)] text-xs font-black uppercase tracking-wider text-[rgba(23,23,23,0.70)]">
          Support & About
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: HelpCircle, label: 'Help Center', desc: 'FAQs and support tickets' },
            { icon: FileText, label: 'Terms & Privacy', desc: 'Legal documents' },
          ].map((item, idx) => (
            <button key={idx} className="w-full flex items-center p-4 hover:bg-[rgba(23,23,23,0.05)] transition-colors text-left group">
              <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] flex items-center justify-center mr-4 group-hover:bg-[rgba(23,23,23,0.05)] group-hover:shadow-sm transition-colors duration-150">
                <item.icon size={18} className="text-[rgba(23,23,23,0.70)]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#171717]">{item.label}</div>
                <div className="text-xs font-medium text-[rgba(23,23,23,0.70)]">{item.desc}</div>
              </div>
              <ChevronRight size={16} className="text-[rgba(23,23,23,0.70)] group-hover:text-[#FF9F1C] transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-[24px] border-2 border-[rgba(23,23,23,0.12)] text-[#FF9F1C] hover:bg-[rgba(255,159,28,0.15)] font-bold text-sm transition-colors"
      >
        <LogOut size={16} />
        Log Out
      </button>
    </div>
  );
};

