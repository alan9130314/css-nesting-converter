#DEMO: https://alan9130314.github.io/css-nesting-converter/

# CSS Nesting 轉換器

把「CSS nesting 寫法」展開成一般（平面）CSS。

這個專案同時提供：
- Web UI：左邊貼 nesting CSS，右邊即時顯示轉換後的 plain CSS
- 核心函式：`convertNestToCss(input)`（可被其他程式引用）

## 介面多語系（UI）

介面支援中文（繁體）/English 切換；若你未手動選過語言，預設會依瀏覽器 `navigator.language` 偵測自動切換；你選的語言會存到 `localStorage` 的 `locale`。

## 支援的 nesting 語法（目前的能力）

1. 巢狀 selector

```css
.parent {
  color: red;

  .child {
    color: blue;
  }
}
```

會展開成（大意）：
```css
.parent {
  color: red;
}
.parent .child {
  color: blue;
}
```

2. `&`（parent selector reference）

```css
.a {
  &:hover {
    color: red;
  }
}
```

會變成：
```css
.a:hover {
  color: red;
}
```

3. selector list（逗號分隔）

```css
.a, .c {
  .b {
    color: blue;
  }
}
```

會同時展開：
```css
.a .b, .c .b {
  color: blue;
}
```

4. 巢狀 at-rule（例如 `@media`）

```css
@media (min-width: 600px) {
  .a {
    color: red;
  }
}
```

會保留 `@media` 包覆，內部照樣展開 selector nesting。

## 安裝與啟動

```bash
npm install
npm run dev
```

預設用 Vite 啟動開發伺服器。

## 主題切換

介面有明亮/暗色兩種主題，預設是明亮；切換後會用 `localStorage` 記住你選的主題。

## 建置與預覽

```bash
npm run build
npm run preview
```

## 測試

```bash
npm test
```

目前測試主要涵蓋：巢狀 selector、`&`、逗號 selector list、`@media`。

## 直接使用核心轉換函式

`convertNestToCss` 定義在 `src/convertNestToCss.ts`，匯出函式如下：

```ts
import { convertNestToCss } from './src/convertNestToCss'

const input = `.parent { color: red; .child { color: blue; } }`
const output = convertNestToCss(input)
console.log(output)
```

## 輸入/輸出行為（快速重點）

- 輸入是一段 CSS 字串（含 nesting）
- 輸出是一般 CSS 字串（展開後），並加上基本縮排與換行
- 解析方式偏「字串/括號深度」的手工解析，因此遇到非常極端或規則不符合的 nesting/CSS 片段可能會失敗（此時 UI 會顯示錯誤訊息）

---

## English

# CSS Nesting Converter

Expand CSS nesting syntax into plain (flat) CSS.

This project provides:
- Web UI: paste nesting CSS on the left, and the plain CSS result updates live on the right
- Core function: `convertNestToCss(input)` (importable from other code)

## UI Language Support

The UI supports switching between Chinese (Traditional) and English. If you haven’t selected a language manually, the default is determined from your browser `navigator.language`. The chosen language is stored in `localStorage` under the key `locale`.

## Supported nesting syntax (current capabilities)

1. Nested selectors

```css
.parent {
  color: red;

  .child {
    color: blue;
  }
}
```

It will expand (roughly) to:

```css
.parent {
  color: red;
}
.parent .child {
  color: blue;
}
```

2. `&` (parent selector reference)

```css
.a {
  &:hover {
    color: red;
  }
}
```

It becomes:

```css
.a:hover {
  color: red;
}
```

3. Selector list (comma-separated)

```css
.a, .c {
  .b {
    color: blue;
  }
}
```

It expands both combinations:

```css
.a .b, .c .b {
  color: blue;
}
```

4. Nested at-rules (e.g. `@media`)

```css
@media (min-width: 600px) {
  .a {
    color: red;
  }
}
```

`@media` (or other at-rule) wrapping is preserved, while selector nesting inside still gets expanded.

## Installation and Run

```bash
npm install
npm run dev
```

The project uses Vite’s dev server by default.

## Theme Toggle

The UI has light/dark themes (light is the default). After switching, your choice is stored in `localStorage`.

## Build and Preview

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

Currently, tests mainly cover nested selectors, `&`, selector list, and `@media`.

## Use the core converter directly

`convertNestToCss` is defined in `src/convertNestToCss.ts` and exported as:

```ts
import { convertNestToCss } from './src/convertNestToCss'

const input = `.parent { color: red; .child { color: blue; } }`
const output = convertNestToCss(input)
console.log(output)
```

## Input / Output behavior (quick notes)

- Input is a CSS string (including nesting)
- Output is flat plain CSS (expanded) with basic indentation and newlines
- The parser uses heuristic string/braces-depth parsing, so extremely unusual or non-standard nesting/CSS snippets may fail (the UI will show an error message)

