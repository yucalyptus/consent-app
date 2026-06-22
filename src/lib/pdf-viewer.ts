import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface RenderedPage {
  canvas: HTMLCanvasElement
  pageNum: number
  viewport: { width: number; height: number; scale: number }
}

export async function renderPdf(
  url: string,
  container: HTMLElement,
  scale = 1.5,
): Promise<RenderedPage[]> {
  const loadingTask = pdfjsLib.getDocument({ url })
  const pdf = await loadingTask.promise
  const pages: RenderedPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    const pageWrapper = document.createElement('div')
    pageWrapper.className = 'pdf-page-wrapper'
    pageWrapper.style.position = 'relative'
    pageWrapper.style.width = `${viewport.width}px`
    pageWrapper.style.height = `${viewport.height}px`
    pageWrapper.style.marginBottom = '8px'

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.className = 'pdf-canvas'

    await page.render({ canvas, viewport }).promise

    pageWrapper.appendChild(canvas)
    container.appendChild(pageWrapper)

    pages.push({
      canvas,
      pageNum: i,
      viewport: { width: viewport.width, height: viewport.height, scale },
    })
  }

  return pages
}
