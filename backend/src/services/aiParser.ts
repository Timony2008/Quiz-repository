import OpenAI from 'openai'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
dotenv.config()

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})

const prisma = new PrismaClient()

// ── 类型定义 ──────────────────────────────────────────────────

export interface QAPair {
  question: string
  answer: string
}

export interface QAPairWithTags extends QAPair {
  tags: {
    knowledge: string[]   // 知识点标签（必须来自字典）
    method: string[]      // 解题方法标签（必须来自字典）
    source: string | null // 题目来源（必须来自字典，最多一个）
    context: string[]     // 自由标签（AI 可自由生成）
  }
  confidence: number      // 0.0 ~ 1.0，AI 对标签推断的置信度
}

// ── 标签字典加载 ──────────────────────────────────────────────

interface TagDict {
  knowledge: string[]
  method: string[]
  source: string[]
}

async function loadTagDict(): Promise<TagDict> {
  const tags = await prisma.tag.findMany({
    where: { dimension: { in: ['KNOWLEDGE', 'METHOD', 'SOURCE'] } },
    select: { name: true, dimension: true }
  })

  const knowledge = tags.filter(t => t.dimension === 'KNOWLEDGE').map(t => t.name)
  const method    = tags.filter(t => t.dimension === 'METHOD').map(t => t.name)
  const source    = tags.filter(t => t.dimension === 'SOURCE').map(t => t.name)

  return { knowledge, method, source }
}

// ── 文本预处理 ────────────────────────────────────────────────

function cleanMathUnicode(text: string): string {
  return text.replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
    const code = ch.codePointAt(0)!
    if (code >= 0x1d44e && code <= 0x1d467)
      return String.fromCharCode('a'.charCodeAt(0) + code - 0x1d44e)
    if (code >= 0x1d434 && code <= 0x1d44d)
      return String.fromCharCode('A'.charCodeAt(0) + code - 0x1d434)
    if (code >= 0x1d41a && code <= 0x1d433)
      return String.fromCharCode('a'.charCodeAt(0) + code - 0x1d41a)
    if (code >= 0x1d400 && code <= 0x1d419)
      return String.fromCharCode('A'.charCodeAt(0) + code - 0x1d400)
    return ch
  })
}

function removeWatermarks(text: string, minRepeat = 3): string {
  const lines = text.split('\n')
  const freq = new Map<string, number>()
  for (const line of lines) {
    const key = line.trim()
    if (key === '') continue
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }
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

// ── 单 chunk 解析 ─────────────────────────────────────────────

async function parseChunk(
  text: string,
  tagDict: TagDict
): Promise<QAPairWithTags[]> {

  const knowledgeList = tagDict.knowledge.join('、')
  const methodList    = tagDict.method.join('、')
  const sourceList    = tagDict.source.join('、')

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个题目格式化助手，同时负责为每道题打上分类标签。

## 任务
将用户提供的原始文本识别题目结构，转换为指定 JSON 格式，并为每道题推断标签。

## 输出格式
严格返回 JSON 数组，不要有任何多余文字：
[{
  "question": "题目内容",
  "answer": "答案内容",
  "tags": {
    "knowledge": ["知识点1", "知识点2"],
    "method": ["方法1"],
    "source": "来源名称或null",
    "context": ["自由标签"]
  },
  "confidence": 0.85
}]

## 格式要求
- question / answer 使用 LaTeX 混合文本格式
- 行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹
- 没有答案时 answer 留空字符串 ""
- 不要返回 latex 字段，不要使用 \\begin{problem} 等包裹块
- 找不到任何题目时返回空数组 []

## 标签规则
**knowledge**（知识点，可多选，必须从以下列表中选择）：
${knowledgeList}

**method**（解题方法，可多选，必须从以下列表中选择）：
${methodList}

**source**（题目来源，最多选一个，必须从以下列表中选择，无法判断则填 null）：
${sourceList}

**context**（补充标签，可自由填写，用于年份/赛事届次/其他无法归类的信息，如 "2018年"、"第一轮"）

**confidence**：0.0~1.0，表示你对标签推断的整体置信度

## 绝对禁止
- 禁止使用训练数据中记忆的任何题目内容
- 禁止对题目文字做任何修改、替换、补充或"纠正"
- question 字段必须与输入原文逐字一致，只允许添加 LaTeX 标记
- knowledge / method / source 字段只能从上方列表中选择，不得自造新词`,
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
    return JSON.parse(cleaned) as QAPairWithTags[]
  } catch {
    console.error('AI 返回解析失败:', raw)
    return []
  }
}

// ── 主入口 ────────────────────────────────────────────────────

export async function parseWithAI(text: string): Promise<QAPairWithTags[]> {
  // 1. 预处理文本
  const cleanedText = removeWatermarks(cleanMathUnicode(text))
  console.log('=== 清洗后文本预览 ===\n', cleanedText.slice(0, 500))

  // 2. 从数据库加载标签字典（只查一次）
  const tagDict = await loadTagDict()
  console.log(
    `=== 标签字典加载完成 === knowledge:${tagDict.knowledge.length} method:${tagDict.method.length} source:${tagDict.source.length}`
  )

  // 3. 分块解析
  const chunks = chunkText(cleanedText)
  const results: QAPairWithTags[] = []

  for (const chunk of chunks) {
    const pairs = await parseChunk(chunk, tagDict)
    console.log('=== chunk 解析结果 ===', JSON.stringify(pairs, null, 2))
    results.push(...pairs)
  }

  return results
}

// ── 向后兼容导出（旧代码调用 parseWithAI 仍可用）─────────────
// QAPair 类型已被 QAPairWithTags 扩展，完全兼容
