import React, { useEffect, useMemo, useState } from 'react'
import { convertNestToCss } from './convertNestToCss'

const seed = `.parent {
  color: red;

  .child {
    color: blue;
  }

  &:hover {
    color: green;
  }
}

@media (min-width: 600px) {
  .card {
    padding: 12px;
    .title {
      font-weight: 700;
    }
  }
}`

export default function App() {
  const [input, setInput] = useState(seed)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const convert = useMemo(() => convertNestToCss, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setError(null)
        setOutput(convert(input))
      } catch (e) {
        setOutput('')
        setError(e instanceof Error ? e.message : String(e))
      }
    }, 200)
    return () => window.clearTimeout(t)
  }, [input, convert])

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="title">CSS Nesting 轉換器</div>
          <div className="hint">左邊貼 nesting CSS，右邊自動顯示轉換後結果（盡量涵蓋常見 nesting 寫法）</div>
        </div>
        <div className="hint">{error ? `轉換錯誤：${error}` : '即時轉換中…'}</div>
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panelHeader">
            <strong>Nesting CSS</strong>
            <span>input</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panelHeader">
            <strong>Plain CSS</strong>
            <span>output</span>
          </div>
          <textarea
            value={error ? `// 轉換失敗：\n// ${error}\n` : output}
            readOnly
            spellCheck={false}
            placeholder="等待轉換…"
            className="placeholder"
          />
        </section>
      </div>
    </div>
  )
}

