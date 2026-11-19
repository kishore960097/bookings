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
      <div className="bg-[rgba(231,50,41,0.08)] border border-[rgba(10,10,10,0.12)]/80 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] flex items-center justify-center shrink-0 font-bold">
          🏟️
        </div>
        <div className="text-xs">
          <p className="font-bold text-[#C9281F]">Independent Turf Resources</p>
          <p className="text-[#C9281F] mt-0.5 leading-relaxed">
            Each turf has its own independent availability. When a customer books <strong>Turf 1</strong> at 5:00 PM,
            <strong> Turf 2</strong> remains available for other players!
          </p>
        </div>
      </div>

      {/* Turf count summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[#0A0A0A] uppercase tracking-wider">
            Your Turfs / Grounds ({turfs.length})
          </h3>
          <p className="text-[13px] text-[rgba(10,10,10,0.70)]">Define each playable area or court at your venue</p>
        </div>

        <button
          type="button"
          onClick={addTurf}
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#E73229] hover:bg-[linear-gradient(180deg,#F0554A_0%,#E73229_50%,#D42B22_100%)] text-[#FFFFFF] text-[13px] font-semibold transition-colors duration-150 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Turf</span>
        </button>
      </div>

      {/* Turf list */}
      <div className="space-y-3">
        {turfs.map((turf, idx) => (
          <div
            key={turf.id}
            className="p-3 sm:p-4 rounded-2xl border border-[rgba(10,10,10,0.12)] bg-[#FFFFFF] shadow-sm space-y-3 hover:border-[rgba(10,10,10,0.12)] transition-colors"
          >
            <div className="flex items-center justify-between border-b border-[rgba(10,10,10,0.12)] pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-[rgba(231,50,41,0.08)] text-[#C9281F] text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-[#0A0A0A] truncate">{turf.name || `Turf ${idx + 1}`}</span>
              </div>

              {turfs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTurf(turf.id)}
                  className="p-1.5 text-[rgba(10,10,10,0.70)] hover:text-[#C9281F] rounded-lg hover:bg-[rgba(231,50,41,0.08)] transition-colors"
                  title="Delete Turf"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="min-w-0">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  Turf / Court Name *
                </label>
                <input
                  type="text"
                  required
                  value={turf.name}
                  onChange={(e) => updateTurf(turf.id, { name: e.target.value })}
                  placeholder="e.g. Turf 1 (Main Pitch)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#E73229] bg-[#F5F5F7]/50 min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  Sport / Pitch Type *
                </label>
                <select
                  value={turf.type}
                  onChange={(e) => updateTurf(turf.id, { type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#E73229] bg-[rgba(10,10,10,0.05)] min-h-[40px]"
                >
                  {TURF_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                  Player Capacity (Optional)
                </label>
                <NumberInput
                  min={1}
                  max={100}
                  value={turf.capacity || ''}
                  onChange={(val) => updateTurf(turf.id, { capacity: Number(val) || undefined })}
                  placeholder="e.g. 14 players"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#E73229] bg-[#F5F5F7]/50 min-h-[40px]"
                />
              </div>

            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[rgba(10,10,10,0.70)] mb-1">
                Description / Amenities (Optional)
              </label>
              <input
                type="text"
                value={turf.description || ''}
                onChange={(e) => updateTurf(turf.id, { description: e.target.value })}
                placeholder="e.g. FIFA-grade turf with floodlights, bibs, water & dressing room"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[rgba(10,10,10,0.12)] text-[14px] font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#E73229] bg-[#F5F5F7]/50 min-h-[40px]"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add more button */}
      <button
        type="button"
        onClick={addTurf}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-[rgba(10,10,10,0.12)] hover:border-[rgba(10,10,10,0.12)]0 text-[#C9281F] hover:text-[#C9281F] font-bold text-xs flex items-center justify-center gap-2 transition-colors bg-[rgba(231,50,41,0.08)]"
      >
        <Plus className="w-4 h-4" />
        <span>Add Another Turf (e.g. Turf {turfs.length + 1})</span>
      </button>
    </div>
  );
};
