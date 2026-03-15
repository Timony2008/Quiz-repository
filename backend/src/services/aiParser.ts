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
}

// 清洗 Unicode 数学字母为普通 ASCII 字母
function cleanMathUnicode(text: string): string {
  return text.replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
    const code = ch.codePointAt(0)!
    // 小写斜体 1D44E ~ 1D467
    if (code >= 0x1d44e && code <= 0x1d467)
      return String.fromCharCode('a'.charCodeAt(0) + code - 0x1d44e)
    // 大写斜体 1D434 ~ 1D44D
    if (code >= 0x1d434 && code <= 0x1d44d)
      return String.fromCharCode('A'.charCodeAt(0) + code - 0x1d434)
    // 粗体小写 1D41A ~ 1D433
    if (code >= 0x1d41a && code <= 0x1d433)
      return String.fromCharCode('a'.charCodeAt(0) + code - 0x1d41a)
    // 粗体大写 1D400 ~ 1D419
    if (code >= 0x1d400 && code <= 0x1d419)
      return String.fromCharCode('A'.charCodeAt(0) + code - 0x1d400)
    return ch
  })
}

// 通用水印清洗：删除在文档中高频重复出现的行
function removeWatermarks(text: string, minRepeat = 3): string {
  const lines = text.split('\n')

  // 统计每一行（trim 后）出现的次数，空行跳过
  const freq = new Map<string, number>()
  for (const line of lines) {
    const key = line.trim()
    if (key === '') continue
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }

  // 过滤掉出现次数 >= minRepeat 的行
  return lines
    .filter(line => (freq.get(line.trim()) ?? 0) < minRepeat)
    .join('\n')
}

function chunkText(text: string, maxChars = 6000): string[] {
  const chunks: string[] = []
  let i = 0

  while (i < text.length) {
    let end = Math.min(i + maxChars, text.length)

    if (end < text.length) {
      const slice = text.slice(i, end)
      const boundaryMatch = [
        ...slice.matchAll(/\n(?=第\s*\d+\s*题|题目\s*\d+|\d+[.、．])/g),
      ]
      if (boundaryMatch.length > 0) {
        const lastBoundary = boundaryMatch[boundaryMatch.length - 1]
        end = i + (lastBoundary.index ?? 0)
      } else {
        const lastNewline = text.lastIndexOf('\n', end)
        if (lastNewline > i) end = lastNewline
      }
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
        content: `你是一个题目格式化助手。你的唯一任务是：将用户提供的原始文本，识别其中的题目结构，并转换为指定 JSON 格式输出。

以 JSON 数组格式返回，格式严格如下，不要有任何多余文字：
[{"question": "题目内容", "answer": "答案内容"}]

格式要求，严格遵守：
- question 和 answer 字段使用 LaTeX 混合文本格式
- 行内数学公式用 $...$ 包裹，例如：求 $\\frac{x}{2}=1$ 的解
- 独立展示的公式用 $$...$$ 包裹
- 非数学部分保持普通文字
- 如果文本中没有对应的答案，answer 字段留空字符串 ""，不要捏造答案
- 不要返回 latex 字段，不要使用 \\begin{problem} 等包裹块
- 如果找不到任何题目，返回空数组 []

⚠️ 绝对禁止：
- 禁止使用你训练数据中记忆的任何题目内容
- 禁止对题目文字做任何修改、替换、补充或"纠正"
- 禁止根据题目背景推断或填充你认为"正确"的版本
- question 字段必须与输入原文逐字一致，只允许添加 LaTeX 标记
- 即使你认出了这道题，也必须完全忽略你的记忆，只使用原文`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.0,
  })

  const raw = response.choices[0].message.content
  if (!raw) return []

  try {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()
    return JSON.parse(cleaned) as QAPair[]
  } catch {
    console.error('AI 返回解析失败:', raw)
    return []
  }
}

export async function parseWithAI(text: string): Promise<QAPair[]> {
  // 预处理：先清洗 Unicode 数学字母，再去除水印
  const cleanedText = removeWatermarks(cleanMathUnicode(text))
  console.log('=== 清洗后文本预览 ===\n', cleanedText.slice(0, 500))
  const chunks = chunkText(cleanedText)
  const results: QAPair[] = []

  for (const chunk of chunks) {
    const pairs = await parseChunk(chunk)
    console.log('=== chunk 解析结果 ===', JSON.stringify(pairs, null, 2))
    results.push(...pairs)
  }

  return results
}
