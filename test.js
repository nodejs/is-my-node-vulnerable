const assert = require('assert')
const { isNodeVulnerable } = require('./src/index')

async function t () {
  // of course, this test is fragile
  assert.ok(await isNodeVulnerable('20.5.0'))
  assert.ok(await isNodeVulnerable('20.0.0'))
  assert.ok(await isNodeVulnerable('19.0.0'))
  assert.ok(await isNodeVulnerable('18.0.0'))
  assert.ok(await isNodeVulnerable('14.0.0'))
  assert.ok(await isNodeVulnerable('16.0.0'))
  assert.ok(await isNodeVulnerable('19.6.0'))
  assert.ok(await isNodeVulnerable('18.14.0'))
  assert.ok(await isNodeVulnerable('16.19.0'))
  assert.ok(await isNodeVulnerable('20.8.0'))
  assert.ok(await isNodeVulnerable('20.11.0'))
  assert.ok(await isNodeVulnerable('23.6.0'))

  assert.rejects(() => isNodeVulnerable('999'), /Could not fetch version information/)
  assert.rejects(() => isNodeVulnerable('Unobtanium'), /Could not fetch version information/) // i.e. not found
  assert.rejects(() => isNodeVulnerable('25.0.0'), /Could not fetch version information/)

  // EOL
  assert.ok(await isNodeVulnerable('21.0.0'))
  assert.ok(await isNodeVulnerable('19.0.0'))
  assert.ok(await isNodeVulnerable('16.0.0'))
  assert.ok(await isNodeVulnerable('17.0.0'))
  assert.ok(await isNodeVulnerable('15.0.0'))
  assert.ok(await isNodeVulnerable('13.0.0'))
  assert.ok(await isNodeVulnerable('12.0.0'))
  assert.ok(await isNodeVulnerable('v0.12.18'))

  // Platform specific
  assert.ok(await isNodeVulnerable('22.4.0', 'win32'))
  assert.ok(await isNodeVulnerable('19.0.0', 'linux'))
  assert.ok(await isNodeVulnerable('18.0.0', 'win32'))
  assert.ok(await isNodeVulnerable('14.0.0', 'android'))
  assert.rejects(() => isNodeVulnerable('20.0.0', 'non-valid-platform'), /platform non-valid-platform is not valid. Please use aix,darwin,freebsd,linux,openbsd,sunos,win32,android/)
}

t()
