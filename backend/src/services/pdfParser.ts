import fs from 'fs'
import { ParsedQuiz } from './texParser'
import { parseWithAI } from './aiParser'

export async function parsePdfFile(filePath: string): Promise<ParsedQuiz[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const buffer = fs.readFileSync(filePath)
  const uint8Array = new Uint8Array(buffer)

  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise

  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ') + '\n'
  }

  console.log('PDF 文本提取成功，长度:', text.length)

  // 直接交给 AI，让 AI 重建 LaTeX 混合文本
  const pairs = await parseWithAI(text)

  return pairs.map(p => ({
    question: p.question,
    answer: p.answer,
  }))
}
