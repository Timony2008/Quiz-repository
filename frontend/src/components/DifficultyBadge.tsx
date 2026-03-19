export function toDiffNum(val: number | string | null | undefined): number {
  if (val == null) return -1
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? -1 : n
}

export function DifficultyBadge({ difficulty }: { difficulty?: number | string | null }) {
  if (difficulty == null) return null
  const val = typeof difficulty === 'string' ? parseFloat(difficulty) : difficulty
  if (isNaN(val)) return null
  const color =
    val <= 4   ? '#52c41a' :
    val <= 5.5 ? '#faad14' :
    '#ff4d4f'
  return (
    <span style={{
      fontSize: 12, padding: '2px 8px', borderRadius: 10,
      background: color + '1a', color,
      border: `1px solid ${color}55`,
      fontWeight: 500, whiteSpace: 'nowrap'
    }}>
      ⭐ {val} Star
    </span>
  )
}

export function difficultyHint(val: string): React.ReactNode {
  if (val === '') return null
  const n = parseFloat(val)
  if (isNaN(n)) return <span style={{ color: '#ff4d4f', fontSize: 12 }}>请输入数字</span>
  if (n < 1 || n > 7) return <span style={{ color: '#ff4d4f', fontSize: 12 }}>范围 1 ~ 7</span>
  return <span style={{ color: '#52c41a', fontSize: 12 }}>⭐ {n} Star</span>
}
