import { createClient } from '@supabase/supabase-js';

// Safe public Supabase configuration. Never expose service role or client secrets.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wkvzgimddzmuxsbskuxa.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdnpnaW1kZHptdXhzYnNrdXhhIiwicm9sZSI6ImFub24ifQ.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});
