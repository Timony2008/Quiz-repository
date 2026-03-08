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
  latex?: string   // ✅ 新增
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
[{"question": "题目内容（纯文本）", "answer": "答案内容（纯文本）", "latex": "对应的LaTeX片段"}]

latex 字段的格式要求如下，严格遵守：
\\begin{problem}
题目的LaTeX内容
\\end{problem}
\\begin{solution}
答案的LaTeX内容
\\end{solution}

注意事项：
- question 和 answer 字段保留纯文本，供展示用
- latex 字段用于导出，数学公式用 $...$ 或 \\[...\\] 包裹
- 如果原文本本身就是LaTeX，直接保留原始命令；如果是纯文本，正常转义特殊字符`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.1,
  })

  const raw = response.choices[0].message.content ?? ''

  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.warn('AI 返回格式异常，原始内容：', raw)
    return []
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as QAPair[]
    return parsed
  } catch (e) {
    console.warn('JSON 解析失败：', e)
    return []
  }
}

export async function parseWithAI(text: string): Promise<QAPair[]> {
  const chunks = chunkText(text)

  if (chunks.length > 1) {
    console.log(`文本过长，分为 ${chunks.length} 块处理`)
  }

  const results: QAPair[] = []
  for (const chunk of chunks) {
    const pairs = await parseChunk(chunk)
    results.push(...pairs)
  }

  return results
}
