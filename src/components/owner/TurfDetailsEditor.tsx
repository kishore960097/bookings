import React, { useState } from 'react';
import { TurfResource } from '../../types';
import { Plus, Trash2, Shield, Info, Check } from 'lucide-react';
import { NumberInput } from '../common/NumberInput';

interface TurfDetailsEditorProps {
  resources: TurfResource[];
  onChange: (resources: TurfResource[]) => void;
}

const TURF_TYPES = [
  '5-a-side Football',
  '7-a-side Football',
  'Box Cricket Pitch',
  'Multi-purpose Ground',
  'Badminton Court',
  'Tennis Court',
  'Volleyball Court',
  'Full Football Ground',
];

export const TurfDetailsEditor: React.FC<TurfDetailsEditorProps> = ({ resources, onChange }) => {
  const turfs =
    resources.length > 0
      ? resources
      : [
          {
            id: 'turf_1',
            salonId: '',
            name: 'Turf 1',
            type: '7-a-side Football',
            capacity: 14,
            pricePerHour: 800,
            description: 'Synthetic grass surface with floodlights and spectator seating.',
            isActive: true,
          },
        ];

  const updateTurf = (id: string, updates: Partial<TurfResource>) => {
    const updated = turfs.map((t) => (t.id === id ? { ...t, ...updates } : t));
    onChange(updated);
  };

  const addTurf = () => {
    const nextNum = turfs.length + 1;
    const newTurf: TurfResource = {
      id: `turf_${Date.now()}`,
      salonId: '',
      name: `Turf ${nextNum}`,
      type: '7-a-side Football',
      capacity: 14,
      pricePerHour: 800,
      description: '',
      isActive: true,
    };
    onChange([...turfs, newTurf]);
  };

  const removeTurf = (id: string) => {
    if (turfs.length <= 1) return;
    onChange(turfs.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold">
          🏟️
        </div>
        <div className="text-xs">
          <p className="font-bold text-emerald-950">Independent Turf Resources</p>
          <p className="text-emerald-800/90 mt-0.5 leading-relaxed">
            Each turf has its own independent availability. When a customer books <strong>Turf 1</strong> at 5:00 PM,
            <strong> Turf 2</strong> remains available for other players!
          </p>
        </div>
      </div>

      {/* Turf count summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Your Turfs / Grounds ({turfs.length})
          </h3>
          <p className="text-xs text-slate-500">Define each playable area or court at your venue</p>
        </div>

        <button
          type="button"
          onClick={addTurf}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Turf</span>
        </button>
      </div>

      {/* Turf list */}
      <div className="space-y-4">
        {turfs.map((turf, idx) => (
          <div
            key={turf.id}
            className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4 hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-sm font-black text-slate-900">{turf.name || `Turf ${idx + 1}`}</span>
              </div>

              {turfs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTurf(turf.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete Turf"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Turf / Court Name *
                </label>
                <input
                  type="text"
                  required
                  value={turf.name}
                  onChange={(e) => updateTurf(turf.id, { name: e.target.value })}
                  placeholder="e.g. Turf 1 (Main Pitch)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Sport / Pitch Type *
                </label>
                <select
                  value={turf.type}
                  onChange={(e) => updateTurf(turf.id, { type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                >
                  {TURF_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Player Capacity (Optional)
                </label>
                <NumberInput
                  min={1}
                  max={100}
                  value={turf.capacity || ''}
                  onChange={(val) => updateTurf(turf.id, { capacity: Number(val) || undefined })}
                  placeholder="e.g. 14 players"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Default Base Price (₹ / Hour)
                </label>
                <NumberInput
                  min={0}
                  step={50}
                  value={turf.pricePerHour || ''}
                  onChange={(val) => updateTurf(turf.id, { pricePerHour: Number(val) || undefined })}
                  placeholder="e.g. 800"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Description / Amenities (Optional)
              </label>
              <input
                type="text"
                value={turf.description || ''}
                onChange={(e) => updateTurf(turf.id, { description: e.target.value })}
                placeholder="e.g. FIFA-grade turf with floodlights, bibs, water & dressing room"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add more button */}
      <button
        type="button"
        onClick={addTurf}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors bg-emerald-50/40"
      >
        <Plus className="w-4 h-4" />
        <span>Add Another Turf (e.g. Turf {turfs.length + 1})</span>
      </button>
    </div>
  );
};
