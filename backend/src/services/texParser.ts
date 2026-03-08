import { parseWithAI } from './aiParser'

export interface ParsedQuiz {
  question: string
  answer: string
}

export async function parseTexFile(content: string): Promise<ParsedQuiz[]> {
  const results: ParsedQuiz[] = []

  // 第一步：匹配 \begin{question}...\end{question} 结构化格式
  const blockRegex =
    /\\begin\{question\}([\s\S]*?)\\end\{question\}[\s\S]*?\\begin\{answer\}([\s\S]*?)\\end\{answer\}/g

  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(content)) !== null) {
    const question = match[1].trim()
    const answer = match[2].trim()
    if (question && answer) {
      results.push({ question, answer })
    }
  }

  // 第二步：尝试 Q:/A: 格式
  if (results.length === 0) {
    const qaRegex = /Q:\s*([\s\S]*?)\nA:\s*([\s\S]*?)(?=\nQ:|\s*$)/g
    while ((match = qaRegex.exec(content)) !== null) {
      const question = match[1].trim()
      const answer = match[2].trim()
      if (question && answer) {
        results.push({ question, answer })
      }
    }
  }

  // 第三步：两种正则都失败，交给 AI 解析
  if (results.length === 0) {
    console.log('正则未匹配到内容，使用 AI 解析 TEX...')
    const aiResults = await parseWithAI(content)
    return aiResults
  }

  return results
}
