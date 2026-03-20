export const LOCALE_STORAGE_KEY = 'locale'

export const AVAILABLE_LOCALES = ['zh-TW', 'en'] as const

export type Locale = (typeof AVAILABLE_LOCALES)[number]

export const MESSAGES = {
  'zh-TW': {
    'app.title': 'CSS Nesting 轉換器',
    'app.header.hint':
      '左邊貼 nesting CSS，右邊自動顯示轉換後結果（盡量涵蓋常見 nesting 寫法）',
    'app.status.converting': '即時轉換中…',
    'app.status.conversionErrorPrefix': '轉換錯誤：',
    'app.codePlaceholder': '等待轉換…',
    'app.error.outputMain': '轉換失敗：',

    'panel.nesting.header': 'Nesting CSS',
    'panel.nesting.subheader': 'input',
    'panel.output.header': 'Plain CSS',
    'panel.output.subheader': 'output',

    'app.theme.toggleAriaLabel': '切換主題',
    'theme.switchToLightLabel': '亮色',
    'theme.switchToDarkLabel': '暗色',

    'app.language.label': '語言',
    'lang.zh-TW': '中文（繁體）',
    'lang.en': 'English',
  },
  en: {
    'app.title': 'CSS Nesting Converter',
    'app.header.hint':
      'Paste nesting CSS on the left; the plain CSS result will update on the right (covers common nesting patterns).',
    'app.status.converting': 'Converting live…',
    'app.status.conversionErrorPrefix': 'Conversion error: ',
    'app.codePlaceholder': 'Waiting for conversion…',
    'app.error.outputMain': 'Conversion failed:',

    'panel.nesting.header': 'Nesting CSS',
    'panel.nesting.subheader': 'input',
    'panel.output.header': 'Plain CSS',
    'panel.output.subheader': 'output',

    'app.theme.toggleAriaLabel': 'Toggle theme',
    'theme.switchToLightLabel': 'Light',
    'theme.switchToDarkLabel': 'Dark',

    'app.language.label': 'Language',
    'lang.zh-TW': 'Chinese (Traditional)',
    'lang.en': 'English',
  },
} as const

export type MessageKey = keyof typeof MESSAGES['zh-TW']

function isLocale(value: string): value is Locale {
  return (AVAILABLE_LOCALES as readonly string[]).includes(value)
}

function detectLocaleFromBrowser(): Locale {
  const navLang = typeof navigator !== 'undefined' ? navigator.language : ''
  const lang = navLang.toLowerCase()
  if (lang.startsWith('en')) return 'en'
  if (lang.startsWith('zh')) return 'zh-TW'
  return 'en'
}

export function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'

  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (saved && isLocale(saved)) return saved

  return detectLocaleFromBrowser()
}

export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key]
}

