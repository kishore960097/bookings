import React, { useRef, useEffect, useCallback, useState } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ITEM_H = 44;   // height of each drum item in px
const VISIBLE = 5;   // number of visible rows (must be odd)

// ── Single Drum Column ─────────────────────────────────────────────────────────
function Drum<T>({
  items,
  selected,
  onSelect,
  format = (v: T) => String(v),
  label,
}: {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  label?: string;
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
    <div className="relative select-none flex items-center" style={{ height: ITEM_H * VISIBLE }}>
      <div
        ref={listRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        className="overflow-y-scroll scrollbar-none"
        style={{
          width: 64,
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
                  ? 'text-[var(--q-ink)] font-black text-3xl tracking-tight'
                  : 'text-[var(--q-muted)] font-bold text-xl'
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

      {label && (
        <div className="ml-1 text-sm font-bold text-[var(--q-muted)] w-10">
          {label}
        </div>
      )}

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
          borderTop: '1px solid var(--q-hairline)',
          borderBottom: '1px solid var(--q-hairline)',
        }}
      />
    </div>
  );
}

// ── DurationDrumPicker (modal) ────────────────────────────────────────────────────
interface DurationDrumPickerProps {
  value: number;        // total minutes
  onChange: (v: number) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i);          // 0-11
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]; // 5 min increments

function DurationDrumPickerModal({ value, onChange, onClose }: DurationDrumPickerProps) {
  const initialH = Math.floor(value / 60);
  const initialM = value % 60;
  
  // Snap initialM to closest 5 minutes
  const snappedM = Math.round(initialM / 5) * 5;
  const closestM = snappedM === 60 ? 55 : snappedM;

  const [hour, setHour] = useState(initialH);
  const [minute, setMinute] = useState(closestM);

  const handleConfirm = () => {
    let total = hour * 60 + minute;
    if (total === 0) total = 15; // Minimum 15 mins
    onChange(total);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[var(--q-scrim-bg)] backdrop-blur-[8px]" />
      <div
        className="relative w-full max-w-sm bg-[var(--q-canvas)] sm:rounded-[20px] rounded-t-[20px] shadow-[0_1px_2px_rgba(23,23,23,0.06),0_8px_24px_rgba(23,23,23,0.06)] pb-safe overflow-hidden border border-[var(--q-hairline)] m-0 sm:m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[var(--q-hairline)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={onClose}
            className="text-base font-semibold text-[var(--q-muted)] hover:text-[var(--q-ink)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="text-base font-bold text-[var(--q-red-action)] hover:text-[var(--q-red-pressed)] transition-colors"
          >
            Done
          </button>
        </div>

        {/* Drums */}
        <div className="flex items-center justify-center gap-4 py-2 px-4 mb-8">
          <Drum
            items={HOURS}
            selected={hour}
            onSelect={setHour}
            format={(v) => String(v)}
            label="hrs"
          />
          <Drum
            items={MINUTES}
            selected={minute}
            onSelect={setMinute}
            format={(v) => String(v)}
            label="min"
          />
        </div>
        <div className="h-6" />
      </div>
    </div>
  );
}

// ── Public DurationInput component ─────────────────────────────────────────────────

interface DurationInputProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  value: number;       // total minutes
  onChange: (v: number) => void;
}

export const DurationInput: React.FC<DurationInputProps> = ({ value, onChange, className, ...rest }) => {
  const [open, setOpen] = useState(false);

  const h = Math.floor(value / 60);
  const m = value % 60;
  
  let display = '';
  if (h > 0) display += `${h} hr${h > 1 ? 's' : ''} `;
  if (m > 0 || h === 0) display += `${m} min${m > 1 ? 's' : ''}`;
  display = display.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={{ textAlign: 'center', cursor: 'pointer' }}
        {...rest}
      >
        {display}
      </button>

      {open && (
        <DurationDrumPickerModal
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
