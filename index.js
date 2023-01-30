#!/usr/bin/env node

const { request, stream, setGlobalDispatcher, Agent } = require('undici')
const EE = require('events')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('is-my-node-vulnerable')
const satisfies = require('semver/functions/satisfies')
const parse = require('semver/functions/parse')
const { danger, vulnerableWarning, bold, separator, allGood } = require('./ascii')
const nv = require('@pkgjs/nv')

setGlobalDispatcher(new Agent({ connections: 20 }))

const CORE_RAW_URL = 'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json'

let lastETagValue

const coreLocalFile = path.join(__dirname, 'core.json')
const ETagFile = path.join(__dirname, '.etag')

async function readLocal (file) {
  return require(file)
}

function loadETag () {
  if (fs.existsSync(ETagFile)) {
    debug('Loading local ETag')
    lastETagValue = fs.readFileSync(ETagFile).toString()
  }
}

function updateLastETag (etag) {
  lastETagValue = etag
  fs.writeFileSync(ETagFile, lastETagValue)
}

async function fetchCoreIndex () {
  const abortRequest = new EE()
  await stream(CORE_RAW_URL, { signal: abortRequest }, ({ statusCode }) => {
    if (statusCode !== 200) {
      console.error('Request to Github failed. Aborting...')
      abortRequest.emit('abort')
      process.nextTick(() => { process.exit(1) })
    }
    return fs.createWriteStream(coreLocalFile, { flags: 'w', autoClose: true })
  })
  return readLocal(coreLocalFile)
}

async function getCoreIndex () {
  const { headers } = await request(CORE_RAW_URL, { method: 'HEAD' })
  if (!lastETagValue || lastETagValue !== headers.etag || !fs.existsSync(coreLocalFile)) {
    updateLastETag(headers.etag)
    debug('Creating local core.json')
    return fetchCoreIndex()
  } else {
    debug(`No updates from upstream. Getting a cached version: ${coreLocalFile}`)
    return readLocal(coreLocalFile)
  }
}

function getVulnerabilityList (currentVersion, data) {
  const list = []
  for (const key in data) {
    const vuln = data[key]
    if (
      satisfies(currentVersion, vuln.vulnerable) &&
      !satisfies(currentVersion, vuln.patched)
    ) {
      list.push(`${bold(vuln.cve)}: ${vuln.overview}\n${bold('Patched versions')}: ${vuln.patched}`)
    }
  }
  return list
}

async function main (currentVersion) {
  const isSupported = await isNodeSupportedMajor(currentVersion)
  const isEOL = await isNodeEOL(currentVersion)
  if (isEOL) {
    console.error(danger)
    console.error(`${currentVersion} is end-of-life. There are high chances of being vulnerable. Please upgrade it.`)
    process.exit(1)
  } else if (!isSupported) {
    console.error(`You may be at risk. ${currentVersion} is not an actively supported Node.js version, so unable to check vulnerabilities.`)
    process.exit(1)
  }
  const coreIndex = await getCoreIndex()
  const list = getVulnerabilityList(currentVersion, coreIndex)
  if (list.length) {
    console.error(danger)
    console.error(vulnerableWarning + '\n')
    console.error(`${list.join(`\n${separator}\n\n`)}\n${separator}`)
    process.exit(1)
  } else {
    console.info(allGood)
  }
}

/**
 * get the currently supported Node versions
 * @returns Promise<VersionInfo[]>
 */
function supportedVersions () {
  return nv(['supported'])
}

/**
 * @param {string} version
 * @returns {Promise<number[]>} true if this version is a supported major version
 */
async function supportedMajorVersions () {
  const versions = await supportedVersions()
  const majors = versions.map(v => v.major)
  return majors
}

/**
 * @param {string} version
 * @returns {Promise<boolean>} true if this version is a supported major version
 */
async function isNodeSupportedMajor (version) {
  const majors = await supportedMajorVersions()
  const myVersion = parse(version)
  return (majors.indexOf(myVersion.major) !== -1)
}

/**
 * @param {string} version
 * @returns {Promise<boolean>} true if this version's major is less than the minimum supported major
 */
async function isNodeEOL (version) {
  const myVersionInfo = await nv(version)
  if (!myVersionInfo) {
    // i.e. isNodeEOL('abcd')
    throw Error(`Could not fetch version information for ${version}`)
  } else if (myVersionInfo.length !== 1) {
    // i.e. isNodeEOL('lts') or isNodeEOL('99')
    throw Error(`Did not get exactly one version record for ${version}`)
  } else if (!myVersionInfo[0].end) {
    // We got a record, but..
    // v0.12.18 etc does not have an EOL date, which probably means too old.
    return true
  }
  const now = new Date()
  const end = new Date(myVersionInfo[0].end)
  return now > end
}

async function isNodeVulnerable (version) {
  const coreIndex = await getCoreIndex()
  const list = getVulnerabilityList(version, coreIndex)
  return list.length > 0
}

if (process.argv[2] !== '-r') {
  loadETag()
}

// CLI
if (require.main === module) {
  main(process.version)
} else {
  module.exports = {
    isNodeVulnerable,
    isNodeEOL,
    isNodeSupportedMajor
  }
}
