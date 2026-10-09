import { describe, it, expect } from 'vitest';
import { buildQueueKey, buildSlotKey } from './keys';

describe('db key builders', () => {
  describe('buildQueueKey', () => {
    it('generates a consistent key for same inputs', () => {
      const key1 = buildQueueKey('salon1', '2023-10-09');
      const key2 = buildQueueKey('salon1', '2023-10-09');
      expect(key1).toBe(key2);
      expect(key1).toBe('salon1:2023-10-09');
    });

    it('generates different keys for different inputs', () => {
      const key1 = buildQueueKey('salon1', '2023-10-09');
      const key2 = buildQueueKey('salon2', '2023-10-09');
      const key3 = buildQueueKey('salon1', '2023-10-10');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('throws error on missing inputs', () => {
      expect(() => buildQueueKey('', '2023-10-09')).toThrow();
      expect(() => buildQueueKey('salon1', '')).toThrow();
    });
  });

  describe('buildSlotKey', () => {
    it('generates a consistent key for same inputs', () => {
      const key1 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      const key2 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      expect(key1).toBe(key2);
      expect(key1).toBe('salon1:staffA:2023-10-09:10:00');
    });

    it('generates different keys for different inputs', () => {
      const key1 = buildSlotKey('salon1', 'staffA', '2023-10-09', '10:00');
      const key2 = buildSlotKey('salon2', 'staffA', '2023-10-09', '10:00');
      const key3 = buildSlotKey('salon1', 'staffB', '2023-10-09', '10:00');
      const key4 = buildSlotKey('salon1', 'staffA', '2023-10-10', '10:00');
      const key5 = buildSlotKey('salon1', 'staffA', '2023-10-09', '11:00');
      
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
      expect(key1).not.toBe(key5);
    });

    it('throws error on missing inputs', () => {
      expect(() => buildSlotKey('', 'staffA', '2023-10-09', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', '', '2023-10-09', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', 'staffA', '', '10:00')).toThrow();
      expect(() => buildSlotKey('salon1', 'staffA', '2023-10-09', '')).toThrow();
    });
  });
});
