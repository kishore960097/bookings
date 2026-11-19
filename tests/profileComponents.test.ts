import { describe, it, expect } from 'vitest';
import {
  ProfileView,
  AccountSubView,
  RefundsSubView,
  SupportSubView,
  PrivacySubView,
  TermsSubView,
} from '../src/features/customer/components/profile';

describe('Customer Profile Component Exports', () => {
  it('exports ProfileView component as a callable component function', () => {
    expect(typeof ProfileView).toBe('function');
  });

  it('exports all 5 subview components as callable component functions', () => {
    expect(typeof AccountSubView).toBe('function');
    expect(typeof RefundsSubView).toBe('function');
    expect(typeof SupportSubView).toBe('function');
    expect(typeof PrivacySubView).toBe('function');
    expect(typeof TermsSubView).toBe('function');
  });
});
