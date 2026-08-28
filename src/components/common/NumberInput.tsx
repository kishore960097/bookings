import React, { useState, useEffect } from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, min, max, ...props }) => {
  const [localValue, setLocalValue] = useState<string>(value?.toString() || '');

  useEffect(() => {
    setLocalValue(value?.toString() || '');
  }, [value]);

  const handleBlur = () => {
    if (localValue === '') {
      // If empty and min is provided, default to min, else 0
      const def = min !== undefined ? min : 0;
      setLocalValue(def.toString());
      onChange(def);
      return;
    }

    let parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      setLocalValue(value?.toString() || '');
      return;
    }

    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;

    setLocalValue(parsed.toString());
    onChange(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'Enter') {
      handleBlur();
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
};
