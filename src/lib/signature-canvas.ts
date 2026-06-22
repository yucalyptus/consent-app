export interface SignatureCanvas {
  canvas: HTMLCanvasElement
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

export function createSignatureOverlay(pageWrapper: HTMLElement): SignatureCanvas {
  const canvas = document.createElement('canvas')
  const pdfCanvas = pageWrapper.querySelector('.pdf-canvas') as HTMLCanvasElement
  canvas.width = pdfCanvas.width
  canvas.height = pdfCanvas.height
  canvas.className = 'signature-overlay'
  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  canvas.style.cursor = 'crosshair'

  pageWrapper.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  let isDrawing = false
  let hasDrawn = false
  let lastX = 0
  let lastY = 0

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  function getPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !canvas.classList.contains('signing-mode')) return
    isDrawing = true
    const pos = getPos(e)
    lastX = pos.x
    lastY = pos.y
    canvas.setPointerCapture(e.pointerId)
    e.preventDefault()
  })

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastX = pos.x
    lastY = pos.y
    hasDrawn = true
    e.preventDefault()
  })

  canvas.addEventListener('pointerup', (e) => {
    isDrawing = false
    canvas.releasePointerCapture(e.pointerId)
  })

  canvas.addEventListener('pointercancel', () => {
    isDrawing = false
  })

  return {
    canvas,
    clear: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      hasDrawn = false
    },
    isEmpty: () => !hasDrawn,
    toDataURL: () => canvas.toDataURL('image/png'),
  }
}
