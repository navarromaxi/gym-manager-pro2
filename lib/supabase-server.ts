import { createClient as _createClient } from "@supabase/supabase-js" // Importa la función y renómbrala

// Asegúrate de que estas variables de entorno estén disponibles en tu entorno de Vercel
// Para operaciones de lectura, NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY son suficientes.
// Para operaciones de escritura/mutación en el servidor, es más seguro usar una clave de rol de servicio.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // ¡Importante! Esta clave debe ser secreta y solo para el servidor.

export const createClient = () =>
  _createClient(supabaseUrl, supabaseServiceRoleKey, {
    // Usa la función importada y renombrada
    auth: {
      persistSession: false, // No persistir sesión en el servidor
    },
  })
