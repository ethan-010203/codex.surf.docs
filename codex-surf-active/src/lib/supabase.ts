import './server-runtime'

import type { SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null
let cachedClientPromise: Promise<SupabaseClient> | null = null

export class SupabaseConfigError extends Error {
  constructor(message = 'Supabase is not configured.') {
    super(message)
    this.name = 'SupabaseConfigError'
  }
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function getSupabaseCredentials() {
  return {
    supabaseUrl: readEnv('NEXT_PUBLIC_SUPABASE_URL') ?? readEnv('SUPABASE_URL'),
    supabaseKey:
      readEnv('SUPABASE_SERVICE_ROLE_KEY') ?? readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

export function isSupabaseConfigured(): boolean {
  const { supabaseKey, supabaseUrl } = getSupabaseCredentials()
  return Boolean(supabaseUrl && supabaseKey)
}

export function isDemoModeEnabled(): boolean {
  return !isSupabaseConfigured() && process.env.NODE_ENV !== 'production'
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (cachedClient) {
    return cachedClient
  }

  if (cachedClientPromise) {
    return cachedClientPromise
  }

  cachedClientPromise = (async () => {
    const { supabaseKey, supabaseUrl } = getSupabaseCredentials()

    if (!supabaseUrl || !supabaseKey) {
      throw new SupabaseConfigError(
        'Missing Supabase env vars. Expected NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.'
      )
    }

    const { createClient } = await import('@supabase/supabase-js')

    cachedClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    return cachedClient
  })()

  try {
    return await cachedClientPromise
  } finally {
    if (!cachedClient) {
      cachedClientPromise = null
    }
  }
}

export type ActivationCodeStatus = 'unused' | 'activated' | 'disabled'

export interface ActivationCodeRecord {
  id: string
  code: string
  status: ActivationCodeStatus
  subscription_plan_id: number | null
  activated_account: string | null
  activated_at: string | null
  batch_id: string | null
  note: string | null
  created_at: string
  updated_at: string | null
}
