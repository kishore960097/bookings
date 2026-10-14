import React, { useRef, useEffect, useCallback, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const to24 = (h: number, m: number, ampm: 'AM' | 'PM'): string => {
  let hour = h % 12;
  if (ampm === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const from24 = (t: string): { h: number; m: number; ampm: 'AM' | 'PM' } => {
  if (!t) return { h: 12, m: 0, ampm: 'AM' };
  const [hStr, mStr] = t.split(':');
  const h24 = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const ampm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return { h, m, ampm };
};

const ITEM_H = 44;   // height of each drum item in px
const VISIBLE = 5;   // number of visible rows (must be odd)

// ── Single Drum Column ─────────────────────────────────────────────────────────
function Drum<T>({
  items,
  selected,
  onSelect,
  format = (v: T) => String(v),
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startIndex = useRef(0);
  const currentIndex = useRef(items.indexOf(selected));

  const scrollToIndex = useCallback((idx: number, smooth = true) => {
    if (!listRef.current) return;
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    listRef.current.scrollTo({
      top: clamped * ITEM_H,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [items.length]);

  // Sync from parent value
  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx !== -1) {
      currentIndex.current = idx;
      scrollToIndex(idx, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const commitIndex = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    currentIndex.current = clamped;
    scrollToIndex(clamped);
    onSelect(items[clamped]);
  }, [items, onSelect, scrollToIndex]);

  // Handle native scroll end
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = () => {
    if (!listRef.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!listRef.current) return;
      const idx = Math.round(listRef.current.scrollTop / ITEM_H);
      commitIndex(idx);
    }, 120);
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startIndex.current = currentIndex.current;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = startY.current - e.touches[0].clientY;
    const steps = Math.round(delta / ITEM_H);
    scrollToIndex(startIndex.current + steps, false);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    if (!listRef.current) return;
    const idx = Math.round(listRef.current.scrollTop / ITEM_H);
    commitIndex(idx);
  };

  // Mouse drag (desktop)
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startIndex.current = currentIndex.current;
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const delta = startY.current - e.clientY;
    const steps = Math.round(delta / ITEM_H);
    scrollToIndex(startIndex.current + steps, false);
  }, [scrollToIndex]);

  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!listRef.current) return;
    const idx = Math.round(listRef.current.scrollTop / ITEM_H);
    commitIndex(idx);
  }, [commitIndex]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const padTop = Math.floor(VISIBLE / 2) * ITEM_H;

  return (
    <div className="relative select-none" style={{ width: 64, height: ITEM_H * VISIBLE }}>
      {/* Scrollable list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        className="overflow-y-scroll scrollbar-none"
        style={{
          height: ITEM_H * VISIBLE,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Top padding */}
        <div style={{ height: padTop }} />
        {items.map((item, i) => {
          const isSelected = items[i] === selected;
          return (
            <div
              key={i}
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
              className={`flex items-center justify-center cursor-pointer transition-colors duration-150 duration-150
                ${isSelected
                  ? 'text-[#0B0B0B] font-black text-3xl tracking-tight'
                  : 'text-[#6B665F] font-bold text-xl'
                }`}
              onClick={() => commitIndex(i)}
            >
              {format(item)}
            </div>
          );
        })}
        {/* Bottom padding */}
        <div style={{ height: padTop }} />
      </div>

      {/* Fade masks */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: padTop,
          background: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: padTop,
          background: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))',
        }}
      />

      {/* Selection band */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: padTop,
          height: ITEM_H,
          borderTop: '1px solid rgba(11,11,11,0.12)',
          borderBottom: '1px solid rgba(11,11,11,0.12)',
        }}
      />
    </div>
  );
}

// ── DrumTimePicker (modal) ────────────────────────────────────────────────────
interface DrumTimePickerProps {
  value: string;        // 24-hour HH:mm
  onChange: (v: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);       // 1-12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);          // 0-59
const AMPM: ('AM' | 'PM')[] = ['AM', 'PM'];

function DrumTimePickerModal({ value, onChange, onClose }: DrumTimePickerProps) {
  const parsed = from24(value);
  const [hour, setHour] = useState(parsed.h);
  const [minute, setMinute] = useState(parsed.m);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);

  const handleConfirm = () => {
    onChange(to24(hour, minute, ampm));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#0B0B0B]/50" />
      <div
        className="relative w-full max-w-sm bg-[#FFFFFF] sm:rounded-[32px] rounded-t-[32px] shadow-lg pb-safe overflow-hidden border border-[#0B0B0B] m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[rgba(11,11,11,0.12)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={onClose}
            className="text-base font-semibold text-[#6B665F] hover:text-[#0B0B0B] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="text-base font-bold text-[#E8342A] hover:opacity-80 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Drums */}
        <div className="flex items-center justify-center gap-1 py-2 px-4 mb-8">
          <Drum
            items={HOURS}
            selected={hour}
            onSelect={setHour}
            format={(v) => String(v)}
          />
          <Drum
            items={MINUTES}
            selected={minute}
            onSelect={setMinute}
            format={(v) => String(v).padStart(2, '0')}
          />
          <div className="w-1" />
          <Drum
            items={AMPM}
            selected={ampm}
            onSelect={setAmpm}
            format={(v) => v.toLowerCase()}
          />
        </div>

        {/* Done button removed for pure iOS style, relying on top right Done button */}
        <div className="h-6" />
      </div>
    </div>
  );
}

// ── Public TimeInput component ─────────────────────────────────────────────────
// Drop-in replacement for <input type="time">
// Displays 12-hour format, shows drum picker on click, calls onChange with 24h value

interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;       // 24-hour HH:mm
  onChange: (v: string) => void;
}

export const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, className, ...rest }) => {
  const [open, setOpen] = useState(false);

  const { h, m, ampm } = from24(value);
  const display = value
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`
    : 'hh:mm AM/PM';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{ textAlign: 'center', cursor: 'pointer' }}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {display}
      </button>

      {open && (
        <DrumTimePickerModal
          value={value || '09:00'}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
