import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNewerVersion, CURRENT_APP_VERSION } from '../src/config/appVersion';
import { handleAdminAction } from '../src/components/qbi/qbeAssistantActions';
import { api } from '../src/services/api';

describe('Pre-Release Upgrades Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part 4: App Version Semver Comparison (isNewerVersion)', () => {
    it('correctly compares patch version bumps', () => {
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    });

    it('correctly compares minor version bumps', () => {
      expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
      expect(isNewerVersion('1.2.3', '1.1.9')).toBe(true);
      expect(isNewerVersion('1.0.5', '1.1.0')).toBe(false);
    });

    it('correctly compares major version bumps', () => {
      expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
      expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false);
    });

    it('handles version prefixes gracefully', () => {
      expect(isNewerVersion('v1.0.1', '1.0.0')).toBe(true);
      expect(isNewerVersion('1.0.1', 'v1.0.0')).toBe(true);
      expect(isNewerVersion('v1.0.0', 'v1.0.0')).toBe(false);
    });

    it('identifies newer releases against CURRENT_APP_VERSION', () => {
      expect(isNewerVersion('1.0.1', CURRENT_APP_VERSION)).toBe(true);
      expect(isNewerVersion(CURRENT_APP_VERSION, CURRENT_APP_VERSION)).toBe(false);
    });
  });

  describe('Part 3: Qbe Targeted Broadcast Commands & Safety Guard', () => {
    it('dispatches broadcast to owners', async () => {
      const broadcastSpy = vi.spyOn(api, 'broadcastAlert').mockResolvedValue({
        success: true,
        count: 5,
        notification: { id: 'notif-1', title: 'Qbe Executive Broadcast', message: 'Pitch maintenance tonight', targetAudience: 'owners' },
      } as any);

      const res = await handleAdminAction('custom', 'Send broadcast to owners: Pitch maintenance tonight');
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAudience: 'owners',
          message: 'Pitch maintenance tonight',
        })
      );
      expect(res.actionData?.type).toBe('broadcast');
      expect(res.actionData?.status).toBe('completed');
      expect(res.text).toContain('Owners Only');
    });

    it('dispatches broadcast to customers', async () => {
      const broadcastSpy = vi.spyOn(api, 'broadcastAlert').mockResolvedValue({
        success: true,
        count: 12,
        notification: { id: 'notif-2', title: 'Qbe Executive Broadcast', message: 'Weekend 20% discount', targetAudience: 'customers' },
      } as any);

      const res = await handleAdminAction('custom', 'Send broadcast to customers: Weekend 20% discount');
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAudience: 'customers',
          message: 'Weekend 20% discount',
        })
      );
      expect(res.text).toContain('Customers Only');
    });

    it('dispatches broadcast to all users with Tanglish phrasing', async () => {
      const broadcastSpy = vi.spyOn(api, 'broadcastAlert').mockResolvedValue({
        success: true,
        count: 20,
        notification: { id: 'notif-3', title: 'Qbe Executive Broadcast', message: 'New update available', targetAudience: 'all' },
      } as any);

      const res = await handleAdminAction('custom', 'all users-ku broadcast anuppu: New update available');
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAudience: 'all',
          message: 'New update available',
        })
      );
      expect(res.text).toContain('All Users');
    });

    it('blocks destructive database wipe and prompts for master authorization password', async () => {
      const res = await handleAdminAction('custom', 'Qbe, please reset database');
      expect(res.actionData?.type).toBe('safety_guard_refusal');
      expect(res.actionData?.status).toBe('blocked');
      expect(res.text).toContain('KISHOREYES');
    });
  });

  describe('Part 4 & 5: Backend API contracts', () => {
    it('defines expected endpoints in api client', () => {
      expect(typeof api.getAppVersion).toBe('function');
      expect(typeof api.publishAppVersion).toBe('function');
      expect(typeof api.submitTicket).toBe('function');
      expect(typeof api.backupAll).toBe('function');
      expect(typeof api.broadcastAlert).toBe('function');
      expect(typeof api.resetFreshDatabase).toBe('function');
    });
  });
});
