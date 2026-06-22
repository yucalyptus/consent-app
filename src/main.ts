import './style.css'
import { listConsentForms, getPdfUrl, uploadPdf, deletePdf, signInWithGoogle, signOut, getUser, isAllowedUser } from './lib/supabase'
import type { ConsentForm } from './lib/supabase'
import { renderPdf } from './lib/pdf-viewer'
import type { RenderedPage } from './lib/pdf-viewer'
import { createSignatureOverlay } from './lib/signature-canvas'
import type { SignatureCanvas } from './lib/signature-canvas'
import { PDFDocument } from 'pdf-lib'

// ----- DOM refs -----
const formListView = document.getElementById('form-list-view')!
const signingView = document.getElementById('signing-view')!
const adminView = document.getElementById('admin-view')!
const formList = document.getElementById('form-list')!
const pdfContainer = document.getElementById('pdf-container')!
const formTitle = document.getElementById('form-title')!
const loadingEl = document.getElementById('loading')!
const loadingText = document.getElementById('loading-text')!
const toastEl = document.getElementById('toast')!
const adminList = document.getElementById('admin-list')!
const uploadArea = document.getElementById('upload-area')!
const fileInput = document.getElementById('file-input') as HTMLInputElement

const backBtn = document.getElementById('back-btn')!
const signToggleBtn = document.getElementById('sign-toggle-btn')!
const clearBtn = document.getElementById('clear-btn')!
const saveBtn = document.getElementById('save-btn')!
const adminToggle = document.getElementById('admin-toggle')!
const adminBackBtn = document.getElementById('admin-back-btn')!
const adminBackBtnLogin = document.getElementById('admin-back-btn-login')!
const adminLogin = document.getElementById('admin-login')!
const adminPanel = document.getElementById('admin-panel')!
const googleLoginBtn = document.getElementById('google-login-btn')!
const logoutBtn = document.getElementById('logout-btn')!
const adminUserEmail = document.getElementById('admin-user-email')!
const header = document.getElementById('header')!

// ----- State -----
let currentForm: ConsentForm | null = null
let pages: RenderedPage[] = []
let overlays: SignatureCanvas[] = []
let signingMode = false

// ----- View switching -----
function showView(view: 'list' | 'signing' | 'admin') {
  formListView.classList.toggle('hidden', view !== 'list')
  signingView.classList.toggle('hidden', view !== 'signing')
  adminView.classList.toggle('hidden', view !== 'admin')
  header.classList.toggle('hidden', view === 'signing')
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

// ----- Open form for signing -----
async function openForm(form: ConsentForm) {
  currentForm = form
  formTitle.textContent = form.name
  pdfContainer.innerHTML = ''
  pages = []
  overlays = []
  signingMode = false
  signToggleBtn.textContent = '署名モード'
  signToggleBtn.classList.remove('active')

  showView('signing')
  showLoading('PDFを読み込み中...')

  try {
    const url = getPdfUrl(form.fullPath)
    pages = await renderPdf(url, pdfContainer)
    for (const page of pages) {
      const wrapper = page.canvas.parentElement!
      overlays.push(createSignatureOverlay(wrapper))
    }
  } catch (e) {
    console.error(e)
    showToast('PDFの読み込みに失敗しました')
  } finally {
    hideLoading()
  }
}

// ----- Signing mode toggle -----
signToggleBtn.addEventListener('click', () => {
  signingMode = !signingMode
  signToggleBtn.textContent = signingMode ? '署名モード解除' : '署名モード'
  signToggleBtn.classList.toggle('active', signingMode)

  for (const o of overlays) {
    o.canvas.classList.toggle('signing-mode', signingMode)
  }
})

// ----- Clear signatures -----
clearBtn.addEventListener('click', () => {
  for (const o of overlays) o.clear()
  showToast('署名をクリアしました')
})

// ----- Save: embed signatures into PDF and download -----
saveBtn.addEventListener('click', async () => {
  if (!currentForm) return

  const hasSignature = overlays.some((o) => !o.isEmpty())
  if (!hasSignature) {
    showToast('署名してから保存してください')
    return
  }

  showLoading('署名済みPDFを作成中...')

  try {
    const url = getPdfUrl(currentForm.fullPath)
    const existingPdfBytes = await fetch(url).then((r) => r.arrayBuffer())
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const pdfPages = pdfDoc.getPages()

    for (let i = 0; i < overlays.length; i++) {
      const overlay = overlays[i]
      if (overlay.isEmpty()) continue

      const pngDataUrl = overlay.toDataURL()
      const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer())
      const pngImage = await pdfDoc.embedPng(pngBytes)

      const pdfPage = pdfPages[i]
      const { width, height } = pdfPage.getSize()
      pdfPage.drawImage(pngImage, { x: 0, y: 0, width, height })
    }

    const signedPdfBytes = await pdfDoc.save()
    const blob = new Blob([signedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const fileName = `${currentForm.name}_署名済み.pdf`
    const file = new File([blob], fileName, { type: 'application/pdf' })

    // 1. 共有シート（iOS/macOS Safari → 「ファイルに保存」でiCloud等を選べる）
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        showToast('署名済みPDFを保存しました')
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
        // 共有失敗時は次の方法へフォールスルー
      }
    }

    // 2. 保存ダイアログ（Chrome/Edge）
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PDF',
            accept: { 'application/pdf': ['.pdf'] },
          }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        showToast('署名済みPDFを保存しました')
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    // 3. フォールバック：ダウンロード
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
    showToast('署名済みPDFをダウンロードしました')
  } catch (e) {
    console.error(e)
    showToast('保存に失敗しました')
  } finally {
    hideLoading()
  }
})

// ----- Back to list -----
backBtn.addEventListener('click', () => {
  pdfContainer.innerHTML = ''
  pages = []
  overlays = []
  currentForm = null
  showView('list')
})

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
  // OAuth後のリダイレクト時、ログイン済みなら管理画面を表示
  const user = await getUser()
  if (user && isAllowedUser(user.email)) {
    showAdminView()
  } else {
    loadFormList()
  }
}
init()
