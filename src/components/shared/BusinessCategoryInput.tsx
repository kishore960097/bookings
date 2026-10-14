import React, { useState, useEffect } from 'react';
import { Plus, Check, ChevronDown, Edit3 } from 'lucide-react';

export interface CategoryGroup {
  group: string;
  items: string[];
}

export const DEFAULT_BUSINESS_CATEGORIES: CategoryGroup[] = [
  {
    group: '💈 Salon, Barber & Beauty',
    items: [
      'Barber Shop',
      'Unisex Salon',
      'Beauty Parlour',
      'Spa & Salon',
      'Nail & Lash Studio',
      'Tattoo & Piercing Studio',
      'Bridal & Makeup Studio',
    ],
  },
  {
    group: '🏥 Healthcare & Medical',
    items: [
      'Doctor Clinic / OPD',
      'Hospital & Consultation',
      'Diagnostic & Blood Test Lab',
      'Dental Care Clinic',
      'Physiotherapy & Rehab',
      'Eye Care & Opticals',
      'Pharmacy & Medicals',
    ],
  },
  {
    group: '🍽️ Food, Cafe & Hospitality',
    items: [
      'Restaurant & Dine-In Queue',
      'Cafe & Bakery',
      'Hotel & Resort (Check-in)',
      'Food Court Token Counter',
    ],
  },
  {
    group: '🚗 Auto, Bike & Service Centers',
    items: [
      'Car Service & Repair Garage',
      'Car Wash & Detailing Lounge',
      'Bike / EV Service Station',
      'Tire & Wheel Alignment',
    ],
  },
  {
    group: '🏋️ Fitness, Sports & Wellness',
    items: [
      'Gym & Fitness Center',
      'Yoga & Meditation Studio',
      'Sports Arena & Turf Booking',
      'Swimming & Aqua Club',
    ],
  },
  {
    group: '💼 Professional & Citizen Services',
    items: [
      'Legal & CA Consultation Office',
      'Govt & Citizen Helpdesk (e-Seva/RTO)',
      'Bank & Financial Advisory',
      'Photography & Video Studio',
      'Pet Clinic & Animal Grooming',
      'Tailoring & Fashion Boutique',
    ],
  },
];

// Flattened list of all presets
export const ALL_PRESET_CATEGORIES = DEFAULT_BUSINESS_CATEGORIES.flatMap((g) => g.items);

interface BusinessCategoryInputProps {
  value: string;
  onChange: (category: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

export const BusinessCategoryInput: React.FC<BusinessCategoryInputProps> = ({
  value,
  onChange,
  label = 'Business Category',
  required = true,
  className = '',
}) => {
  const isPreset = ALL_PRESET_CATEGORIES.includes(value);
  const [isCustomMode, setIsCustomMode] = useState(!isPreset && Boolean(value));
  const [customText, setCustomText] = useState(!isPreset ? value : '');

  useEffect(() => {
    if (!ALL_PRESET_CATEGORIES.includes(value) && value) {
      setIsCustomMode(true);
      setCustomText(value);
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__CUSTOM__') {
      setIsCustomMode(true);
      if (!customText) {
        setCustomText('');
        onChange('');
      } else {
        onChange(customText);
      }
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  const handleBackToPresets = () => {
    setIsCustomMode(false);
    onChange('Barber Shop');
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B665F]">
          {label} {required && <span className="text-[#E8342A]">*</span>}
        </label>
        {isCustomMode ? (
          <button
            type="button"
            onClick={handleBackToPresets}
            className="text-[11px] font-bold text-[#E8342A] hover:opacity-80 transition-colors flex items-center gap-1"
          >
            <span>Choose from Presets</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(true);
              setCustomText(value || '');
            }}
            className="text-[11px] font-bold text-[#E8342A] hover:opacity-80 transition-colors flex items-center gap-1"
          >
            <Plus size={12} />
            <span>Type Custom Category</span>
          </button>
        )}
      </div>

      {!isCustomMode ? (
        <div className="relative">
          <select
            value={value || 'Barber Shop'}
            onChange={handleSelectChange}
            required={required}
            className="w-full px-4 py-3 rounded-xl border border-[rgba(11,11,11,0.12)] focus:outline-none focus:ring-2 focus:ring-[#0B0B0B] font-semibold text-[#0B0B0B] bg-[#FFF4E8] appearance-none cursor-pointer pr-10 text-sm shadow-sm"
          >
            {DEFAULT_BUSINESS_CATEGORIES.map((catGroup) => (
              <optgroup key={catGroup.group} label={catGroup.group}>
                {catGroup.items.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="✨ Custom / Other">
              <option value="__CUSTOM__">✍️ + Type Custom Business Category...</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6B665F]">
            <ChevronDown size={18} />
          </div>
        </div>
      ) : (
        <div className="space-y-2 animate-in fade-in duration-200">
          <div className="relative">
            <input
              type="text"
              value={customText}
              onChange={handleCustomTextChange}
              placeholder="e.g. Ayurvedic Panchakarma Clinic, Pet Spa & Care, Tattoo Studio..."
              required={required}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border-2 border-[#0B0B0B] focus:outline-none focus:ring-2 focus:ring-[#0B0B0B] font-semibold text-[#0B0B0B] bg-[#FFFFFF] pr-10 text-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#0B0B0B]">
              <Edit3 size={16} />
            </div>
          </div>
          <p className="text-[11px] text-[#6B665F] flex items-center gap-1">
            
            <span>Type any custom business or service category. Customers can search and filter by it.</span>
          </p>
        </div>
      )}
    </div>
  );
};
