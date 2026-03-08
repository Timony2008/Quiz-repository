import fs from 'fs'
import { ParsedQuiz } from './texParser'
import { parseWithAI } from './aiParser'

export async function parsePdfFile(filePath: string): Promise<ParsedQuiz[]> {
  // 动态引入避免 ESM 兼容问题
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

  const results: ParsedQuiz[] = []

  // 第一步：尝试正则匹配 Q:/A: 格式
  const qaRegex = /Q:\s*([\s\S]*?)\nA:\s*([\s\S]*?)(?=\nQ:|\s*$)/g
  let match: RegExpExecArray | null
  while ((match = qaRegex.exec(text)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()
    if (question && answer) {
      results.push({ question, answer })
    }
  }

  // 第二步：正则没有结果，交给 AI 解析
  if (results.length === 0) {
    console.log('正则未匹配到内容，使用 AI 解析 PDF...')
    return await parseWithAI(text)
  }

  return results
}
