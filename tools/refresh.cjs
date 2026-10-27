'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const gh = process.platform === 'win32' ? 'gh.exe' : 'gh'
const specs = [
  ['@ant-design/icons-svg', '4.5.0'], ['manate', '2.0.3'],
  ['node-bash', '5.0.1'], ['child-shell', '5.0.0'],
  ['@xterm/addon-serialize', '0.15.0-beta.292'], ['@xterm/headless', '6.1.0-beta.292'],
  ['accumulate-stream', '5.0.0'], ['eastasianwidth', '0.2.0'],
  ['filesize-parser', '1.5.1'], ['find-free-port', '2.0.0'], ['keyv', '4.5.3'],
  ['natural-compare', '1.4.0'], ['replace-in-file', '6.3.5'], ['trim-buffer', '5.0.0'],
  ['@types/json5', '0.0.29'], ['@rolldown/binding-win32-x64-msvc', '1.0.3'],
  ['@rolldown/binding-linux-x64-gnu', '1.0.3'],
  ['@rolldown/binding-darwin-x64', '1.0.3'], ['@rolldown/binding-darwin-arm64', '1.0.3'],
  ['@novnc/novnc', '1.7.0'], ['spice-client', '1.2.0']
]
const trees = new Map()
const records = []
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function write (relative, bytes) {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) {
    assert(fs.readFileSync(file).equals(Buffer.from(bytes)), 'Existing capsule input differs: ' + relative)
  } else fs.writeFileSync(file, bytes, { flag: 'wx' })
}

async function get (url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  assert.equal(response.status, 200, 'Missing original material: ' + url)
  return Buffer.from(await response.arrayBuffer())
}

function repository (value) {
  const url = typeof value === 'string' ? value : value?.url
  const match = /github\.com[:/]([^/#]+\/[^#]+?)(?:\.git)?$/.exec(url || '')
  return match?.[1]
}

async function gather (name, version) {
  const metadataBytes = await get('https://npm.anubis.locker/' + name + '/' + version)
  const metadata = JSON.parse(metadataBytes)
  assert.equal(metadata.version, version)
  const id = name.replace(/^@/, '').replace(/\//g, '__') + '-' + version
  const repo = repository(metadata.repository)
  const commit = /^[a-f0-9]{40}$/.test(metadata.gitHead || '') ? metadata.gitHead : null
  const record = {
    name, version, license: metadata.license || null,
    registryIntegrity: metadata.dist.integrity,
    upstream: { repository: repo ? 'https://github.com/' + repo : null, commit },
    noticeFiles: [], sourceArchives: [], status: 'upstream-declaration-only'
  }
  const declared = {
    name, version, license: metadata.license || null, author: metadata.author || null,
    repository: metadata.repository || null, gitHead: commit,
    registryIntegrity: metadata.dist.integrity
  }
  const declaration = `notices/${id}/original-package-metadata.json`
  write(declaration, JSON.stringify(declared, null, 2) + '\n')
  record.noticeFiles.push(declaration)
  const tarball = new URL(metadata.dist.tarball)
  assert.equal(tarball.origin, 'https://npm.anubis.locker')
  const archivePath = `sources/${id}-original-package.tar.gz`
  if (repo && commit) {
    const key = repo + '/' + commit
    if (!trees.has(key)) {
      trees.set(key, JSON.parse(execFileSync(gh, [
        'api', `repos/${repo}/git/trees/${commit}`
      ], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 })))
    }
    const tree = trees.get(key)
    assert.equal(tree.truncated, false, 'Truncated source license tree')
    const candidates = tree.tree.filter(entry => entry.type === 'blob' &&
      /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(path.posix.basename(entry.path)))
    for (const entry of candidates) {
      assert(!entry.path.split('/').includes('..'))
      const url = `https://raw.githubusercontent.com/${repo}/${commit}/${entry.path}`
      const bytes = await get(url)
      const gitHash = crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex')
      assert.equal(gitHash, entry.sha, 'Original source blob identity differs')
      const file = `notices/${id}/upstream/${entry.path}`
      write(file, bytes)
      record.noticeFiles.push(file)
      record.status = 'original-source-notice'
    }
  }
  const archiveFile = path.join(root, archivePath)
  if (record.status === 'upstream-declaration-only' || ['spice-client', '@novnc/novnc'].includes(name)) {
    const archive = await get(tarball.href)
    assert.equal('sha512-' + crypto.createHash('sha512').update(archive).digest('base64'), metadata.dist.integrity)
    write(archivePath, archive)
    record.sourceArchives.push(archivePath)
  } else if (fs.existsSync(archiveFile)) {
    const bytes = fs.readFileSync(archiveFile)
    assert.equal('sha512-' + crypto.createHash('sha512').update(bytes).digest('base64'), metadata.dist.integrity)
    fs.unlinkSync(archiveFile)
  }
  records.push(record)
  console.log(JSON.stringify({ name, version, status: record.status, notices: record.noticeFiles.length }))
}

async function main () {
  for (const spec of specs) await gather(...spec)
  for (const [name, url] of [
    ['MIT.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/MIT.txt'],
    ['ISC.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/ISC.txt'],
    ['MPL-2.0.txt', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/MPL-2.0.txt'],
    ['COPYING', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/GPL-3.0-or-later.txt'],
    ['COPYING.LESSER', 'https://raw.githubusercontent.com/spdx/license-list-data/v3.27.0/text/LGPL-3.0-or-later.txt']
  ]) {
    write('notices/reference-terms/' + name, await get(url))
  }
  for (const record of records) {
    if (record.status === 'upstream-declaration-only' && ['MIT', 'ISC'].includes(record.license)) {
      record.noticeFiles.push('notices/reference-terms/' + record.license + '.txt')
      record.note = 'Original SPDX declaration and original package are preserved; standard terms are reference material, not an invented copyright notice.'
    }
  }
  const source = 'sources/spice-client-1.2.0-aed3b4f.tar.gz'
  assert(fs.existsSync(path.join(root, source)), 'Exact preferred SPICE source archive is required')
  const spice = records.find(record => record.name === 'spice-client')
  assert.equal(spice.upstream.commit, 'aed3b4f841db65a9ab015e174d69ff4fccbb197f')
  spice.sourceArchives.push(source)
  spice.preferredSourceArchive = source
  spice.noticeFiles.push('notices/reference-terms/COPYING', 'notices/reference-terms/COPYING.LESSER')
  const novnc = records.find(record => record.name === '@novnc/novnc')
  novnc.preferredSourceArchive = novnc.sourceArchives[0]
  novnc.noticeFiles.push('notices/reference-terms/MPL-2.0.txt')
  novnc.note = 'The original package contains the unminified JavaScript core and vendor source, not only a compiled application bundle.'
  const files = []
  function visit (directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      if (directory === root && !['README.md', 'package.json', 'notices', 'sources'].includes(entry.name)) continue
      const full = path.join(directory, entry.name)
      assert(!entry.isSymbolicLink())
      if (entry.isDirectory()) visit(full)
      else if (entry.name !== 'manifest.json' && !entry.name.endsWith('.tgz')) {
        const data = fs.readFileSync(full)
        files.push({ path: path.relative(root, full).split(path.sep).join('/'), bytes: data.length, sha256: sha256(data) })
      }
    }
  }
  visit(root)
  const manifest = { schemaVersion: 1, packages: records, files }
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ packages: records.length, files: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0) }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
