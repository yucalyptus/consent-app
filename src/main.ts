import './style.css'
import { listConsentForms, getPdfUrl, uploadPdf, deletePdf, signInWithGoogle, signOut, getUser, isAllowedUser } from './lib/supabase'
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
const googleLoginBtn = document.getElementById('google-login-btn')!
const logoutBtn = document.getElementById('logout-btn')!
const adminUserEmail = document.getElementById('admin-user-email')!

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

// ----- Admin: auth & toggle -----
async function showAdminView() {
  showView('admin')
  const user = await getUser()

  if (user && isAllowedUser(user.email)) {
    adminLogin.classList.add('hidden')
    adminPanel.classList.remove('hidden')
    adminUserEmail.textContent = user.email || ''
    loadAdminList()
  } else {
    adminLogin.classList.remove('hidden')
    adminPanel.classList.add('hidden')
  }
}

adminToggle.addEventListener('click', () => showAdminView())

googleLoginBtn.addEventListener('click', () => signInWithGoogle())

logoutBtn.addEventListener('click', async () => {
  await signOut()
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
      <span class="admin-item-name">${form.fullPath}</span>
      <button class="btn-danger" data-file="${form.fullPath}">削除</button>
    `
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
    const result = await uploadPdf(file)
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
async function init() {
  const user = await getUser()
  if (user && isAllowedUser(user.email)) {
    showAdminView()
  } else {
    loadFormList()
  }
}
init()
