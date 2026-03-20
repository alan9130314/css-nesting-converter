import { describe, expect, it } from 'vitest'
import { convertNestToCss } from './convertNestToCss'

describe('convertNestToCss', () => {
  it('展開巢狀 selector（含 declarations + 子規則）', () => {
    const input = `.parent { color: red; .child { color: blue; } }`
    const out = convertNestToCss(input)
    expect(out).toContain(`.parent {\n  color: red;\n}`)
    expect(out).toContain(`.parent .child {\n  color: blue;\n}`)
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
})

