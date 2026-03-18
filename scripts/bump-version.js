#!/usr/bin/env node

/**
 * Bump version and generate changelog
 * Usage: node scripts/bump-version.js [major|minor|patch]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execa } from 'execa'

const VALID_TYPES = ['major', 'minor', 'patch']

async function bumpVersion(type = 'patch') {
  if (!VALID_TYPES.includes(type)) {
    console.error(`❌ Invalid version type: ${type}`)
    console.error(`   Valid types: ${VALID_TYPES.join(', ')}`)
    process.exit(1)
  }

  console.log(`🔄 Bumping ${type} version...\n`)

  try {
    // Read current version
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
    const currentVersion = packageJson.version
    console.log(`📦 Current version: ${currentVersion}`)

    // Calculate new version
    const [major, minor, patch] = currentVersion.split('.').map(Number)
    let newVersion

    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`
        break
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`
        break
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`
        break
    }

    console.log(`📦 New version: ${newVersion}\n`)

    // Update package.json
    packageJson.version = newVersion
    writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`)
    console.log('✅ Updated package.json')

    // Generate changelog
    console.log('\n🔄 Generating CHANGELOG...')
    await execa('node', ['scripts/generate-changelog.js'], { stdio: 'inherit' })

    // Generate release notes
    console.log('\n🔄 Generating release notes...')
    await execa('node', ['scripts/generate-release-notes.js'], { stdio: 'inherit' })

    console.log('\n✅ Version bump complete!')
    console.log('\n📝 Next steps:')
    console.log('   1. Review CHANGELOG.md and RELEASE_NOTES.md')
    console.log(`   2. Commit changes: git add . && git commit -m "chore: release v${newVersion}"`)
    console.log(`   3. Create tag: git tag v${newVersion}`)
    console.log('   4. Push: git push && git push --tags')
  }
  catch (error) {
    console.error('❌ Failed to bump version:', error.message)
    process.exit(1)
  }
}

const type = process.argv[2] || 'patch'
bumpVersion(type)
