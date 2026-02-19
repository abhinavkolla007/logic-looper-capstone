import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const INDEX_PATH = path.join(DIST_DIR, 'index.html')
const MAX_INITIAL_BYTES = 50 * 1024

function fileSizeBytes(filePath) {
  return fs.statSync(filePath).size
}

function gzipSizeBytes(filePath) {
  const content = fs.readFileSync(filePath)
  return zlib.gzipSync(content).length
}

function parseAssetPaths(html) {
  const matches = [...html.matchAll(/(?:src|href)="(\/?assets\/[^"]+)"/g)]
  return matches.map((m) => m[1].replace(/^\//, ''))
}

function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('Missing dist/index.html. Run `npm run build` first.')
    process.exit(1)
  }

  const html = fs.readFileSync(INDEX_PATH, 'utf8')
  const assets = Array.from(new Set(parseAssetPaths(html)))

  let total = 0
  const details = []
  for (const relPath of assets) {
    const fullPath = path.join(DIST_DIR, relPath)
    if (!fs.existsSync(fullPath)) continue
    const size = gzipSizeBytes(fullPath)
    total += size
    details.push({ file: relPath, size })
  }

  console.log('Initial asset budget check (gzip):')
  for (const item of details) {
    console.log(`- ${item.file}: ${item.size} bytes`)
  }
  console.log(`Total initial bytes: ${total}`)
  console.log(`Budget: ${MAX_INITIAL_BYTES} bytes`)

  if (total > MAX_INITIAL_BYTES) {
    console.error('Bundle budget exceeded')
    process.exit(1)
  }
}

main()
