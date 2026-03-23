import { describe, expect, it } from 'vitest'
import { convertNestToCss } from './convertNestToCss'

describe('convertNestToCss', () => {
  it('展開巢狀 selector（含 declarations + 子規則）', () => {
    const input = `.parent { color: red; .child { color: blue; } }`
    const out = convertNestToCss(input)
    expect(out).toContain(`.parent {\n  color: red;\n}`)
    expect(out).toContain(`.parent .child {\n  color: blue;\n}`)
  })

  it('預設會移除註解', () => {
    const input = `.parent {
  color: red;
  /* c */
  .child { color: blue; }
}`
    const out = convertNestToCss(input)
    expect(out).not.toContain('/* c */')
    expect(out).toContain('.parent .child')
  })

  it('支援 &（parent selector reference）', () => {
    const input = `.a { &:hover { color: red; } }`
    const out = convertNestToCss(input)
    expect(out).toContain(`.a:hover {\n  color: red;\n}`)
  })

  it('支援逗號 selector list', () => {
    const input = `.a, .c { .b { color: blue; } }`
    const out = convertNestToCss(input)
    // Order matters here: we expect both combined.
    expect(out).toContain(`.a .b, .c .b {\n  color: blue;\n}`)
  })

  it('支援 @media 包裹', () => {
    const input = `@media (min-width: 600px) { .a { color: red; } }`
    const out = convertNestToCss(input)
    expect(out).toContain(`@media (min-width: 600px) {`)
    expect(out).toContain(`  .a {\n    color: red;\n  }`)
  })

  it('preserveComments: 保留註解且不破壞 selector 標頭解析/換行', () => {
    const input = `.parent {
  color: red;
  /* c */
  .child {
    color: blue;
  }
}`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain(`.parent {\n  color: red;\n  /* c */\n}`)
    expect(out).toContain(`.parent .child {\n  color: blue;\n}`)
  })

  it('preserveComments: 支援 line comment（//）並保留換行', () => {
    const input = `.parent {
  color: red;
  // c
  .child {
    color: blue;
  }
}`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain(`.parent {\n  color: red;\n  // c\n}`)
    expect(out).toContain(`.parent .child {\n  color: blue;\n}`)
  })

  it('preserveComments: 註解內含 { } 不會破壞解析', () => {
    const input = `.parent {
  /* comment { not-a-block } */
  color: red;
  .child { color: blue; }
}`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain('/* comment { not-a-block } */')
    expect(out).toContain('.parent .child')
  })

  it('preserveComments: css 語法外（depth=0）註解也要保留', () => {
    const input = `/* top */
.a { color: red; }
/* between */
.b { color: blue; }
// end-line
`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain('/* top */')
    expect(out).toContain('.a {')
    expect(out).toContain('/* between */')
    expect(out).toContain('.b {')
    expect(out).toContain('// end-line')
    // Rough ordering check: top before .a, between before .b, end after .b
    expect(out.indexOf('/* top */')).toBeLessThan(out.indexOf('.a {'))
    expect(out.indexOf('/* between */')).toBeLessThan(out.indexOf('.b {'))
    expect(out.indexOf('// end-line')).toBeGreaterThan(out.indexOf('.b {'))
  })

  it('preserveComments: 註解在 selector 與 { 之間（保持在 { 前）', () => {
    const input = `.parent {
  .child /* c */ {
    color: blue;
  }
}`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain(`.parent .child /* c */ {\n  color: blue;\n}`)
  })

  it('preserveComments: 註解在 @media 與 { 之間', () => {
    const input = `@media (min-width: 600px) /* mq */ { .a { color: red; } }`

    const out = convertNestToCss(input, { preserveComments: true })
    expect(out).toContain(`@media (min-width: 600px) /* mq */ {`)
    expect(out).toContain(`  .a {\n    color: red;\n  }\n`)
  })

  it('pretty 輸出保留宣告區塊內刻意空行', () => {
    const input = `.a {
  color: red;


  padding: 0;
  .b { color: blue; }
}`
    const out = convertNestToCss(input)
    expect(out).toContain('  color: red;\n\n\n  padding: 0;')
  })
})

