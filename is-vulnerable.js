const { danger, allGood, bold, vulnerableWarning, separator } = require('./ascii')
const { request } = require('https')
const fs = require('fs')
const path = require('path')
const satisfies = require('semver/functions/satisfies')

const STORE = {
  security: {
    url: 'https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json',
    jsonFile: path.join(__dirname, 'security.json'),
    etagFile: path.join(__dirname, 'security.etag'),
    etagValue: ''
  },
  schedule: {
    url: 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json',
    jsonFile: path.join(__dirname, 'schedule.json'),
    etagFile: path.join(__dirname, 'schedule.etag'),
    etagValue: ''
  }
}

async function readLocal (file) {
  return require(file)
}

function debug (msg) {
  if (process.env.DEBUG) {
    console.debug(msg)
  }
}

function loadETag () {
  for (const [key, obj] of Object.entries(STORE)) {
    if (fs.existsSync(obj.etagFile)) {
      debug(`Loading local ETag for '${key}'`)
      obj.etagValue = fs.readFileSync(obj.etagFile).toString()
    }
  }
}

async function fetchJson (obj, etag) {
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
        obj.etagValue = etag
        fs.writeFileSync(obj.etagFile, etag)
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
  return readLocal(obj.jsonFile)
}

async function getJson (obj) {
  return new Promise((resolve) => {
    request(obj.url, { method: 'HEAD' }, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Request to Github returned http status ${res.statusCode}. Aborting...`)
        process.nextTick(() => { process.exit(1) })
      }

      res.on('data', () => {})

      const { etag } = res.headers
      if (!obj.etagValue || obj.etagValue !== etag || !fs.existsSync(obj.jsonFile)) {
        debug('Creating local core.json')
        resolve(fetchJson(obj, etag))
      } else {
        debug(`No updates from upstream. Getting a cached version: ${obj.jsonFile}`)
        resolve(readLocal(obj.jsonFile))
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

  const isEOL = await isNodeEOL(currentVersion)
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

async function getVersionInfo (version) {
  const scheduleJson = await getJson(STORE.schedule)

  if (scheduleJson[version.toLowerCase()]) {
    return scheduleJson[version.toLowerCase()]
  }

  for (const [key, value] of Object.entries(scheduleJson)) {
    if (satisfies(version, key)) {
      return value
    }
  }

  return null
}

/**
 * @param {string} version
 * @returns {Promise<boolean>} true if the version is end-of-life
 */
async function isNodeEOL (version) {
  const myVersionInfo = await getVersionInfo(version)

  if (!myVersionInfo) {
    // i.e. isNodeEOL('abcd') or isNodeEOL('lts') or isNodeEOL('99')
    throw Error(`Could not fetch version information for ${version}`)
  } else if (!myVersionInfo.end) {
    // We got a record, but..
    // v0.12.18 etc does not have an EOL date, which probably means too old.
    return true
  }

  const now = new Date()
  const end = new Date(myVersionInfo.end)
  return now > end
}

async function isNodeVulnerable (version, platform) {
  checkPlatform(platform)
  const isEOL = await isNodeEOL(version)
  if (isEOL) {
    return true
  }

  const coreIndex = await getJson(STORE.security)
  const list = getVulnerabilityList(version, coreIndex, platform)
  return list.length > 0
}

if (process.argv[2] !== '-r') {
  loadETag()
}

module.exports = {
  isNodeVulnerable,
  cli
}
