const path = require('path')
const fs = require('fs')

const wasmBuffer = fs.readFileSync(path.join(__dirname, 'mp.wasm'))
const wasmModule = new WebAssembly.Module(wasmBuffer)

const { importObj, errNoObj } = require('./setup')
const memory = importObj.env.memory
const wasmInstance = new WebAssembly.Instance(wasmModule, importObj)
errNoObj.getLoc = wasmInstance.exports.___errno_location

const memUtils = require('./mem-utils')(memory, wasmInstance)
const mpf = require('./mpf')(wasmInstance, memUtils)

module.exports = { mpf }
