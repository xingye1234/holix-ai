#!/usr/bin/env node

/**
 * Generate release notes for the current version
 * Extracts the latest version section from CHANGELOG.md
 * or generates it from recent commits
 */

import { execa } from 'execa'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CHANGELOG_FILE = 'CHANGELOG.md'
const RELEASE_NOTES_FILE = 'RELEASE_NOTES.md'

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
  return packageJson.version
}

/**
 * Extract release notes for a specific version from CHANGELOG.md
 */
function extractReleaseNotes(version) {
  if (!existsSync(CHANGELOG_FILE)) {
    console.log('⚠️  CHANGELOG.md not found, generating from commits...')
    return null
  }

  const changelog = readFileSync(CHANGELOG_FILE, 'utf-8')
  const versionRegex = new RegExp(`## \\[?${version}\\]?[\\s\\S]*?(?=## \\[?\\d|$)`, 'i')
  const match = changelog.match(versionRegex)

  if (match) {
    return match[0].trim()
  }

  return null
}

/**
 * Generate release notes from recent commits
 */
async function generateFromCommits(version) {
  console.log('📝 Generating release notes from recent commits...')

  try {
    // Get commits since last tag
    const { stdout: lastTag } = await execa('git', ['describe', '--tags', '--abbrev=0']).catch(() => ({ stdout: '' }))

    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
    const { stdout: commits } = await execa('git', [
      'log',
      range,
      '--pretty=format:%s',
      '--no-merges',
    ])

    if (!commits) {
      return `## [${version}]\n\nNo changes recorded.`
    }

    // Parse commits by type
    const features = []
    const fixes = []
    const others = []

    commits.split('\n').forEach((commit) => {
      if (commit.startsWith('feat')) {
        features.push(commit.replace(/^feat(\([^)]+\))?:\s*/, ''))
      }
      else if (commit.startsWith('fix')) {
        fixes.push(commit.replace(/^fix(\([^)]+\))?:\s*/, ''))
      }
      else if (!commit.startsWith('Merge') && !commit.startsWith('chore')) {
        others.push(commit)
      }
    })

    // Build release notes
    let notes = `## [${version}]\n\n`

    if (features.length > 0) {
      notes += '### ✨ Features\n\n'
      features.forEach(feat => notes += `- ${feat}\n`)
      notes += '\n'
    }

    if (fixes.length > 0) {
      notes += '### 🐛 Bug Fixes\n\n'
      fixes.forEach(fix => notes += `- ${fix}\n`)
      notes += '\n'
    }

    if (others.length > 0) {
      notes += '### 📝 Other Changes\n\n'
      others.forEach(other => notes += `- ${other}\n`)
      notes += '\n'
    }

    return notes.trim()
  }
  catch (error) {
    console.error('❌ Failed to generate from commits:', error.message)
    return `## [${version}]\n\nRelease notes generation failed.`
  }
}

async function generateReleaseNotes() {
  console.log('🚀 Generating release notes...\n')

  const version = getCurrentVersion()
  console.log(`📦 Current version: ${version}`)

  // Try to extract from CHANGELOG first
  let releaseNotes = extractReleaseNotes(version)

  // If not found, generate from commits
  if (!releaseNotes) {
    releaseNotes = await generateFromCommits(version)
  }

  // Add header
  const fullNotes = `# Release Notes - v${version}

${releaseNotes}

---

*Generated on ${new Date().toISOString().split('T')[0]}*
`

  // Write to file
  writeFileSync(RELEASE_NOTES_FILE, fullNotes)
  console.log(`\n✅ Release notes saved to ${RELEASE_NOTES_FILE}`)
  console.log('\n📄 Preview:\n')
  console.log(fullNotes)
}

generateReleaseNotes()
