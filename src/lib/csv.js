// Turn an array of records into CSV text and trigger a browser download.
// columns: [{ label, value: (row) => cellValue }]

const escape = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((r) => columns.map((c) => escape(c.value(r))).join(','))
    .join('\r\n')
  return `${header}\r\n${body}`
}

export function downloadCsv(filename, rows, columns) {
  // A leading BOM so Excel opens UTF-8 (names with accents) correctly.
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
