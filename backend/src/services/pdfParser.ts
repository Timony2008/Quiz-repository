const pdfParse = require('pdf-parse')
import fs from 'fs'
import { ParsedQuiz } from './texParser'

export async function parsePdfFile(filePath: string): Promise<ParsedQuiz[]> {
  const buffer = fs.readFileSync(filePath)
  const data = await pdfParse(buffer)
  const text = data.text

  const results: ParsedQuiz[] = []

  // 匹配 Q:/A: 格式
  const qaRegex = /Q:\s*([\s\S]*?)\nA:\s*([\s\S]*?)(?=\nQ:|\s*$)/g
  let match: RegExpExecArray | null
  while ((match = qaRegex.exec(text)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()
    if (question && answer) {
      results.push({ question, answer })
    }
  }

  return results
}
