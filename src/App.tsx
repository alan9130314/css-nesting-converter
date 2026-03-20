import React, { useEffect, useMemo, useRef, useState } from 'react'
import { convertNestToCss } from './convertNestToCss'
import Prism from 'prismjs'
import 'prismjs/components/prism-css'
import { LOCALE_STORAGE_KEY, getInitialLocale, t, type Locale } from './i18n'

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
  const [copied, setCopied] = useState(false)

  const [locale, setLocale] = useState<Locale>(() => getInitialLocale())

  type Theme = 'light' | 'dark'
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = window.localStorage.getItem('theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }, [locale])

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
    ? `// ${t(locale, 'app.error.outputMain')}\n// ${error}\n`
    : output

  const canCopy = displayOutput.trim().length > 0

  async function copyTextToClipboard(text: string) {
    // Prefer modern clipboard API, fallback for older browsers.
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  const handleCopy = async () => {
    if (!canCopy) return
    try {
      await copyTextToClipboard(displayOutput)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // No-op: copying failed (permissions/unsupported browser).
    }
  }

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
          <div className="title">{t(locale, 'app.title')}</div>
          <div className="hint">{t(locale, 'app.header.hint')}</div>
        </div>
        <div className="rightBar">
          <div className="hint">
            {error
              ? `${t(locale, 'app.status.conversionErrorPrefix')}${error}`
              : t(locale, 'app.status.converting')}
          </div>
          <select
            className="langSelect"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t(locale, 'app.language.label')}
          >
            <option value="zh-TW">{t('zh-TW', 'lang.zh-TW')}</option>
            <option value="en">{t('en', 'lang.en')}</option>
          </select>
          <button
            type="button"
            className="themeToggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={t(locale, 'app.theme.toggleAriaLabel')}
          >
            {theme === 'dark' ? t(locale, 'theme.switchToLightLabel') : t(locale, 'theme.switchToDarkLabel')}
          </button>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panelHeader">
            <strong>{t(locale, 'panel.nesting.header')}</strong>
            <span>{t(locale, 'panel.nesting.subheader')}</span>
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
            <strong>{t(locale, 'panel.output.header')}</strong>
            <div className="panelHeaderRight">
              <span>{t(locale, 'panel.output.subheader')}</span>
              <button
                type="button"
                className="copyButton"
                onClick={handleCopy}
                disabled={!canCopy}
                aria-label={t(locale, 'panel.output.copyButtonAriaLabel')}
              >
                {copied ? t(locale, 'panel.output.copyCopiedLabel') : t(locale, 'panel.output.copyButtonLabel')}
              </button>
            </div>
          </div>
          <pre className="codeArea">
            {displayOutput ? (
              <code
                className="language-css"
                // Prism generates safe escaped HTML.
                dangerouslySetInnerHTML={{ __html: highlightedOutput }}
              />
            ) : (
              <span className="codePlaceholder">{t(locale, 'app.codePlaceholder')}</span>
            )}
          </pre>
        </section>
      </div>
    </div>
  )
}

