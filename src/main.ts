import './style.css'
import { listConsentForms, getPdfUrl, uploadPdf, deletePdf, renameForm, checkAdminPassword } from './lib/supabase'
import type { ConsentForm } from './lib/supabase'

// ----- DOM refs -----
const formListView = document.getElementById('form-list-view')!
const adminView = document.getElementById('admin-view')!
const formList = document.getElementById('form-list')!
const loadingEl = document.getElementById('loading')!
const loadingText = document.getElementById('loading-text')!
const toastEl = document.getElementById('toast')!
const adminList = document.getElementById('admin-list')!
const uploadArea = document.getElementById('upload-area')!
const fileInput = document.getElementById('file-input') as HTMLInputElement

const adminToggle = document.getElementById('admin-toggle')!
const adminBackBtn = document.getElementById('admin-back-btn')!
const adminBackBtnLogin = document.getElementById('admin-back-btn-login')!
const adminLogin = document.getElementById('admin-login')!
const adminPanel = document.getElementById('admin-panel')!
const passwordInput = document.getElementById('password-input') as HTMLInputElement
const passwordSubmit = document.getElementById('password-submit')!
const passwordError = document.getElementById('password-error')!
const logoutBtn = document.getElementById('logout-btn')!

// ----- State -----
let isAdmin = false

// ----- View switching -----
function showView(view: 'list' | 'admin') {
  formListView.classList.toggle('hidden', view !== 'list')
  adminView.classList.toggle('hidden', view !== 'admin')
}

// ----- Loading / Toast -----
function showLoading(text = '読み込み中...') {
  loadingText.textContent = text
  loadingEl.classList.remove('hidden')
}
function hideLoading() {
  loadingEl.classList.add('hidden')
}

let toastTimer: number | undefined
function showToast(msg: string) {
  toastEl.textContent = msg
  toastEl.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2500)
}

// ----- Form list -----
async function loadFormList() {
  showLoading('同意書を読み込み中...')
  const forms = await listConsentForms()
  hideLoading()

  formList.innerHTML = ''
  if (forms.length === 0) {
    formList.innerHTML = '<div class="empty-state">同意書がありません。<br>管理画面からPDFをアップロードしてください。</div>'
    return
  }

  for (const form of forms) {
    const card = document.createElement('div')
    card.className = 'form-card'
    card.innerHTML = `<span class="form-card-name">${form.name}</span>`
    card.addEventListener('click', () => openForm(form))
    formList.appendChild(card)
  }
}

// ----- Open form: PDF を新しいタブで直接開く -----
function openForm(form: ConsentForm) {
  const url = getPdfUrl(form.fullPath)
  window.open(url, '_blank')
}

// ----- Admin: password auth -----
function showAdminView() {
  showView('admin')
  if (isAdmin) {
    adminLogin.classList.add('hidden')
    adminPanel.classList.remove('hidden')
    loadAdminList()
  } else {
    adminLogin.classList.remove('hidden')
    adminPanel.classList.add('hidden')
    passwordInput.value = ''
    passwordError.classList.add('hidden')
  }
}

function tryLogin() {
  const input = passwordInput.value
  if (checkAdminPassword(input)) {
    isAdmin = true
    adminLogin.classList.add('hidden')
    adminPanel.classList.remove('hidden')
    loadAdminList()
  } else {
    passwordError.classList.remove('hidden')
  }
}

adminToggle.addEventListener('click', () => showAdminView())

passwordSubmit.addEventListener('click', () => tryLogin())
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryLogin()
})

logoutBtn.addEventListener('click', () => {
  isAdmin = false
  showView('list')
  loadFormList()
})

adminBackBtn.addEventListener('click', () => {
  showView('list')
  loadFormList()
})
adminBackBtnLogin.addEventListener('click', () => {
  showView('list')
  loadFormList()
})

// ----- Admin: list files -----
async function loadAdminList() {
  showLoading('ファイル一覧を取得中...')
  const forms = await listConsentForms()
  hideLoading()

  adminList.innerHTML = ''
  if (forms.length === 0) {
    adminList.innerHTML = '<div class="empty-state">アップロードされたPDFはありません</div>'
    return
  }

  for (const form of forms) {
    const item = document.createElement('div')
    item.className = 'admin-item'
    item.innerHTML = `
      <span class="admin-item-name">${form.name}<br><small style="color:#6b7280">${form.fullPath}</small></span>
      <div class="admin-item-actions">
        <button class="btn-rename">名前変更</button>
        <button class="btn-danger">削除</button>
      </div>
    `
    item.querySelector('.btn-rename')!.addEventListener('click', async () => {
      const newName = prompt('表示名を入力してください', form.name)
      if (!newName) return
      await renameForm(form.fullPath, newName)
      showToast('表示名を変更しました')
      loadAdminList()
    })
    item.querySelector('.btn-danger')!.addEventListener('click', async () => {
      if (!confirm(`「${form.name}」を削除しますか？\nこの操作は取り消せません。`)) return
      showLoading('削除中...')
      const result = await deletePdf(form.fullPath)
      hideLoading()
      if (result.success) {
        showToast('削除しました')
        loadAdminList()
      } else {
        showToast(`削除失敗: ${result.error}`)
      }
    })
    adminList.appendChild(item)
  }
}

// ----- Admin: upload -----
uploadArea.addEventListener('click', () => fileInput.click())

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadArea.classList.add('dragover')
})
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover')
})
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadArea.classList.remove('dragover')
  const files = e.dataTransfer?.files
  if (files) handleUpload(files)
})

fileInput.addEventListener('change', () => {
  if (fileInput.files) handleUpload(fileInput.files)
  fileInput.value = ''
})

async function handleUpload(files: FileList) {
  const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf')
  if (pdfFiles.length === 0) {
    showToast('PDFファイルを選択してください')
    return
  }

  showLoading('アップロード中...')
  let successCount = 0
  let errorMsg = ''

  for (const file of pdfFiles) {
    const defaultName = file.name.replace('.pdf', '')
    const displayName = prompt(`「${file.name}」の表示名を入力してください\n（空欄ならファイル名をそのまま使用）`, defaultName)
    if (displayName === null) continue // キャンセル

    const result = await uploadPdf(file, displayName || undefined)
    if (result.success) {
      successCount++
    } else {
      errorMsg = result.error || '不明なエラー'
    }
  }

  hideLoading()

  if (successCount > 0) {
    showToast(`${successCount}件アップロードしました`)
    loadAdminList()
  }
  if (errorMsg) {
    showToast(errorMsg)
  }
}

// ----- Init -----
loadFormList()
