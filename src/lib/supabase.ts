import { createClient } from '@supabase/supabase-js';

const getEnv = (name: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase URL is missing or using placeholder. Database calls will likely FAIL with "Failed to fetch". Please set VITE_SUPABASE_URL in your environment.');
} else {
  console.log('Supabase URL detected:', supabaseUrl.substring(0, 15) + '...');
}

if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  console.warn('Supabase Anon Key is missing or using placeholder. Database calls will likely FAIL. Please set VITE_SUPABASE_ANON_KEY in your environment.');
}

// In development, exposing this to help debugging "Failed to fetch" issues
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any)._supabase_debug = {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 12) : null
  };
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('organizacoes').select('id').limit(1);
    if (error) {
      if (error.message.includes('fetch')) return { ok: false, error: 'Network Error' };
      return { ok: true, error: null }; // Tables might not exist, but connection works
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: 'Connection Failed' };
  }
};
