const pdfParse = require('pdf-parse')
import fs from 'fs'
import { ParsedQuiz } from './texParser'
import { parseWithAI } from './aiParser'

export async function parsePdfFile(filePath: string): Promise<ParsedQuiz[]> {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  const text = data.text

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
    const aiResults = await parseWithAI(text)
    return aiResults
  }

  return results
}
