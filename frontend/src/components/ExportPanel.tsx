import { useState, useMemo } from 'react'

// ---- LaTeX 工具函数（组件外部）----

function isLikelyLatex(text: string): boolean {
  return /\\[a-zA-Z]+|\\[^a-zA-Z]|\$|\{|\}/.test(text)
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

function processField(text: string): { content: string; isPlain: boolean } {
  if (isLikelyLatex(text)) {
    return { content: text, isPlain: false }
  }
  return { content: escapeLatex(text), isPlain: true }
}

// ---- 类型定义 ----

interface Tag {
  id: number
  name: string
}

interface Quiz {
  id: number
  question: string
  answer: string
  tags: { tag: Tag }[]
}

type ExportFormat = 'json' | 'csv' | 'pdf' | 'tex'

interface Props {
  quizzes: Quiz[]
  onClose: () => void
}

// ---- 组件 ----

export default function ExportPanel({ quizzes, onClose }: Props) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')

  const allTags = useMemo(() =>
    Array.from(new Set(quizzes.flatMap(q => q.tags.map(t => t.tag.name)))),
    [quizzes]
  )

  const filteredQuizzes = useMemo(() => {
    if (selectedTags.size === 0) return quizzes
    return quizzes.filter(q =>
      q.tags.some(t => selectedTags.has(t.tag.name))
    )
  }, [quizzes, selectedTags])

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
    setSelectedIds(new Set())
  }

  function toggleQuiz(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredQuizzes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredQuizzes.map(q => q.id)))
    }
  }

  const selectedQuizzes = filteredQuizzes.filter(q => selectedIds.has(q.id))

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportJson() {
    const data = selectedQuizzes.map(q => ({
      question: q.question,
      answer: q.answer,
      tags: q.tags.map(t => t.tag.name)
    }))
    downloadFile(JSON.stringify(data, null, 2), 'quizzes.json', 'application/json')
  }

  function exportCsv() {
    const header = 'question,answer,tags'
    const rows = selectedQuizzes.map(q => {
      const tags = q.tags.map(t => t.tag.name).join('|')
      const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
      return [escape(q.question), escape(q.answer), escape(tags)].join(',')
    })
    downloadFile([header, ...rows].join('\n'), 'quizzes.csv', 'text/csv;charset=utf-8')
  }

  function exportPdf() {
    const win = window.open('', '_blank')
    if (!win) return
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>题目导出</title>
        <style>
          body { font-family: sans-serif; padding: 32px; line-height: 1.8; }
          .quiz { margin-bottom: 24px; border-bottom: 1px solid #eee; padding-bottom: 16px; }
          .question { font-weight: bold; margin-bottom: 4px; }
          .answer { color: #444; margin-bottom: 4px; }
          .tags { font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        ${selectedQuizzes.map((q, i) => `
          <div class="quiz">
            <div class="question">Q${i + 1}. ${q.question}</div>
            <div class="answer">A: ${q.answer}</div>
            <div class="tags">标签：${q.tags.map(t => t.tag.name).join(', ') || '无'}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `
    win.document.write(html)
    win.document.close()
    win.print()
  }

  function exportTex() {
    const docHeader = `\\documentclass[12pt, a4paper]{ctexart}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

% 题目环境
\\newenvironment{problem}
  {\\par\\vspace{0.5em}\\noindent\\textbf{题目：}\\itshape}
  {\\par\\vspace{0.3em}}

% 解答环境
\\newenvironment{solution}
  {\\par\\noindent\\textbf{解答：}\\normalfont}
  {\\par\\vspace{0.8em}\\hrule\\vspace{0.5em}}

\\begin{document}
`
    const docFooter = `
\\end{document}`

    const body = selectedQuizzes.map((q, i) => {
      const question = processField(q.question)
      const answer = processField(q.answer)
      const questionComment = question.isPlain ? '% [plain text]\n' : ''
      const answerComment = answer.isPlain ? '% [plain text]\n' : ''

      return `% ---- 第 ${i + 1} 题 ----
${questionComment}\\begin{problem}
${question.content}
\\end{problem}
${answerComment}\\begin{solution}
${answer.content}
\\end{solution}`
    }).join('\n')

    downloadFile(docHeader + body + docFooter, 'quizzes.tex', 'text/plain;charset=utf-8')
  }

  function handleExport() {
    if (selectedIds.size === 0) return
    if (exportFormat === 'json') exportJson()
    else if (exportFormat === 'csv') exportCsv()
    else if (exportFormat === 'pdf') exportPdf()
    else if (exportFormat === 'tex') exportTex()
  }

  return (
    <div style={{ marginBottom: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>

      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <strong>📤 导出题目</strong>
        <button onClick={onClose}>✕ 关闭</button>
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
            按标签筛选（可多选，不选则显示全部）：
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allTags.map(tag => (
              <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag)}
                  onChange={() => toggleTag(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 题目列表 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            勾选要导出的题目（已选 {selectedIds.size} / {filteredQuizzes.length}）：
          </div>
          <button onClick={toggleSelectAll} style={{ fontSize: 12 }}>
            {selectedIds.size === filteredQuizzes.length && filteredQuizzes.length > 0 ? '取消全选' : '全选'}
          </button>
        </div>

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
          {filteredQuizzes.length === 0 ? (
            <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>暂无题目</div>
          ) : (
            filteredQuizzes.map(q => (
              <label
                key={q.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: selectedIds.has(q.id) ? '#f5f9ff' : 'white'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleQuiz(q.id)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{q.question}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{q.answer}</div>
                  {q.tags.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {q.tags.map(t => (
                        <span key={t.tag.id} style={{
                          background: '#f0f0f0', padding: '1px 6px',
                          borderRadius: 10, fontSize: 11
                        }}>
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* 格式选择 + 导出按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {(['json', 'csv', 'pdf', 'tex'] as ExportFormat[]).map(fmt => (
            <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="exportFormat"
                value={fmt}
                checked={exportFormat === fmt}
                onChange={() => setExportFormat(fmt)}
              />
              {fmt.toUpperCase()}
            </label>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={selectedIds.size === 0}
          style={{
            marginLeft: 'auto',
            padding: '6px 20px',
            background: selectedIds.size === 0 ? '#ccc' : '#1677ff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          导出 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </button>
      </div>

    </div>
  )
}
