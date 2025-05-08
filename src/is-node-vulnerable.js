const { danger, allGood, bold, vulnerableWarning, separator } = require('./ascii')
const { request } = require('https')
const fs = require('fs')
const satisfies = require('semver/functions/satisfies')
const isNodeEOL = require('./is-node-eol')
const STORE = require('./store')

function debug (msg) {
  if (process.env.DEBUG) {
    console.debug(msg)
  }
}

function loadETag () {
  for (const [key, obj] of Object.entries(STORE)) {
    if (fs.existsSync(obj.etagFile)) {
      debug(`Loading local ETag for '${key}'`)
      obj.etagValue = require(obj.etagFile)
    }
  }
}

async function fetchJson (obj) {
  await new Promise((resolve) => {
    request(obj.url, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Request to Github returned http status ${res.statusCode}. Aborting...`)
        process.nextTick(() => { process.exit(1) })
      }

      const fileStream = fs.createWriteStream(obj.jsonFile)
      res.pipe(fileStream)

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })

      fileStream.on('error', (err) => {
        console.error(`Error ${err.message} while writing to '${obj.jsonFile}'. Aborting...`)
        process.nextTick(() => { process.exit(1) })
      })
    }).on('error', (err) => {
      console.error(`Request to Github returned error ${err.message}. Aborting...`)
      process.nextTick(() => { process.exit(1) })
    }).end()
  })
  return require(obj.jsonFile)
}

async function getJson (obj) {
  return new Promise((resolve) => {
    request(obj.url, { method: 'HEAD' }, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Request to Github returned http status ${res.statusCode}. Aborting...`)
        process.nextTick(() => { process.exit(1) })
      }

      res.on('data', () => {})

      const etag = JSON.stringify(res.headers).etag
      if (!obj.etagValue || obj.eTagValue !== etag || !fs.existsSync(obj.jsonFile)) {
        obj.etagValue = etag
        fs.writeFileSync(obj.etagFile, etag)
        debug(`Creating local ${obj.jsonFile} from upstream`)
        resolve(fetchJson(obj))
      } else {
        debug(`No updates from upstream. Getting a cached version: ${obj.jsonFile}`)
        resolve(require(obj.jsonFile))
      }
    }).on('error', (err) => {
      console.error(`Request to Github returned error ${err.message}. Aborting...`)
      process.nextTick(() => { process.exit(1) })
    }).end()
  })
}

const checkPlatform = platform => {
  const availablePlatforms = ['aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32', 'android']
  if (platform && !availablePlatforms.includes(platform)) {
    throw new Error(`platform ${platform} is not valid. Please use ${availablePlatforms.join(',')}.`)
  }
}

const isSystemAffected = (platform, affectedEnvironments) => {
  // No platform specified (legacy mode)
  if (!platform || !Array.isArray(affectedEnvironments)) {
    return true
  }
  // If the environment is matching or all the environments are affected
  if (affectedEnvironments.includes(platform) || affectedEnvironments.includes('all')) {
    return true
  }
  // Default to false
  return false
}

function getVulnerabilityList (currentVersion, data, platform) {
  const list = []
  for (const key in data) {
    const vuln = data[key]

    if (
      (
        satisfies(currentVersion, vuln.vulnerable) &&
        !satisfies(currentVersion, vuln.patched)
      ) && isSystemAffected(platform, vuln.affectedEnvironments)
    ) {
      const severity = vuln.severity === 'unknown' ? '' : `(${vuln.severity})`
      list.push(`${bold(vuln.cve)}${severity}: ${vuln.overview}\n${bold('Patched versions')}: ${vuln.patched}`)
    }
  }
  return list
}

async function cli (currentVersion, platform) {
  checkPlatform(platform)

  const scheduleJson = await getJson(STORE.schedule)
  const isEOL = isNodeEOL(currentVersion, scheduleJson)

  if (isEOL) {
    console.error(danger)
    console.error(`${currentVersion} is end-of-life. There are high chances of being vulnerable. Please upgrade it.`)
    process.exit(1)
  }

  const securityJson = await getJson(STORE.security)
  const list = getVulnerabilityList(currentVersion, securityJson, platform)

  if (list.length) {
    console.error(danger)
    console.error(vulnerableWarning + '\n')
    console.error(`${list.join(`\n${separator}\n\n`)}\n${separator}`)
    process.exit(1)
  } else {
    console.info(allGood)
  }
}

async function isNodeVulnerable (version, platform) {
  checkPlatform(platform)

  const scheduleJson = await getJson(STORE.schedule)
  const isEOL = isNodeEOL(version, scheduleJson)

  if (isEOL) {
    return true
  }

  const securityJson = await getJson(STORE.security)
  const list = getVulnerabilityList(version, securityJson, platform)

  return list.length > 0
}

if (process.argv[2] !== '-r') {
  loadETag()
}

module.exports = {
  isNodeVulnerable,
  cli
}
