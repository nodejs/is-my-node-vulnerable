#!/usr/bin/env node

const isOldEnough = require('./eol-versions')
const ascii = require('./ascii')

// To guarantee support on older versions and do not drastically impact
// the maintenance of this module, we check if process.version is too old
// and throw EOL warning when true.
if (isOldEnough(process.version)) {
  console.log(ascii.danger)
  const msg = process.version + ' is end-of-life. There are high chances of being vulnerable. Please upgrade it.'
  console.log(msg)
  process.exit(1)
} else {
  // CLI
  if (require.main === module) {
    require('./is-vulnerable').cli(process.version, require('os').platform(), { cache: process.argv.indexOf('--no-cache') === -1 })
  } else {
    module.exports = {
      isNodeVulnerable: require('./is-vulnerable').isNodeVulnerable
    }
  }
}
