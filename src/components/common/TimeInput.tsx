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
              className={`flex items-center justify-center cursor-pointer transition-all duration-150
                ${isSelected
                  ? 'text-slate-900 font-black text-2xl'
                  : 'text-slate-400 font-medium text-lg'
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
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0))',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: padTop,
          background: 'linear-gradient(to top, rgba(255,255,255,0.95), rgba(255,255,255,0))',
        }}
      />

      {/* Selection band */}
      <div
        className="pointer-events-none absolute inset-x-0"
        style={{
          top: padTop,
          height: ITEM_H,
          borderTop: '1.5px solid #e2e8f0',
          borderBottom: '1.5px solid #e2e8f0',
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl pb-safe overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Time</span>
          <button
            onClick={handleConfirm}
            className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors"
          >
            Done
          </button>
        </div>

        {/* Drums */}
        <div className="flex items-center justify-center gap-1 py-4 px-4">
          <Drum
            items={HOURS}
            selected={hour}
            onSelect={setHour}
            format={(v) => String(v)}
          />
          <span className="text-2xl font-black text-slate-600 mb-0.5 select-none">:</span>
          <Drum
            items={MINUTES}
            selected={minute}
            onSelect={setMinute}
            format={(v) => String(v).padStart(2, '0')}
          />
          <div className="w-2" />
          <Drum
            items={AMPM}
            selected={ampm}
            onSelect={setAmpm}
            format={(v) => v.toLowerCase()}
          />
        </div>

        {/* Done button (mobile-friendly) */}
        <div className="px-5 pb-6">
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-black text-sm tracking-wide hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            Confirm {to24(hour, minute, ampm).replace(':', ':')} {ampm}
          </button>
        </div>
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
