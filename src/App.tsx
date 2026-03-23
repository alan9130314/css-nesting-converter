import React, { useEffect, useMemo, useRef, useState } from 'react'
import { convertNestToCss } from './convertNestToCss'
import Prism from 'prismjs'
import 'prismjs/components/prism-css'
import { LOCALE_STORAGE_KEY, getInitialLocale, t, type Locale } from './i18n'

const CSS_LANGUAGE = 'css' as const

const seed = `
/* CSS Nesting Converter */
.parent {
  color: red;
  /* This is a comment */
  .child {
    color: blue;
  }
  /* This is another comment */
  &:hover {
    color: green;
  }
}
/* Media Query */
@media (min-width: 600px) {
  /* Media Query Content */
  .card {
    padding: 12px;
    .title {
      /* Title Content */
      font-weight: 700;
    }
  }
}`

function minifyCss(css: string): string {
  // Intentionally simple/minimal: it removes whitespace around structural tokens.
  // It doesn't try to fully parse values (e.g. url()/calc() edge cases), but works
  // well for the CSS this converter emits.
  let s = css.trim()
  s = s.replace(/[\r\n\t]+/g, '')
  s = s.replace(/\s+/g, ' ')
  s = s.replace(/\s*\{\s*/g, '{')
  s = s.replace(/\s*\}\s*/g, '}')
  s = s.replace(/\s*;\s*/g, ';')
  s = s.replace(/\s*,\s*/g, ',')
  s = s.replace(/\s*:\s*/g, ':')
  s = s.replace(/;}/g, '}')
  return s.trim()
}

export default function App() {
  const [input, setInput] = useState(seed)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  type OutputFormat = 'pretty' | 'minified'
  const [format, setFormat] = useState<OutputFormat>('pretty')
  const [preserveComments, setPreserveComments] = useState(true)

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
  const outputHighlightRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setError(null)
        setOutput(convert(input, { preserveComments }))
      } catch (e) {
        setOutput('')
        setError(e instanceof Error ? e.message : String(e))
      }
    }, 200)
    return () => window.clearTimeout(t)
  }, [input, convert, preserveComments])

  const displayOutput = error
    ? `// ${t(locale, 'app.error.outputMain')}\n// ${error}\n// ${t(locale, 'app.error.syntaxHint')}\n`
    : format === 'minified'
      ? minifyCss(output)
      : output

  const downloadText = error ? '' : format === 'minified' ? minifyCss(output) : output

  useEffect(() => {
    // Reset "copied" state whenever the displayed output changes.
    setCopied(false)
  }, [displayOutput])

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

  const canDownload = downloadText.trim().length > 0

  const handleDownload = () => {
    if (!canDownload) return
    const blob = new Blob([downloadText], { type: 'text/css;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plain.css'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const highlightedInput = useMemo(() => {
    return Prism.highlight(input || '', Prism.languages[CSS_LANGUAGE], CSS_LANGUAGE)
  }, [input])

  const highlightedOutput = useMemo(() => {
    return Prism.highlight(displayOutput, Prism.languages[CSS_LANGUAGE], CSS_LANGUAGE)
  }, [displayOutput])

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
          <div className="panelFooter" aria-hidden="true" />
        </section>

        <section className="panel">
          <div className="panelHeader">
            <strong>{t(locale, 'panel.output.header')}</strong>
              <div className="panelHeaderRight">
              <span>{t(locale, 'panel.output.subheader')}</span>
            </div>
          </div>
          {displayOutput ? (
            <div className="codeEditor outputCodeEditor">
              <pre
                className="highlightLayer"
                ref={outputHighlightRef}
                aria-hidden="true"
              >
                <code
                  className="language-css"
                  dangerouslySetInnerHTML={{ __html: highlightedOutput }}
                />
              </pre>
              <textarea
                value={displayOutput}
                readOnly
                spellCheck={false}
                wrap="off"
                className="inputLayer outputTextArea"
                onScroll={(e) => {
                  const t = e.currentTarget
                  if (!outputHighlightRef.current) return
                  outputHighlightRef.current.scrollTop = t.scrollTop
                  outputHighlightRef.current.scrollLeft = t.scrollLeft
                }}
              />
            </div>
          ) : (
            <div className="codeArea">
              <span className="codePlaceholder">{t(locale, 'app.codePlaceholder')}</span>
            </div>
          )}
          <div className="panelFooter">
            <div className="panelFooterLeft">
              <select
                className="formatSelect"
                value={preserveComments ? 'preserve' : 'remove'}
                onChange={(e) => setPreserveComments(e.target.value === 'preserve')}
                aria-label={t(locale, 'panel.output.commentsSelectAriaLabel')}
              >
                <option value="preserve">{t(locale, 'panel.output.comments.preserve')}</option>
                <option value="remove">{t(locale, 'panel.output.comments.remove')}</option>
              </select>
              <select
                className="formatSelect"
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                aria-label={t(locale, 'panel.output.formatSelectAriaLabel')}
              >
                <option value="pretty">{t(locale, 'panel.output.format.pretty')}</option>
                <option value="minified">{t(locale, 'panel.output.format.minified')}</option>
              </select>
            </div>
            <div className="panelFooterRight">
              <button
                type="button"
                className="copyButton downloadButton"
                onClick={handleDownload}
                disabled={!canDownload}
                aria-label={t(locale, 'panel.output.downloadButtonAriaLabel')}
              >
                {t(locale, 'panel.output.downloadButtonLabel')}
              </button>
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
        </section>
      </div>
    </div>
  )
}

