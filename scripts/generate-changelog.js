#!/usr/bin/env node

/**
 * Generate CHANGELOG.md from git commit history
 * Uses conventional-changelog to parse conventional commits
 */

import { execa } from 'execa'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CHANGELOG_FILE = 'CHANGELOG.md'

async function generateChangelog() {
  console.log('🔄 Generating CHANGELOG.md...')

  try {
    // Generate changelog using conventional-changelog-cli
    const { stdout } = await execa('npx', [
      'conventional-changelog',
      '-p', 'conventionalcommits',
      '-i', CHANGELOG_FILE,
      '-s',
      '-r', '0', // Generate for all releases
    ])

    console.log('✅ CHANGELOG.md generated successfully!')
    console.log('\n📝 Preview:')
    console.log(stdout.split('\n').slice(0, 20).join('\n'))
    console.log('...\n')
  }
  catch (error) {
    console.error('❌ Failed to generate CHANGELOG:', error.message)
    process.exit(1)
  }
}

generateChangelog()
