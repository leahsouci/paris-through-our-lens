import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import { defineConfig, type Plugin } from 'vite'

// Articles are compiled from Markdown at build time, so no Markdown parser ships to the browser.
function markdownArticles(): Plugin {
  return {
    name: 'markdown-articles',
    transform(source, id) {
      if (!id.endsWith('.md')) return
      const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
      const front: Record<string, string> = {}
      for (const line of match?.[1].split(/\r?\n/) ?? []) {
        const i = line.indexOf(':')
        if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim()
      }
      const body = match ? source.slice(match[0].length) : source
      const html = marked.parse(body, { async: false }) as string
      const words = body.split(/\s+/).filter(Boolean).length
      return {
        code: `export default ${JSON.stringify({ title: front.title ?? '', author: front.author ?? '', html, words })}`,
        map: null,
      }
    },
  }
}

// MapLibre loads its worker from a file next to its own bundle; copy it there in production builds.
function maplibreWorker(): Plugin {
  return {
    name: 'maplibre-worker',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'assets/maplibre-gl-worker.mjs',
        source: readFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'),
      })
    },
  }
}

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (/repo-name/) and at a domain root.
  base: './',
  plugins: [react(), markdownArticles(), maplibreWorker()],
  // MapLibre v6 loads its web worker from a file next to its own bundle, so don't pre-bundle it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/maplibre-gl') ? 'maplibre' : undefined),
      },
    },
  },
})
