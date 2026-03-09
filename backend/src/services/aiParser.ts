import OpenAI from 'openai'
import dotenv from 'dotenv'
dotenv.config()

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})

export interface QAPair {
  question: string
  answer: string
  // latex 字段已废弃，question/answer 本身就是 LaTeX 混合文本
}

function chunkText(text: string, maxChars = 6000): string[] {
  const chunks: string[] = []
  let i = 0

  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length)
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i) end = lastNewline
    }
    chunks.push(text.slice(i, end))
    i = end
  }

  return chunks
}

async function parseChunk(text: string): Promise<QAPair[]> {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个题目解析助手。从用户提供的文本中提取所有题目和答案。
以 JSON 数组格式返回，格式严格如下，不要有任何多余文字：
[{"question": "题目内容", "answer": "答案内容"}]

格式要求，严格遵守：
- question 和 answer 字段使用 LaTeX 混合文本格式
- 行内数学公式用 $...$ 包裹，例如：求 $\\frac{x}{2}=1$ 的解
- 独立展示的公式用 $$...$$ 包裹
- 非数学部分保持普通文字
- 如果输入文本来自 PDF 提取（可能含乱码或丢失上下标），请根据上下文推断并重建正确的 LaTeX 公式
- 不要返回 latex 字段，不要使用 \\begin{problem} 等包裹块
- 如果找不到明确的题目答案对，返回空数组 []`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.1,
  })

  const raw = response.choices[0].message.content
  if (!raw) return []

  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    return JSON.parse(cleaned) as QAPair[]
  } catch {
    console.error('AI 返回解析失败:', raw)
    return []
  }
}

export async function parseWithAI(text: string): Promise<QAPair[]> {
  const chunks = chunkText(text)
  const results: QAPair[] = []

  for (const chunk of chunks) {
    const pairs = await parseChunk(chunk)
    results.push(...pairs)
  }

  return results
}
