import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const BUCKET = 'consent-forms'

// 管理画面にアクセスできるGoogleアカウント
const ALLOWED_EMAILS: string[] = (import.meta.env.VITE_ALLOWED_EMAILS as string || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) console.error('Login error:', error)
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function isAllowedUser(email: string | undefined): boolean {
  if (!email) return false
  if (ALLOWED_EMAILS.length === 0) return true // リスト未設定なら全員許可
  return ALLOWED_EMAILS.includes(email)
}

export interface ConsentForm {
  name: string
  fullPath: string
}

export async function listConsentForms(): Promise<ConsentForm[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list('', {
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    console.error('Failed to list consent forms:', error)
    return []
  }

  return (data || [])
    .filter((file) => file.name.endsWith('.pdf'))
    .map((file) => ({
      name: file.name.replace('.pdf', ''),
      fullPath: file.name,
    }))
}

export function getPdfUrl(fileName: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

export async function uploadPdf(file: File): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, {
    upsert: false,
  })

  if (error) {
    if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
      return { success: false, error: '同じ名前のファイルが既に存在します' }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deletePdf(fileName: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(BUCKET).remove([fileName])

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
