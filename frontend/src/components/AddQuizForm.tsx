import { MathText } from './MathText'
import { difficultyHint } from './DifficultyBadge'

interface Props {
  question: string
  answer: string
  note: string
  onNoteChange: (v: string) => void
  tagInput: string
  difficulty: string
  onQuestionChange: (v: string) => void
  onAnswerChange: (v: string) => void
  onTagInputChange: (v: string) => void
  onDifficultyChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export default function AddQuizForm({
  question,
  answer,
  note,
  onNoteChange,
  tagInput,
  difficulty,
  onQuestionChange,
  onAnswerChange,
  onTagInputChange,
  onDifficultyChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} style={{ marginBottom: 20, padding: 14, border: '1px solid #ddd', borderRadius: 8 }}>
      <textarea
        placeholder="题目 *"
        value={question}
        onChange={e => onQuestionChange(e.target.value)}
        rows={3}
        style={{ width: '100%', marginBottom: 4, padding: '6px 10px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }}
      />
      {question && (
        <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
          预览：<MathText text={question} />
        </div>
      )}

      <textarea
        placeholder="答案（可选）"
        value={answer}
        onChange={e => onAnswerChange(e.target.value)}
        rows={3}
        style={{ width: '100%', marginBottom: 4, padding: '6px 10px', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace' }}
      />
      {answer && (
        <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
          预览：<MathText text={answer} />
        </div>
      )}

      <textarea
        placeholder="备注（可选）"
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        rows={2}
        style={{ width: '100%', marginBottom: 8, padding: '6px 10px', boxSizing: 'border-box', resize: 'vertical' }}
      />
      {note && (
        <div style={{ fontSize: 13, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
          预览：<MathText text={note} />
        </div>
      )}

      <input
        placeholder="标签（逗号分隔）"
        value={tagInput}
        onChange={e => onTagInputChange(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: '6px 10px', boxSizing: 'border-box' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <input
          type="number"
          placeholder="难度（1 ~ 7，如 4.5）"
          min={1}
          max={7}
          step={0.1}
          value={difficulty}
          onChange={e => onDifficultyChange(e.target.value)}
          style={{ width: 200, padding: '4px 8px', borderRadius: 4, border: '1px solid #d9d9d9', fontSize: 13 }}
        />
        {difficultyHint(difficulty)}
      </div>

      <button type="submit">保存</button>
    </form>
  )
}
