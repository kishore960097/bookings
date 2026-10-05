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
      <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-black mb-4 shadow-lg">
          {getInitial(user?.name)}
        </div>
        <h2 className="text-xl font-black text-slate-900">{user?.name || 'Business Owner'}</h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">{user?.email || 'owner@example.com'}</p>
        <div className="mt-3 px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full">
          Owner Account
        </div>
      </div>

      {/* Menu Options */}
      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">
          Account Settings
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: User, label: 'Personal Information', desc: 'Update your name and phone number' },
            { icon: Shield, label: 'Security', desc: 'Password and 2FA settings' },
            { icon: Settings, label: 'Business Settings', desc: 'Manage your business details, working hours, and services', action: onOpenSettings },
          ].map((item, idx) => (
            <button key={idx} onClick={item.action} className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:bg-white group-hover:shadow-sm transition-all">
                <item.icon size={18} className="text-slate-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">{item.label}</div>
                <div className="text-xs font-medium text-slate-500">{item.desc}</div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">
          Support & About
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { icon: HelpCircle, label: 'Help Center', desc: 'FAQs and support tickets' },
            { icon: FileText, label: 'Terms & Privacy', desc: 'Legal documents' },
          ].map((item, idx) => (
            <button key={idx} className="w-full flex items-center p-4 hover:bg-slate-50 transition-colors text-left group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:bg-white group-hover:shadow-sm transition-all">
                <item.icon size={18} className="text-slate-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-900">{item.label}</div>
                <div className="text-xs font-medium text-slate-500">{item.desc}</div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-[24px] border-2 border-red-100 text-red-600 hover:bg-red-50 font-bold text-sm transition-colors"
      >
        <LogOut size={16} />
        Log Out
      </button>
    </div>
  );
};

