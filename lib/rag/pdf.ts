/**
 * PDF text extraction using Poppler's `pdftotext` (best Arabic shaping fidelity)
 * and pdfjs-dist as a fallback. Poppler emits correct Unicode from PDFs that
 * embed a ToUnicode CMap, which weasyprint and most real publishers do.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { cleanExtractedText } from './arabic'

const execFileAsync = promisify(execFile)

export interface ExtractedPage {
  pageNumber: number
  text: string
  isImageOnly: boolean
}

export interface ExtractedBook {
  pages: ExtractedPage[]
  totalText: string
  needsOCR: boolean
  pageCount: number
}

function hasPoppler(): boolean {
  try {
    const stat = fs.statSync('/usr/bin/pdftotext')
    return stat.isFile()
  } catch {
    return false
  }
}

async function extractWithPoppler(filePath: string): Promise<ExtractedBook | null> {
  if (!hasPoppler()) return null
  try {
    // Get page count via pdfinfo
    let pageCount = 0
    try {
      const { stdout: info } = await execFileAsync('/usr/bin/pdfinfo', [filePath])
      const m = info.match(/Pages:\s+(\d+)/)
      if (m) pageCount = parseInt(m[1], 10)
    } catch {
      // ignore
    }
    if (!pageCount) {
      // fallback estimate via pdftotext output
    }

    // Extract text with layout preserved; pages separated by form feed (\u000C)
    const { stdout } = await execFileAsync(
      '/usr/bin/pdftotext',
      ['-layout', '-enc', 'UTF-8', filePath, '-'],
      { maxBuffer: 64 * 1024 * 1024 }
    )

    const rawPages = stdout.split('\u000C')
    const pages: ExtractedPage[] = []
    let totalText = ''
    let nonEmpty = 0
    for (let i = 0; i < rawPages.length; i++) {
      const txt = cleanExtractedText(rawPages[i] || '')
      const isImageOnly = txt.trim().length < 10
      if (!isImageOnly) nonEmpty++
      pages.push({ pageNumber: i + 1, text: txt, isImageOnly })
      totalText += `\n\n--- صفحة ${i + 1} ---\n${txt}`
    }

    const pageCountFinal = pageCount || pages.length
    const needsOCR = pageCountFinal > 0 && nonEmpty < pageCountFinal * 0.4

    return { pages, totalText, needsOCR, pageCount: pageCountFinal }
  } catch (err) {
    console.error('Poppler extraction failed:', err)
    return null
  }
}

async function extractWithPdfjs(filePath: string): Promise<ExtractedBook> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    const workerSrc = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs'
    )
    if (fs.existsSync(workerSrc)) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  } catch {}

  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise
  const pageCount = doc.numPages
  const pages: ExtractedPage[] = []
  let totalText = ''
  let needsOCR = false
  let textOnlyPages = 0

  for (let i = 1; i <= pageCount; i++) {
    let pageText = ''
    let isImageOnly = false
    try {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const lines: Record<string, any[]> = {}
      for (const item of content.items) {
        const y = item.transform ? Math.round(item.transform[5]) : 0
        const key = `${y}`
        if (!lines[key]) lines[key] = []
        lines[key].push(item)
      }
      const sortedY = Object.keys(lines)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => b - a)
      for (const y of sortedY) {
        const items = lines[`${y}`]
          .slice()
          .sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0))
        let line = ''
        for (const it of items) {
          if (it.str === '' && it.hasEOL) {
            line += '\n'
            continue
          }
          line += it.str
          if (it.hasEOL) line += '\n'
        }
        if (line.trim()) pageText += line + '\n'
      }
      page.cleanup?.()
    } catch {
      isImageOnly = true
    }
    if (!pageText.trim()) {
      isImageOnly = true
      needsOCR = true
    } else {
      textOnlyPages++
    }
    pages.push({ pageNumber: i, text: cleanExtractedText(pageText), isImageOnly })
    totalText += `\n\n--- صفحة ${i} ---\n${pageText}`
  }
  await doc.destroy?.()
  if (pageCount > 0 && textOnlyPages < pageCount * 0.4) needsOCR = true
  return { pages, totalText, needsOCR, pageCount }
}

export async function extractPdf(filePath: string): Promise<ExtractedBook> {
  const pop = await extractWithPoppler(filePath)
  if (pop && pop.pages.some((p) => p.text.trim().length > 20)) {
    return pop
  }
  return extractWithPdfjs(filePath)
}

export async function extractPdfMeta(filePath: string): Promise<{
  title?: string
  author?: string
  publisher?: string
  year?: number
}> {
  if (hasPoppler()) {
    try {
      const { stdout } = await execFileAsync('/usr/bin/pdfinfo', [filePath])
      const out: any = {}
      for (const line of stdout.split('\n')) {
        const m = line.match(/^([^:]+):\s*(.*)$/)
        if (!m) continue
        const key = m[1].trim().toLowerCase()
        const val = m[2].trim()
        if (key === 'title') out.title = val
        else if (key === 'author') out.author = val
        else if (m[1].trim() === 'Creator') out.publisher = out.publisher || val
        else if (key === 'creationdate') {
          const y = String(val).match(/D:(\d{4})/)
          if (y) out.year = parseInt(y[1], 10)
        }
      }
      return out
    } catch {}
  }
  // Fallback pdfjs metadata
  try {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(fs.readFileSync(filePath))
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise
    const meta = await doc.getMetadata?.()
    const info = meta?.info || {}
    const out: any = {
      title: info.Title || undefined,
      author: info.Author || undefined,
      publisher: info.Publisher || undefined,
    }
    if (info.CreationDate) {
      const m = String(info.CreationDate).match(/D:(\d{4})/)
      if (m) out.year = parseInt(m[1], 10)
    }
    await doc.destroy?.()
    return out
  } catch {
    return {}
  }
}
