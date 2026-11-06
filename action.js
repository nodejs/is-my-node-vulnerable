const core = require('@actions/core')
const { isNodeVulnerable } = require('./index')

async function run () {
  // Inputs
  const nodeVersion = core.getInput('node-version', { required: true })
  const platform = core.getInput('platform', { required: false })
  const cache = core.getBooleanInput('cache', { required: false })

  core.info(`Checking Node.js version ${nodeVersion} with platform ${platform}...`)
  const isVulnerable = await isNodeVulnerable(nodeVersion, platform, { cache })
  if (isVulnerable) {
    core.setFailed(`Node.js version ${nodeVersion} is vulnerable. Please upgrade!`)
  } else {
    core.info(`Node.js version ${nodeVersion} is OK!`)
  }
}

run()
