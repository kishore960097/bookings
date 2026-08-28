import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const rawKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  typeof rawUrl === 'string' &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('YOUR_SUPABASE_PROJECT_URL') &&
  rawKey &&
  !rawKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY')
);

const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
