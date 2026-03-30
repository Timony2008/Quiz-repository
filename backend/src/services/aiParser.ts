import OpenAI from 'openai'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
dotenv.config()

function getAIClient() {
  if (process.env.AI_ENABLED !== 'true') return null
  if (!process.env.DEEPSEEK_API_KEY) return null
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  })
}

const prisma = new PrismaClient()

// ── 类型定义 ──────────────────────────────────────────────────

export interface QAPair {
  question: string
  answer: string
}

export interface QAPairWithTags extends QAPair {
  tags: {
    knowledge: string[]       // 知识点标签（必须来自字典）
    method: string[]          // 解题方法标签（必须来自字典）
    source: string | null     // 题目来源（必须来自字典，最多一个）
    proposedContext: string[] // 候选补充标签（仅建议，不自动创建）
  }
  confidence: number          // 0.0 ~ 1.0
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
    select: { name: true, dimension: true },
  })

  const knowledge = tags.filter(t => t.dimension === 'KNOWLEDGE').map(t => t.name)
  const method = tags.filter(t => t.dimension === 'METHOD').map(t => t.name)
  const source = tags.filter(t => t.dimension === 'SOURCE').map(t => t.name)

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

// ── 返回值清洗 ────────────────────────────────────────────────

function normalizeAIResult(items: any[]): QAPairWithTags[] {
  if (!Array.isArray(items)) return []

  return items.map((it: any): QAPairWithTags => {
    const q = String(it?.question ?? '')
    const a = String(it?.answer ?? '')

    const confidenceRaw = Number(it?.confidence)
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.max(0, Math.min(1, confidenceRaw))
      : 0.5

    const tags = it?.tags ?? {}

    const knowledge: string[] = Array.isArray(tags.knowledge)
      ? tags.knowledge.map((x: any) => String(x).trim()).filter(Boolean)
      : []

    const method: string[] = Array.isArray(tags.method)
      ? tags.method.map((x: any) => String(x).trim()).filter(Boolean)
      : []

    const sourceVal = tags.source
    const source: string | null =
      sourceVal === null || sourceVal === undefined || String(sourceVal).trim() === ''
        ? null
        : String(sourceVal).trim()

    // 兼容旧字段 context
    const pcRaw: any[] = Array.isArray(tags.proposedContext)
      ? tags.proposedContext
      : (Array.isArray(tags.context) ? tags.context : [])

    const proposedContext: string[] = [...new Set(
      pcRaw.map((x: any) => String(x).trim()).filter(Boolean)
    )]

    return {
      question: q,
      answer: a,
      tags: {
        knowledge: [...new Set(knowledge)],
        method: [...new Set(method)],
        source,
        proposedContext,
      },
      confidence,
    }
  })
}

// ── 单 chunk 解析 ─────────────────────────────────────────────

async function parseChunk(text: string, tagDict: TagDict): Promise<QAPairWithTags[]> {
  const knowledgeList = tagDict.knowledge.join('、')
  const methodList = tagDict.method.join('、')
  const sourceList = tagDict.source.join('、')

  const client = getAIClient()
  if (!client) return []

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
    "proposedContext": ["候选标签1", "候选标签2"]
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

**proposedContext**（候选补充标签，可自由填写，用于年份/赛事届次/其他无法归类信息）
注意：这些只是候选，不代表系统会创建标签。

**confidence**：0.0~1.0，表示你对标签推断的整体置信度

## 绝对禁止
- 禁止使用训练数据中记忆的任何题目内容
- 禁止对题目文字做任何修改、替换、补充或"纠正"
- question 字段必须与输入原文逐字一致，只允许添加 LaTeX 标记
- knowledge / method / source 字段只能从上方列表中选择，不得自造新词
- 不得假设系统会自动创建任何标签（尤其全局标签）`,
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
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    return normalizeAIResult(parsed)
  } catch {
    console.error('AI 返回解析失败:', raw)
    return []
  }
}

// ── 主入口 ────────────────────────────────────────────────────

export async function parseWithAI(text: string): Promise<QAPairWithTags[]> {
  if (process.env.AI_ENABLED !== 'true') {
    console.log('[AI_DISABLED] parseWithAI skipped')
    return []
  }

  const cleanedText = removeWatermarks(cleanMathUnicode(text))
  console.log('=== 清洗后文本预览 ===\n', cleanedText.slice(0, 500))

  const tagDict = await loadTagDict()
  console.log(
    `=== 标签字典加载完成 === knowledge:${tagDict.knowledge.length} method:${tagDict.method.length} source:${tagDict.source.length}`
  )

  const chunks = chunkText(cleanedText)
  const results: QAPairWithTags[] = []

  for (const chunk of chunks) {
    const pairs = await parseChunk(chunk, tagDict)
    console.log('=== chunk 解析结果 ===', JSON.stringify(pairs, null, 2))
    results.push(...pairs)
  }

  return results
}
