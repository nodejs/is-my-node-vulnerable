#!/usr/bin/env node

const isNodeEOL = require('./is-node-eol')
const ascii = require('./ascii')

// To guarantee support on older versions and do not drastically impact
// the maintenance of this module, we check if process.version is too old
// and throw EOL warning when true.
if (isNodeEOL(process.version)) {
  console.log(ascii.danger)
  const msg = process.version + ' is end-of-life. There are high chances of being vulnerable. Please upgrade it.'
  console.log(msg)
  process.exit(1)
} else {
  // CLI
  if (require.main === module) {
    require('./is-node-vulnerable').cli(process.version, require('os').platform())
  } else {
    module.exports = {
      isNodeVulnerable: require('./is-node-vulnerable').isNodeVulnerable
    }
  }
}
