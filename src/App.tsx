import React, { useEffect, useMemo, useRef, useState } from 'react'
import { convertNestToCss } from './convertNestToCss'
import Prism from 'prismjs'
import 'prismjs/components/prism-css'

const CSS_LANGUAGE = 'css' as const

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
  const inputTextAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputHighlightRef = useRef<HTMLPreElement | null>(null)

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

  const displayOutput = error
    ? `// 轉換失敗：\n// ${error}\n`
    : output

  const highlightedOutput = useMemo(() => {
    // Prism expects a raw string; it returns HTML with <span class="token ...">...
    return Prism.highlight(displayOutput, Prism.languages[CSS_LANGUAGE], CSS_LANGUAGE)
  }, [displayOutput])

  const highlightedInput = useMemo(() => {
    return Prism.highlight(input || '', Prism.languages[CSS_LANGUAGE], CSS_LANGUAGE)
  }, [input])

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
          <div className="codeEditor">
            <pre
              className="highlightLayer"
              ref={inputHighlightRef}
              aria-hidden="true"
            >
              <code
                className="language-css"
                dangerouslySetInnerHTML={{ __html: highlightedInput }}
              />
            </pre>
            <textarea
              ref={inputTextAreaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onScroll={(e) => {
                const t = e.currentTarget
                if (!inputHighlightRef.current) return
                inputHighlightRef.current.scrollTop = t.scrollTop
                inputHighlightRef.current.scrollLeft = t.scrollLeft
              }}
              spellCheck={false}
              className="inputLayer"
              wrap="off"
            />
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <strong>Plain CSS</strong>
            <span>output</span>
          </div>
          <pre className="codeArea">
            {displayOutput ? (
              <code
                className="language-css"
                // Prism generates safe escaped HTML.
                dangerouslySetInnerHTML={{ __html: highlightedOutput }}
              />
            ) : (
              <span className="codePlaceholder">等待轉換…</span>
            )}
          </pre>
        </section>
      </div>
    </div>
  )
}

