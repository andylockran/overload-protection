#!/usr/bin/env node
'use strict'

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const PORT = parseInt(process.env.PORT || '3000', 10)

const layoutFile = path.join(rootDir, '_layouts', 'default.html')
const layoutTemplate = fs.readFileSync(layoutFile, 'utf8')

function escapeHtml (text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderPage (markdownContent, title = 'overload-protection') {
  let html = layoutTemplate
    .replace(/\{\{\s*site\.baseurl\s*\}\}/g, '')
    .replace(/\{\{\s*site\.title\s*\}\}/g, 'overload-protection')
    .replace(/\{\{\s*site\.description\s*\}\}/g, 'Automated load shedding and event loop guardrails for Node.js')
    .replace(/\{\{\s*page\.title\s*\|\s*default:\s*site\.title\s*\}\}/g, title)

  const injectedContent = `<div id="markdown-content" data-markdown="true" style="display:none;">${escapeHtml(markdownContent)}</div>`
  html = html.replace('{{ content }}', injectedContent)
  return html
}

const server = http.createServer((req, res) => {
  const rawPath = req.url.split('?')[0]
  const urlPath = rawPath.replace(/^\/overload-protection/, '') || '/'

  if (urlPath === '/' || urlPath === '/index.html') {
    const md = fs.readFileSync(path.join(rootDir, 'readme.md'), 'utf8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(renderPage(md, 'overload-protection - Documentation'))
  }

  if (urlPath.startsWith('/demos/')) {
    const filePath = path.join(rootDir, urlPath)
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return fs.createReadStream(filePath).pipe(res)
    }
  }

  if (urlPath.startsWith('/docs/')) {
    const baseName = path.basename(urlPath, '.html')
    const mdPath = path.join(rootDir, 'docs', `${baseName}.md`)
    if (fs.existsSync(mdPath)) {
      const md = fs.readFileSync(mdPath, 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(renderPage(md, `${baseName} - overload-protection`))
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('404 Not Found')
})

server.listen(PORT, () => {
  console.log(`\n🚀 Local GitHub Pages preview running at http://localhost:${PORT}`)
  console.log(`   🏠 Home / Docs:       http://localhost:${PORT}/`)
  console.log(`   📽️ Presentation Deck: http://localhost:${PORT}/demos/presentation.html`)
  console.log(`   🎮 Fleet Simulation:  http://localhost:${PORT}/demos/visualization.html`)
  console.log(`   📖 Architecture:      http://localhost:${PORT}/docs/architecture-and-why-it-matters.html`)
  console.log(`   ⚙️ Internals:         http://localhost:${PORT}/docs/event-loop-detection-and-internals.html`)
  console.log(`   📚 API Reference:     http://localhost:${PORT}/docs/api-reference.html\n`)
})
