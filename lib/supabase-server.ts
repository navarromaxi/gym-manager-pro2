import { createClient as _createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createClient = () => {
  const key = supabaseServiceRoleKey || supabaseAnonKey;

  if (!supabaseServiceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY no está definida. Se usará NEXT_PUBLIC_SUPABASE_ANON_KEY como fallback en el servidor."
    );
  }

  return _createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
    },
  });
};
