const Module = require('module'),
  path = require('path')
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(
    this,
    request.startsWith('@/')
      ? path.join(__dirname, '../src', request.slice(2))
      : request,
    ...args
  )
}
