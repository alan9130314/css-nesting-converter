type NodeKind = 'root' | 'rule' | 'atrule'

type CssNode = {
  kind: NodeKind
  header: string // selector or atrule prelude (e.g. "@media (...)")
  declarations: string[] // raw declaration text segments, already scoped to this block
  children: CssNode[]
}

function stripComments(css: string) {
  // block comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // line comments
  css = css.replace(/(^|[^:])\/\/.*$/gm, '$1')
  return css
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

function parseNestingCss(input: string): CssNode {
  const css = stripComments(input)

  const root: CssNode = { kind: 'root', header: '', declarations: [], children: [] }
  const stack: CssNode[] = [root]

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
      const headerStart = headerStartByDepth[depth]
      const header = css.slice(headerStart, i).trim()
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
      const node: CssNode = { kind, header, declarations: [], children: [] }
      stack[depth].children.push(node)
      stack.push(node)

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

  return root
}

function emitCss(node: CssNode, parentSelectors: string[], indentLevel: number): string {
  const indent = makeIndent(indentLevel)

  if (node.kind === 'root') {
    let out = ''
    for (const child of node.children) out += emitCss(child, [''], 0)
    return out.trim()
  }

  if (node.kind === 'rule') {
    const fullSelectors = expandSelectors(parentSelectors, node.header)
    const decls = node.declarations.join('\n').trim()

    let out = ''
    if (decls) {
      out += `${indent}${fullSelectors.join(', ')} {\n${formatDecls(decls, indentLevel + 1)}\n${indent}}\n`
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
  return `${indent}${node.header} {\n${inner.trimEnd()}\n${indent}}\n`
}

export function convertNestToCss(input: string): string {
  if (!input.trim()) return ''

  const root = parseNestingCss(input)
  const out = emitCss(root, [''], 0)
  const trimmed = out.trim()
  return trimmed ? trimmed + '\n' : ''
}

