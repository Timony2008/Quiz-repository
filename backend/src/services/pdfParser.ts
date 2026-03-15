import fs from 'fs'
import { execSync } from 'child_process'
import { ParsedQuiz } from './texParser'
import { parseWithAI } from './aiParser'

function extractTextWithPoppler(filePath: string): string {
  try {
    // -layout 保留排版结构，-enc UTF-8 强制 UTF-8 输出
    const result = execSync(
      `pdftotext -layout -enc UTF-8 "${filePath}" -`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )
    return result
  } catch (err) {
    throw new Error(`pdftotext 执行失败，请确认已安装 poppler：${err}`)
  }
}

export async function parsePdfFile(filePath: string): Promise<ParsedQuiz[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在：${filePath}`)
  }

  const extractedText = extractTextWithPoppler(filePath)

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('PDF 文本提取失败，可能是扫描版图片 PDF')
  }

  console.log('提取到文本长度:', extractedText.length)
  console.log('文本预览:', extractedText.slice(0, 200))

  return await parseWithAI(extractedText)
}
