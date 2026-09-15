import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient<Database> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    return null as unknown as SupabaseClient<Database>
  }
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
