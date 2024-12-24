const util = require('util')

const danger = '\n' +
'\n' +
'██████   █████  ███    ██  ██████  ███████ ███████\n' +
'██   ██ ██   ██ ████   ██ ██       ██      ██   ██\n' +
'██   ██ ███████ ██ ██  ██ ██   ███ █████   ███████\n' +
'██   ██ ██   ██ ██  ██ ██ ██    ██ ██      ██   ██\n' +
'██████  ██   ██ ██   ████  ██████  ███████ ██   ██\n' +
'\n'

const allGood = '\n' +
'\n' +
' █████  ██      ██           ██████   ██████   ██████  ██████         ██\n' +
'██   ██ ██      ██          ██       ██    ██ ██    ██ ██   ██     ██  ██\n' +
'███████ ██      ██          ██   ███ ██    ██ ██    ██ ██   ██         ██\n' +
'██   ██ ██      ██          ██    ██ ██    ██ ██    ██ ██   ██     ██  ██\n' +
'██   ██ ███████ ███████      ██████   ██████   ██████  ██████         ██\n' +
'\n'

function escapeStyleCode (code) {
  return '\u001b[' + code + 'm'
}

function bold (text) {
  var left = ''
  var right = ''
  const formatCodes = util.inspect.colors.bold
  left += escapeStyleCode(formatCodes[0])
  right = escapeStyleCode(formatCodes[1]) + right
  return left + text + right
}

const vulnerableWarning = bold('The current Node.js version (' + process.version + ') is vulnerable to the following CVEs:')

var separator = '='
for (var i = 0; i < process.stdout.columns; ++i) {
  separator = separator + '='
}

module.exports.danger = danger
module.exports.allGood = allGood
module.exports.bold = bold
module.exports.vulnerableWarning = vulnerableWarning
module.exports.separator = separator
