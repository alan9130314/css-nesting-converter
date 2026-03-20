type NodeKind = 'root' | 'rule' | 'atrule'

type CssNode = {
  kind: NodeKind
  header: string // selector or atrule prelude (e.g. "@media (...)")
  // When preserveComments=true, comments that appear between selector/atrule
  // header and "{" are stored here, so we can emit them at the correct
  // position (right before "{") without polluting selector parsing.
  headerTrailing: string
  declarations: string[] // raw declaration text segments, already scoped to this block
  children: CssNode[]
  // Only used for root node:
  // raw text fragments at brace depth=0 that are not part of any parsed block.
  // We keep these so comments outside of any CSS rule/@rule are preserved.
  topLevelFragments?: string[]
}

export type ConvertNestToCssOptions = {
  // Default: false (keep current behavior: strip comments before parsing)
  preserveComments?: boolean
}

const COMMENT_PLACEHOLDER_PREFIX = '__NESTING_COMMENT_'
const COMMENT_PLACEHOLDER_SUFFIX = '__'

function stripComments(css: string) {
  // block comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // line comments
  css = css.replace(/(^|[^:])\/\/.*$/gm, '$1')
  return css
}

function replaceCommentsWithPlaceholders(input: string): { css: string; tokens: string[] } {
  const tokens: string[] = []
  let out = ''

  let inSingle = false
  let inDouble = false
  let escape = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (escape) {
      escape = false
      out += ch
      continue
    }

    if (inSingle) {
      out += ch
      if (ch === '\\') escape = true
      else if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      out += ch
      if (ch === '\\') escape = true
      else if (ch === '"') inDouble = false
      continue
    }

    if (ch === "'") {
      inSingle = true
      out += ch
      continue
    }
    if (ch === '"') {
      inDouble = true
      out += ch
      continue
    }

    // block comments: /* ... */
    if (ch === '/' && input[i + 1] === '*') {
      const end = input.indexOf('*/', i + 2)
      const comment = end === -1 ? input.slice(i) : input.slice(i, end + 2)
      const idx = tokens.push(comment) - 1
      out += `${COMMENT_PLACEHOLDER_PREFIX}${idx}${COMMENT_PLACEHOLDER_SUFFIX}`
      i = end === -1 ? input.length : end + 1
      continue
    }

    // line comments: // ... (but don't match http://)
    if (ch === '/' && input[i + 1] === '/') {
      const prev = i > 0 ? input[i - 1] : ''
      if (prev !== ':') {
        let j = i + 2
        while (j < input.length && input[j] !== '\n' && input[j] !== '\r') j++
        const comment = input.slice(i, j) // exclude newline chars
        const idx = tokens.push(comment) - 1
        out += `${COMMENT_PLACEHOLDER_PREFIX}${idx}${COMMENT_PLACEHOLDER_SUFFIX}`
        i = j - 1
        continue
      }
    }

    out += ch
  }

  return { css: out, tokens }
}

function restoreCommentsFromPlaceholders(css: string, tokens: string[]): string {
  return css.replace(
    new RegExp(`${COMMENT_PLACEHOLDER_PREFIX}(\\d+)${COMMENT_PLACEHOLDER_SUFFIX}`, 'g'),
    (_m, idxStr: string) => tokens[Number(idxStr)] ?? _m,
  )
}

function skipWhitespaceAndCommentPlaceholders(css: string, startIndex: number): number {
  let i = startIndex
  while (i < css.length) {
    const ch = css[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (css.startsWith(COMMENT_PLACEHOLDER_PREFIX, i)) {
      const suffixIdx = css.indexOf(COMMENT_PLACEHOLDER_SUFFIX, i + COMMENT_PLACEHOLDER_PREFIX.length)
      if (suffixIdx === -1) return i
      i = suffixIdx + COMMENT_PLACEHOLDER_SUFFIX.length
      continue
    }

    break
  }
  return i
}

function splitTopLevelCommas(s: string): string[] {
  // Split selector list by commas while respecting brackets/parentheses/quotes.
  const out: string[] = []
  let buf = ''
  let depthSquare = 0
  let depthParen = 0
  let quote: '"' | "'" | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      buf += ch
      if (ch === quote && s[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      buf += ch
      continue
    }
    if (ch === '[') depthSquare++
    if (ch === ']') depthSquare = Math.max(0, depthSquare - 1)
    if (ch === '(') depthParen++
    if (ch === ')') depthParen = Math.max(0, depthParen - 1)

    if (ch === ',' && depthSquare === 0 && depthParen === 0) {
      const part = buf.trim()
      if (part) out.push(part)
      buf = ''
      continue
    }
    buf += ch
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

function isRootParent(parentSelectors: string[]) {
  return parentSelectors.length === 1 && parentSelectors[0] === ''
}

function extractHeaderCoreAndTrailing(headerWithPlaceholders: string, preserveComments: boolean): { header: string; headerTrailing: string } {
  if (!preserveComments) return { header: headerWithPlaceholders.trim(), headerTrailing: '' }

  const firstPlaceholderIdx = headerWithPlaceholders.indexOf(COMMENT_PLACEHOLDER_PREFIX)
  if (firstPlaceholderIdx === -1) return { header: headerWithPlaceholders.trim(), headerTrailing: '' }

  const before = headerWithPlaceholders.slice(0, firstPlaceholderIdx)
  const header = before.trim()

  // Preserve exact whitespace between selector core and the first comment placeholder
  // (including newlines/indentation), so the emitted comment stays in the original location.
  const coreLen = header.length
  const coreEndGap = before.slice(coreLen)

  const headerTrailing = coreEndGap + headerWithPlaceholders.slice(firstPlaceholderIdx)
  return { header, headerTrailing }
}

function makeIndent(level: number) {
  return '  '.repeat(Math.max(0, level))
}

function formatDecls(decls: string, indentLevel: number) {
  const indent = makeIndent(indentLevel)
  return decls
    .split('\n')
    .map((line) => {
      const t = line.trim()
      return t ? `${indent}${t}` : ''
    })
    .join('\n')
}

function expandSelectors(parentSelectors: string[], childHeader: string): string[] {
  const childParts = splitTopLevelCommas(childHeader)
  if (parentSelectors.length === 0) return childParts
  const parentIsRoot = isRootParent(parentSelectors)

  const results: string[] = []
  for (const childPart of childParts) {
    const part = childPart.trim()
    if (!part) continue

    if (part.includes('&')) {
      for (const p of parentSelectors) {
        const expanded = part.replaceAll('&', p).trim()
        if (expanded) results.push(expanded)
      }
      continue
    }

    if (parentIsRoot) {
      results.push(part)
      continue
    }

    // Heuristic: if child already starts with a combinator, avoid extra whitespace.
    const noSpacePrefixes = ['>', '+', '~']
    const useNoSpace = noSpacePrefixes.some((x) => part.startsWith(x))
    const joiner = useNoSpace ? '' : ' '

    for (const p of parentSelectors) {
      const expanded = `${p}${joiner}${part}`.replace(/\s+/g, ' ').trim()
      if (expanded) results.push(expanded)
    }
  }

  // Preserve order but drop exact duplicates.
  const seen = new Set<string>()
  return results.filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
}

type ParseResult = {
  root: CssNode
  commentTokens: string[] | null
}

function parseNestingCss(input: string, options: { preserveComments: boolean }): ParseResult {
  let css = input
  let commentTokens: string[] | null = null
  if (options.preserveComments) {
    const replaced = replaceCommentsWithPlaceholders(input)
    css = replaced.css
    commentTokens = replaced.tokens
  } else {
    css = stripComments(input)
  }

  const root: CssNode = { kind: 'root', header: '', headerTrailing: '', declarations: [], children: [] }
  const stack: CssNode[] = [root]
  let rootOutsideCursor = 0
  if (options.preserveComments) root.topLevelFragments = []

  let depth = 0 // brace depth; root is depth=0
  const headerStartByDepth: number[] = []
  const segmentStartByDepth: number[] = []
  headerStartByDepth[0] = 0
  segmentStartByDepth[0] = 0

  let inSingle = false
  let inDouble = false
  let escape = false

  for (let i = 0; i < css.length; i++) {
    const ch = css[i]

    if (escape) {
      escape = false
      continue
    }

    if (inSingle) {
      if (ch === '\\') escape = true
      else if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '\\') escape = true
      else if (ch === '"') inDouble = false
      continue
    }

    if (ch === "'") {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }

    if (ch === '{') {
      const headerStartByRawDepth = headerStartByDepth[depth]
      const headerStart = options.preserveComments
        ? skipWhitespaceAndCommentPlaceholders(css, headerStartByRawDepth)
        : headerStartByRawDepth
      // IMPORTANT:
      // - preserveComments: do NOT trim, so we keep newline/spacing between
      //   selector header and "{" for accurate comment placement.
      // - strip mode: trimming is fine (existing behavior).
      const rawHeaderWithPlaceholders = css.slice(headerStart, i)
      const headerWithPlaceholders = options.preserveComments ? rawHeaderWithPlaceholders : rawHeaderWithPlaceholders.trim()
      const { header, headerTrailing } = extractHeaderCoreAndTrailing(headerWithPlaceholders, options.preserveComments)
      // Declarations for this block end right before the next nested selector header starts.
      // `headerStartByDepth[depth]` is updated after `;` (declaration boundary) and after `}` (child boundary).
      const declSegment = css.slice(segmentStartByDepth[depth], headerStart).trim()

      if (declSegment) {
        const parent = stack[depth]
        if (parent.kind !== 'root') parent.declarations.push(declSegment)
      }

      if (!header) {
        throw new Error('Malformed block: missing selector / @rule before "{"')
      }

      const kind: NodeKind = header.startsWith('@') ? 'atrule' : 'rule'
      const node: CssNode = { kind, header, headerTrailing, declarations: [], children: [] }
      stack[depth].children.push(node)
      stack.push(node)

      // Capture brace-depth=0 fragments that are outside any parsed top-level block.
      // This is mainly for comments placed at "file level" (outside any selector/@rule).
      if (options.preserveComments && depth === 0) {
        // `headerStart` is after skipping whitespace and comment placeholders.
        // So everything before `headerStart` at depth=0 is outside any parsed top-level block.
        const frag = css.slice(rootOutsideCursor, headerStart)
        root.topLevelFragments!.push(frag)
      }

      depth++
      segmentStartByDepth[depth] = i + 1
      headerStartByDepth[depth] = i + 1
      continue
    }

    if (ch === '}') {
      if (depth <= 0) {
        throw new Error('Unexpected "}" (unmatched closing brace)')
      }

      const node = stack[depth]
      if (!node) {
        throw new Error('Unexpected "}" (parse stack underflow)')
      }

      const declSegment = css.slice(segmentStartByDepth[depth], i).trim()
      if (declSegment) node.declarations.push(declSegment)
      stack.pop()
      depth = depth - 1
      segmentStartByDepth[depth] = i + 1
      headerStartByDepth[depth] = i + 1

      // When leaving a top-level block (depth goes from 1 -> 0),
      // advance the cursor so we can capture depth=0 fragments between blocks.
      if (options.preserveComments && depth === 0) {
        rootOutsideCursor = i + 1
      }
      continue
    }

    if (ch === ';' && depth >= 1) {
      // After a declaration ends, next nested rule selector (if any) starts after this.
      headerStartByDepth[depth] = i + 1
      continue
    }
  }

  if (depth !== 0) {
    throw new Error('Unclosed "{" (missing closing brace)')
  }

  if (options.preserveComments) {
    // Trailing depth=0 fragments after the last top-level block.
    root.topLevelFragments = root.topLevelFragments ?? []
    root.topLevelFragments.push(css.slice(rootOutsideCursor))
  }

  return { root, commentTokens }
}

function emitCss(node: CssNode, parentSelectors: string[], indentLevel: number): string {
  const indent = makeIndent(indentLevel)

  if (node.kind === 'root') {
    const fragments = node.topLevelFragments ?? ['']
    let out = ''
    for (let i = 0; i < node.children.length; i++) {
      out += fragments[i] ?? ''
      out += emitCss(node.children[i], [''], 0)
    }
    out += fragments[node.children.length] ?? ''
    return out.trim()
  }

  if (node.kind === 'rule') {
    const fullSelectors = expandSelectors(parentSelectors, node.header)
    const decls = node.declarations.join('\n').trim()

    let out = ''
    if (decls) {
      const betweenSelectorAndBrace = node.headerTrailing ? '' : ' '
      out += `${indent}${fullSelectors.join(', ')}${node.headerTrailing}${betweenSelectorAndBrace}{\n${formatDecls(decls, indentLevel + 1)}\n${indent}}\n`
    }

    for (const child of node.children) {
      out += emitCss(child, fullSelectors, indentLevel)
    }

    return out
  }

  // atrule
  const decls = node.declarations.join('\n').trim()
  const wrapParent = !isRootParent(parentSelectors)
  let inner = ''

  if (decls) {
    if (wrapParent) {
      const innerIndent = makeIndent(indentLevel + 1)
      inner += `${innerIndent}${parentSelectors.join(', ')} {\n${formatDecls(decls, indentLevel + 2)}\n${innerIndent}}\n`
    } else {
      inner += `${formatDecls(decls, indentLevel + 1)}\n`
    }
  }

  for (const child of node.children) {
    inner += emitCss(child, parentSelectors, indentLevel + 1)
  }

  if (!inner.trim()) return ''
  // For at-rule comments between "prelude" and "{", keep them before "{"
  const betweenPreludeAndBrace = node.headerTrailing ? '' : ' '
  return `${indent}${node.header}${node.headerTrailing}${betweenPreludeAndBrace}{\n${inner.trimEnd()}\n${indent}}\n`
}

export function convertNestToCss(input: string, options?: ConvertNestToCssOptions): string {
  if (!input.trim()) return ''
  const preserveComments = !!options?.preserveComments

  const { root, commentTokens } = parseNestingCss(input, { preserveComments })
  let out = emitCss(root, [''], 0)
  if (commentTokens) out = restoreCommentsFromPlaceholders(out, commentTokens)

  const trimmed = out.trim()
  return trimmed ? trimmed + '\n' : ''
}

