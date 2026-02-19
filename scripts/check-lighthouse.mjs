import fs from 'node:fs'
import path from 'node:path'

const REPORT_PATH = path.resolve(process.cwd(), 'reports', 'lighthouse.json')
const MIN_PERFORMANCE_SCORE = 85
const MAX_TTI_MS = 6000

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!fs.existsSync(REPORT_PATH)) {
  fail(`Missing Lighthouse report at ${REPORT_PATH}. Run "npm run lighthouse:run" or "npm run lighthouse:ci" first.`)
}

const reportRaw = fs.readFileSync(REPORT_PATH, 'utf8')
const report = JSON.parse(reportRaw)

const rawScore = report.categories?.performance?.score
const performanceScore = Math.round((typeof rawScore === 'number' ? rawScore : 0) * 100)
const interactiveAudit = report.audits?.interactive
const interactiveValue = typeof interactiveAudit?.numericValue === 'number' ? interactiveAudit.numericValue : null

console.log(`Lighthouse performance score: ${performanceScore}`)
console.log(`Lighthouse TTI: ${interactiveValue ?? 'n/a'} ms`)
console.log(`Required: performance >= ${MIN_PERFORMANCE_SCORE}, TTI <= ${MAX_TTI_MS}ms`)

if (performanceScore < MIN_PERFORMANCE_SCORE) {
  fail(`Performance score ${performanceScore} is below ${MIN_PERFORMANCE_SCORE}.`)
}

if (interactiveValue === null) {
  fail('Interactive (TTI) audit not present in lighthouse report.')
}

if (interactiveValue > MAX_TTI_MS) {
  fail(`TTI ${interactiveValue}ms exceeds ${MAX_TTI_MS}ms.`)
}

console.log('Lighthouse budget checks passed.')
