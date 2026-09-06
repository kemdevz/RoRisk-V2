import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outputDirectory = path.join(root, 'dist')
const environmentFile = path.join(root, '.env')

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

function readEnvironment() {
  if (!fs.existsSync(environmentFile)) return {}
  return Object.fromEntries(fs.readFileSync(environmentFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, '')]
    }))
}

if (!fs.existsSync(outputDirectory)) {
  console.error('Security audit failed: dist does not exist.')
  process.exit(1)
}

const files = walk(outputDirectory)
const sourceMaps = files.filter((file) => file.endsWith('.map'))
const environment = readEnvironment()
const sensitiveNames = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'RORISK_USER_SECRET', 'HCAPTCHA_SECRET']
const sensitiveValues = sensitiveNames
  .map((name) => [name, environment[name]])
  .filter(([, value]) => typeof value === 'string' && value.length >= 8)
const forbiddenPatterns = [
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{16,}/],
  ['server environment name', /SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY|RORISK_USER_SECRET|HCAPTCHA_SECRET/],
]
const findings = []

for (const file of files) {
  const buffer = fs.readFileSync(file)
  for (const [name, value] of sensitiveValues) {
    if (buffer.includes(Buffer.from(value))) findings.push(`${name} value in ${path.relative(root, file)}`)
  }
  if (/\.(?:js|css|html|json|txt|svg)$/i.test(file)) {
    const text = buffer.toString('utf8')
    for (const [label, pattern] of forbiddenPatterns) {
      if (pattern.test(text)) findings.push(`${label} in ${path.relative(root, file)}`)
    }
  }
}

if (sourceMaps.length) findings.push(`${sourceMaps.length} source map file(s) in dist`)
if (findings.length) {
  console.error('Security audit failed:')
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Security audit passed: ${files.length} production files contain no server secrets or source maps.`)
