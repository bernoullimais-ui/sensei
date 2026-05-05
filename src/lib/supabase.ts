import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('Supabase URL is missing or using placeholder. Database calls will likely FAIL with "Failed to fetch". Please set VITE_SUPABASE_URL in your environment.');
}

if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  console.warn('Supabase Anon Key is missing or using placeholder. Database calls will likely FAIL. Please set VITE_SUPABASE_ANON_KEY in your environment.');
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
