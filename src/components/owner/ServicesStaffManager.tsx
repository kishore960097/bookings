import React, { useState, useEffect } from 'react';
import { Salon, Service, Staff } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NumberInput } from '../common/NumberInput';
import {
  Scissors,
  Users,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Star,
  Clock} from 'lucide-react';

interface ServicesStaffManagerProps {
  salon: Salon;
}

export const ServicesStaffManager: React.FC<ServicesStaffManagerProps> = ({ salon }) => {
  const { t } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // New Service Form modal
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceNameTa, setNewServiceNameTa] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(250);
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [newServiceCategory, setNewServiceCategory] = useState('Hair');

  // New Staff Form modal
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffTitle, setNewStaffTitle] = useState('Senior Stylist');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  const loadData = async () => {
    try {
      const detail = await api.getSalonDetail(salon.id);
      if (detail) {
        setServices(detail.services);
        setStaffList(detail.staff);
      }
    } catch (e) {
      console.error('Error loading services & staff:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [salon.id]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createService(salon.id, {
        name: newServiceName,
        nameTa: newServiceNameTa || undefined,
        price: Number(newServicePrice),
        durationMinutes: Number(newServiceDuration),
        category: newServiceCategory,
      });
      setIsAddServiceOpen(false);
      setNewServiceName('');
      setNewServiceNameTa('');
      loadData();
    } catch (e) {
      console.error('Error creating service:', e);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createStaff(salon.id, {
        name: newStaffName,
        title: newStaffTitle,
        phone: newStaffPhone,
        status: 'available',
      });
      setIsAddStaffOpen(false);
      setNewStaffName('');
      loadData();
    } catch (e) {
      console.error('Error creating staff:', e);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await api.updateService(serviceId, { isActive: false });
      loadData();
    } catch (e) {
      console.error('Error deleting service:', e);
    }
  };

  const handleUpdateStaffStatus = async (staffId: string, status: any) => {
    try {
      await api.updateStaffStatus(staffId, status);
      loadData();
    } catch (e) {
      console.error('Error updating staff status:', e);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. SERVICES MANAGEMENT */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600" />
              <span>Services Menu ({services.length})</span>
            </h3>
            <p className="text-xs text-neutral-500">Configure catalog, pricing, and duration</p>
          </div>

          <button
            onClick={() => setIsAddServiceOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service</span>
          </button>
        </div>

        {services.length === 0 ? (
          <div className="py-8 text-center text-neutral-400 text-xs">
            No services added yet. Click <strong>+ Add Service</strong> above to define your salon offerings.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((srv) => (
              <div
                key={srv.id}
                className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-neutral-300 transition-all flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-neutral-900">{srv.name}</span>
                    {srv.nameTa && (
                      <span className="text-[10px] text-neutral-500 bg-neutral-200/60 px-1.5 py-0.2 rounded font-medium">
                        {srv.nameTa}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>{srv.durationMinutes} mins</span>
                    </span>
                    <span>•</span>
                    <span className="font-bold text-neutral-800">
                      {t.rupees}
                      {srv.price}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteService(srv.id)}
                    className="p-2 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. STAFF ROSTER & LIVE CHAIR STATUS */}
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Stylists & Staff ({staffList.length})</span>
            </h3>
            <p className="text-xs text-neutral-500">Live chair status and shift assignment</p>
          </div>

          <button
            onClick={() => setIsAddStaffOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stylist</span>
          </button>
        </div>

        {staffList.length === 0 ? (
          <div className="py-8 text-center text-neutral-400 text-xs">
            No staff members added yet. Click <strong>+ Add Stylist</strong> to add team members.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.map((st) => (
              <div
                key={st.id}
                className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 flex items-start justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {st.photoUrl ? (
                    <img
                      src={st.photoUrl}
                      alt={st.name}
                      className="w-12 h-12 rounded-xl object-cover bg-neutral-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      {st.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xs text-neutral-900">{st.name}</h4>
                      {st.rating > 0 && (
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>{st.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-500 block">{st.title}</span>
                    {st.phone && (
                      <span className="text-[10px] text-neutral-400 font-mono">{st.phone}</span>
                    )}
                  </div>
                </div>

                {/* Status Switcher Buttons */}
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Chair Status</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleUpdateStaffStatus(st.id, 'available')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        st.status === 'available'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Available
                    </button>
                    <button
                      onClick={() => handleUpdateStaffStatus(st.id, 'busy')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        st.status === 'busy'
                          ? 'bg-amber-500 text-neutral-950'
                          : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      In Chair
                    </button>
                    <button
                      onClick={() => handleUpdateStaffStatus(st.id, 'break')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        st.status === 'break'
                          ? 'bg-neutral-800 text-white'
                          : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      Break
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {isAddServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-950/60" onClick={() => setIsAddServiceOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl z-10 border border-neutral-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">Add New Service</h3>
            <form onSubmit={handleCreateService} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Service Name (English)</label>
                <input
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Skin Fade & Beard Trim"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Tamil Translation (Optional)</label>
                <input
                  type="text"
                  value={newServiceNameTa}
                  onChange={(e) => setNewServiceNameTa(e.target.value)}
                  placeholder="e.g. ஸ்கின் ஃபேட் & தாடி டிரிம்"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Price (₹)</label>
                  <NumberInput
                    required
                    min={0}
                    value={newServicePrice}
                    onChange={setNewServicePrice}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Duration (Mins)</label>
                  <NumberInput
                    required
                    min={1}
                    value={newServiceDuration}
                    onChange={setNewServiceDuration}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Category</label>
                <select
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none"
                >
                  <option value="Hair">Hair</option>
                  <option value="Beard">Beard</option>
                  <option value="Facial">Facial</option>
                  <option value="Combo">Combo Package</option>
                  <option value="Spa">Spa & Massage</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddServiceOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-950/60" onClick={() => setIsAddStaffOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl z-10 border border-neutral-200 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">Add Stylist / Barber</h3>
            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Vikram S"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newStaffTitle}
                  onChange={(e) => setNewStaffTitle(e.target.value)}
                  placeholder="e.g. Master Barber / Color Specialist"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                >
                  Add Stylist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
