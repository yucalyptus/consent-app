import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const BUCKET = 'consent-forms'
const TABLE = 'consent_form_names'

// 管理画面の合言葉パスワード
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string || ''

export function checkAdminPassword(input: string): boolean {
  return ADMIN_PASSWORD !== '' && input === ADMIN_PASSWORD
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

  const pdfFiles = (data || []).filter((file) => file.name.endsWith('.pdf'))

  // 表示名を取得
  const { data: nameRows } = await supabase
    .from(TABLE)
    .select('file_name, display_name')

  const nameMap = new Map<string, string>()
  for (const row of nameRows || []) {
    nameMap.set(row.file_name, row.display_name)
  }

  return pdfFiles.map((file) => ({
    name: nameMap.get(file.name) || file.name.replace('.pdf', ''),
    fullPath: file.name,
  }))
}

export function getPdfUrl(fileName: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

export async function uploadPdf(
  file: File,
  displayName?: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(BUCKET).upload(file.name, file, {
    upsert: false,
  })

  if (error) {
    if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
      return { success: false, error: '同じ名前のファイルが既に存在します' }
    }
    return { success: false, error: error.message }
  }

  // 表示名があればDBに保存
  if (displayName) {
    await supabase.from(TABLE).upsert({
      file_name: file.name,
      display_name: displayName,
    })
  }

  return { success: true }
}

export async function renameForm(fileName: string, displayName: string): Promise<void> {
  await supabase.from(TABLE).upsert({
    file_name: fileName,
    display_name: displayName,
  })
}

export async function deletePdf(fileName: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.storage.from(BUCKET).remove([fileName])

  if (error) {
    return { success: false, error: error.message }
  }

  // 表示名も削除
  await supabase.from(TABLE).delete().eq('file_name', fileName)

  return { success: true }
}
