import { parseWithAI } from './aiParser'

export interface ParsedQuiz {
  question: string
  answer: string
}

export async function parseTexFile(content: string): Promise<ParsedQuiz[]> {
  const results: ParsedQuiz[] = []

  // 第一步：匹配 \begin{question}...\end{question} 结构化格式
  // 直接保留原始 LaTeX 内容，不做任何纯文本转换
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

  if (results.length > 0) {
    console.log(`结构化解析成功，共 ${results.length} 题`)
    return results
  }

  // 第二步：结构不明确，交给 AI 解析
  console.log('未找到结构化格式，使用 AI 解析...')
  const pairs = await parseWithAI(content)
  return pairs.map(p => ({
    question: p.question,
    answer: p.answer,
  }))
}
