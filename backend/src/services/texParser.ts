export interface ParsedQuiz {
  question: string
  answer: string
}

export function parseTexFile(content: string): ParsedQuiz[] {
  const results: ParsedQuiz[] = []

  // 匹配 \begin{question}...\end{question} 和 \begin{answer}...\end{answer}
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

  // 如果没有匹配到结构化格式，尝试 Q:/A: 格式
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

  return results
}
