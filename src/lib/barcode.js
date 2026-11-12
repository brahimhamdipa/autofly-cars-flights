// Barcode helpers for Yently Admin (barcode generator).
// No dependencies, plain ES modules. EAN-13 is the default format
// (internal-use prefix 200-299); Code 128-B is supported for
// existing mixed-length printable-ASCII barcodes.

const EAN13_LENGTH = 13
const EAN13_BODY_LENGTH = 12

// Standard EAN-13 encoding tables (7 modules per digit).
const L_CODE = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011', // 9
]
const G_CODE = [
  '0100111', // 0
  '0110011', // 1
  '0011011', // 2
  '0100001', // 3
  '0011101', // 4
  '0111001', // 5
  '0000101', // 6
  '0010001', // 7
  '0001001', // 8
  '0010111', // 9
]
const R_CODE = [
  '1110010', // 0
  '1100110', // 1
  '1101100', // 2
  '1000010', // 3
  '1011100', // 4
  '1001110', // 5
  '1010000', // 6
  '1000100', // 7
  '1001000', // 8
  '1110100', // 9
]

// Parity of the left six digits, chosen by the first digit.
// L = odd parity, G = even parity.
const FIRST_DIGIT_PARITY = [
  'LLLLLL', // 0
  'LLGLGG', // 1
  'LLGGLG', // 2
  'LLGGGL', // 3
  'LGLLGG', // 4
  'LGGLLG', // 5
  'LGGGLL', // 6
  'LGLGLG', // 7
  'LGLGGL', // 8
  'LGGLGL', // 9
]

const EAN13_RE = /^\d{13}$/
const EAN13_BODY_RE = /^\d{12}$/

function assertEan13Body(first12) {
  if (typeof first12 !== 'string' || !EAN13_BODY_RE.test(first12)) {
    throw new Error('ean13CheckDigit expects a 12-digit string')
  }
}

/**
 * Check digit for the first 12 digits of an EAN-13 code.
 * Weights alternate 1, 3 from the left; the check digit makes the
 * weighted sum of all 13 digits a multiple of 10.
 */
export function ean13CheckDigit(first12) {
  assertEan13Body(first12)
  let sum = 0
  for (let i = 0; i < EAN13_BODY_LENGTH; i++) {
    const digit = first12.charCodeAt(i) - 48
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return String((10 - (sum % 10)) % 10)
}

/** True only for a 13-digit string whose check digit is correct. */
export function isValidEan13(code) {
  if (typeof code !== 'string' || !EAN13_RE.test(code)) return false
  return ean13CheckDigit(code.slice(0, 12)) === code[12]
}

function randomDigits(count) {
  const digits = []
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    // One random byte per digit; modulo 10 is fine here (uniqueness
    // comes from the 9+ random digits, not from perfect uniformity).
    const bytes = new Uint8Array(count)
    cryptoObj.getRandomValues(bytes)
    for (let i = 0; i < count; i++) digits.push(String(bytes[i] % 10))
  } else {
    for (let i = 0; i < count; i++) digits.push(String(Math.floor(Math.random() * 10)))
  }
  return digits.join('')
}

/**
 * Generate a fresh valid EAN-13 code. `prefix` defaults to '200'
 * (GS1 internal-use range 200-299, so generated codes can never
 * collide with a real manufacturer's barcode). The prefix must be
 * 1-12 digits; the rest is filled with random digits.
 */
export function generateEan13(prefix = '200') {
  if (typeof prefix !== 'string' || !/^\d{1,12}$/.test(prefix)) {
    throw new Error("generateEan13 expects a numeric prefix of 1-12 digits")
  }
  const body = prefix + randomDigits(EAN13_BODY_LENGTH - prefix.length)
  return body + ean13CheckDigit(body)
}

/**
 * Guess which barcode format the existing values use, so the Admin
 * generator defaults to the same format instead of mixing formats
 * in one store.
 */
export function inferBarcodeFormat(codes) {
  const list = Array.isArray(codes) ? codes.filter((c) => typeof c === 'string' && c.length > 0) : []
  if (list.length === 0) {
    return { kind: 'none', note: 'No existing barcodes — defaulting to EAN-13.' }
  }
  const ean13Count = list.filter((c) => EAN13_RE.test(c) && isValidEan13(c)).length
  if (ean13Count * 2 >= list.length) {
    return { kind: 'ean13', note: 'Most existing barcodes are EAN-13 — defaulting to EAN-13.' }
  }
  const printableAscii = /^[\x20-\x7E]+$/
  const allPrintable = list.every((c) => printableAscii.test(c))
  const distinctLengths = new Set(list.map((c) => c.length)).size
  if (allPrintable && distinctLengths > 1) {
    return { kind: 'code128', note: 'Existing barcodes are mixed-length text — defaulting to Code 128.' }
  }
  return { kind: 'other', note: 'Existing barcodes use a mixed or unrecognised format — defaulting to EAN-13.' }
}

/**
 * Full EAN-13 bar pattern as a string of '1' (bar) / '0' (space),
 * exactly 95 modules: start guard (101), left six digits (L/G by
 * first-digit parity), center guard (01010), right six digits (R),
 * end guard (101). Quiet zones are NOT included.
 */
export function ean13Modules(code) {
  if (!isValidEan13(code)) {
    throw new Error('ean13Modules expects a valid 13-digit EAN-13 code')
  }
  const parity = FIRST_DIGIT_PARITY[code.charCodeAt(0) - 48]
  let modules = '101'
  for (let i = 0; i < 6; i++) {
    const digit = code.charCodeAt(i + 1) - 48
    modules += parity[i] === 'L' ? L_CODE[digit] : G_CODE[digit]
  }
  modules += '01010'
  for (let i = 0; i < 6; i++) {
    modules += R_CODE[code.charCodeAt(i + 7) - 48]
  }
  modules += '101'
  return modules
}

// ---------------------------------------------------------------------------
// Code 128-B
// ---------------------------------------------------------------------------
// Each symbol is 11 modules wide (bar/space widths, starting and
// ending with a bar). Values 0-94 are ASCII 32-126 (value = code - 32);
// 95 is DEL (127). Start B = 104, Stop = 106 (13 modules wide,
// including the trailing bar). Checksum = (start + sum(value * position))
// mod 103, position counted from 1 for the first data character.
const CODE128_WIDTHS = [
  [2, 1, 2, 2, 2, 2], // 0
  [2, 2, 2, 1, 2, 2], // 1
  [2, 2, 2, 2, 2, 1], // 2
  [1, 2, 1, 2, 2, 3], // 3
  [1, 2, 1, 3, 2, 2], // 4
  [1, 3, 1, 2, 2, 2], // 5
  [1, 2, 2, 2, 1, 3], // 6
  [1, 2, 2, 3, 1, 2], // 7
  [1, 3, 2, 2, 1, 2], // 8
  [2, 2, 1, 2, 1, 3], // 9
  [2, 2, 1, 3, 1, 2], // 10
  [2, 3, 1, 2, 1, 2], // 11
  [1, 1, 2, 2, 3, 2], // 12
  [1, 2, 2, 1, 3, 2], // 13
  [1, 2, 2, 2, 3, 1], // 14
  [1, 1, 3, 2, 2, 2], // 15
  [1, 2, 3, 1, 2, 2], // 16
  [1, 2, 3, 2, 2, 1], // 17
  [2, 2, 3, 2, 1, 1], // 18
  [2, 2, 1, 1, 3, 2], // 19
  [2, 2, 1, 2, 3, 1], // 20
  [2, 1, 3, 2, 1, 2], // 21
  [2, 2, 3, 1, 1, 2], // 22
  [3, 1, 2, 1, 3, 1], // 23
  [3, 1, 1, 2, 2, 2], // 24
  [3, 2, 1, 1, 2, 2], // 25
  [3, 2, 1, 2, 2, 1], // 26
  [3, 1, 2, 2, 1, 2], // 27
  [3, 2, 2, 1, 1, 2], // 28
  [3, 2, 2, 2, 1, 1], // 29
  [2, 1, 2, 1, 2, 3], // 30
  [2, 1, 2, 3, 2, 1], // 31
  [2, 3, 2, 1, 2, 1], // 32
  [1, 1, 1, 3, 2, 3], // 33
  [1, 3, 1, 1, 2, 3], // 34
  [1, 3, 1, 3, 2, 1], // 35
  [1, 1, 2, 3, 1, 3], // 36
  [1, 3, 2, 1, 1, 3], // 37
  [1, 3, 2, 3, 1, 1], // 38
  [2, 1, 1, 3, 1, 3], // 39
  [2, 3, 1, 1, 1, 3], // 40
  [2, 3, 1, 3, 1, 1], // 41
  [1, 1, 2, 1, 3, 3], // 42
  [1, 1, 2, 3, 3, 1], // 43
  [1, 3, 2, 1, 3, 1], // 44
  [1, 1, 3, 1, 2, 3], // 45
  [1, 1, 3, 3, 2, 1], // 46
  [1, 3, 3, 1, 2, 1], // 47
  [3, 1, 3, 1, 2, 1], // 48
  [2, 1, 1, 3, 3, 1], // 49
  [2, 3, 1, 1, 3, 1], // 50
  [2, 1, 3, 1, 1, 3], // 51
  [2, 1, 3, 3, 1, 1], // 52
  [2, 1, 3, 1, 3, 1], // 53
  [3, 1, 1, 1, 2, 3], // 54
  [3, 1, 1, 3, 2, 1], // 55
  [3, 3, 1, 1, 2, 1], // 56
  [3, 1, 2, 1, 1, 3], // 57
  [3, 1, 2, 3, 1, 1], // 58
  [3, 3, 2, 1, 1, 1], // 59
  [3, 1, 4, 1, 1, 1], // 60
  [2, 2, 1, 4, 1, 1], // 61
  [4, 3, 1, 1, 1, 1], // 62
  [1, 1, 1, 2, 2, 4], // 63
  [1, 1, 1, 4, 2, 2], // 64
  [1, 2, 1, 1, 2, 4], // 65
  [1, 2, 1, 4, 2, 1], // 66
  [1, 4, 1, 1, 2, 2], // 67
  [1, 4, 1, 2, 2, 1], // 68
  [1, 1, 2, 2, 1, 4], // 69
  [1, 1, 2, 4, 1, 2], // 70
  [1, 2, 2, 1, 1, 4], // 71
  [1, 2, 2, 4, 1, 1], // 72
  [1, 4, 2, 1, 1, 2], // 73
  [1, 4, 2, 2, 1, 1], // 74
  [2, 4, 1, 2, 1, 1], // 75
  [2, 2, 1, 1, 1, 4], // 76
  [4, 1, 3, 1, 1, 1], // 77
  [2, 4, 1, 1, 1, 2], // 78
  [1, 3, 4, 1, 1, 1], // 79
  [1, 1, 1, 2, 4, 2], // 80
  [1, 2, 1, 1, 4, 2], // 81
  [1, 2, 1, 2, 4, 1], // 82
  [1, 1, 4, 2, 1, 2], // 83
  [1, 2, 4, 1, 1, 2], // 84
  [1, 2, 4, 2, 1, 1], // 85
  [4, 1, 1, 2, 1, 2], // 86
  [4, 2, 1, 1, 1, 2], // 87
  [4, 2, 1, 2, 1, 1], // 88
  [2, 1, 2, 1, 4, 1], // 89
  [2, 1, 4, 1, 2, 1], // 90
  [4, 1, 2, 1, 2, 1], // 91
  [1, 1, 1, 1, 4, 3], // 92
  [1, 1, 1, 3, 4, 1], // 93
  [1, 3, 1, 1, 4, 1], // 94
  [1, 1, 4, 1, 1, 3], // 95
  [1, 1, 4, 3, 1, 1], // 96
  [4, 1, 1, 1, 1, 3], // 97
  [4, 1, 1, 3, 1, 1], // 98
  [1, 1, 3, 1, 4, 1], // 99
  [1, 1, 4, 1, 3, 1], // 100
  [3, 1, 1, 1, 4, 1], // 101
  [4, 1, 1, 1, 3, 1], // 102
  [2, 1, 1, 4, 1, 2], // 103 Start A
  [2, 1, 1, 2, 1, 4], // 104 Start B
  [2, 1, 1, 2, 3, 2], // 105 Start C
]
const CODE128_STOP_WIDTHS = [2, 3, 3, 1, 1, 1, 2] // 13 modules, ends with a bar
const CODE128_START_B = 104
const CODE128_STOP = 106

function widthsToModules(widths) {
  let out = ''
  for (let i = 0; i < widths.length; i++) {
    out += (i % 2 === 0 ? '1' : '0').repeat(widths[i])
  }
  return out
}

function code128CharValue(ch) {
  const code = ch.charCodeAt(0)
  if (code >= 32 && code <= 126) return code - 32
  if (code === 127) return 95
  return -1
}

/**
 * Code 128-B bar pattern as a string of '1'/'0': Start B, one symbol
 * per character, the mod-103 checksum symbol, then Stop (13 modules).
 * Quiet zones are NOT included. Throws on empty input or characters
 * outside printable ASCII (32-127).
 */
export function code128Modules(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('code128Modules expects a non-empty string')
  }
  const values = []
  for (const ch of code) {
    const value = code128CharValue(ch)
    if (value < 0) throw new Error('Code 128-B supports printable ASCII only')
    values.push(value)
  }
  let checksum = CODE128_START_B
  for (let i = 0; i < values.length; i++) checksum += values[i] * (i + 1)
  checksum %= 103
  let modules = widthsToModules(CODE128_WIDTHS[CODE128_START_B])
  for (const value of values) modules += widthsToModules(CODE128_WIDTHS[value])
  modules += widthsToModules(CODE128_WIDTHS[checksum])
  modules += widthsToModules(CODE128_STOP_WIDTHS)
  return modules
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg'

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Runs of '1' in a module string -> <rect> per black bar.
function modulesToRects(modules, moduleWidth, barX0, barY, barHeight) {
  let rects = ''
  let i = 0
  while (i < modules.length) {
    if (modules[i] === '1') {
      let j = i
      while (j < modules.length && modules[j] === '1') j++
      const x = (barX0 + i * moduleWidth).toFixed(2)
      const w = ((j - i) * moduleWidth).toFixed(2)
      rects += `<rect x="${x}" y="${barY}" width="${w}" height="${barHeight}" fill="#000"/>`
      i = j
    } else {
      i++
    }
  }
  return rects
}

/**
 * Complete standalone SVG string for a barcode, usable as an <img>
 * src (data URI), for Blob download, and for print.
 *
 * opts: { width = 240, height = 110, kind } — kind is 'ean13'
 * (default) or 'code128'. When kind is omitted, a valid EAN-13 code
 * renders as EAN-13, anything else printable renders as Code 128-B.
 * EAN-13 prints the first digit left of the bars and the two groups
 * of six under their bars; Code 128 prints the whole value centred
 * under the bars.
 */
export function barcodeSvg(code, opts = {}) {
  const width = opts.width || 240
  const height = opts.height || 110
  const kind = opts.kind || (isValidEan13(code) ? 'ean13' : 'code128')
  let modules
  let textParts // [{ text, cx }] — cx in absolute module coordinates
  // (quiet zone included: bars start at module 10)
  if (kind === 'ean13') {
    modules = ean13Modules(code) // throws unless valid EAN-13
    textParts = [
      { text: code[0], cx: 5 }, // first digit, centred in the left quiet zone
      { text: code.slice(1, 7), cx: 10 + 3 + 21 }, // left group, centred under its bars
      { text: code.slice(7), cx: 10 + 3 + 42 + 5 + 21 }, // right group
    ]
  } else if (kind === 'code128') {
    modules = code128Modules(code) // throws unless printable ASCII
    textParts = [{ text: code, cx: 10 + modules.length / 2 }]
  } else {
    throw new Error(`Unsupported barcode kind: ${kind}`)
  }

  const quietModules = 10
  const totalModules = modules.length + quietModules * 2
  const moduleWidth = width / totalModules
  const fontSize = Math.max(10, Math.round(height * 0.15))
  const textHeight = fontSize + 6
  const barHeight = height - textHeight - 4
  const barY = 2
  const textY = barY + barHeight + fontSize
  const rects = modulesToRects(modules, moduleWidth, quietModules * moduleWidth, barY, barHeight)
  const texts = textParts
    .map(({ text, cx }) => {
      const x = (cx * moduleWidth).toFixed(2)
      return `<text x="${x}" y="${textY}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="#000">${escapeXml(text)}</text>`
    })
    .join('')
  return `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" fill="#fff"/>${rects}${texts}</svg>`
}
