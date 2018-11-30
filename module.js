const fs = require('fs')
const path = require('path')

const wasmBuffer = fs.readFileSync(path.join(__dirname, 'mp.wasm'))
const wasmModule = new WebAssembly.Module(wasmBuffer)

const globalImports = {
  NaN: new WebAssembly.Global({ value: 'f64' }, NaN),
  Infinity: new WebAssembly.Global({ value: 'f64' }, Infinity),
}

const ptrSize = 4
const wasmPageSize = 65536
const numMemoryPages = 256
const totalMemory = numMemoryPages * wasmPageSize
const memoryAlignment = 16

function alignMemory(size) {
  return Math.ceil(size / memoryAlignment) * memoryAlignment
}

const memory = new WebAssembly.Memory({
  initial: numMemoryPages,
  maximum: numMemoryPages,
})

const memViews = {}
memViews.int8 = new Int8Array(memory.buffer)
memViews.uint8 = new Uint8Array(memory.buffer)
memViews.uint8Clamped = new Uint8ClampedArray(memory.buffer)
memViews.int16 = new Int16Array(memory.buffer)
memViews.uint16 = new Uint16Array(memory.buffer)
memViews.int32 = new Int32Array(memory.buffer)
memViews.uint32 = new Uint32Array(memory.buffer)
memViews.float32 = new Float32Array(memory.buffer)
memViews.float64 = new Float64Array(memory.buffer)

const numStackPages = 80
const totalStackMemory = numStackPages * wasmPageSize

const staticBase = 1024;
const staticBump = 91344;

let staticTop = staticBase + staticBump
const tempDoublePtr = staticTop
staticTop += memoryAlignment

const _stdin = staticTop
staticTop += memoryAlignment

const _stdout = staticTop
staticTop += memoryAlignment

const _stderr = staticTop
staticTop += memoryAlignment

const DYNAMICTOP_PTR = staticTop
staticTop = alignMemory(staticTop + ptrSize)

const STACKTOP = staticTop
const STACK_MAX = STACKTOP + totalStackMemory;

const dynamicBase = alignMemory(STACK_MAX);

memViews.int32[DYNAMICTOP_PTR >> 2] = dynamicBase;

let tempRet0 = 0

const envImports = {
  setTempRet0(value) {
    tempRet0 = value;
  },

  abortStackOverflow(allocSize) {
    throw new Error('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!')
  },

  abortOnCannotGrowMemory() {
    throw new Error('cannot grow memory')
  },

  enlargeMemory() {
    throw new Error('cannot enlarge memory')
  },

  getTotalMemory() {
    return totalMemory;
  },

  STACKTOP: new WebAssembly.Global({ value: 'i32' }, STACKTOP),
  STACK_MAX: new WebAssembly.Global({ value: 'i32' }, STACK_MAX),
  DYNAMICTOP_PTR: new WebAssembly.Global({ value: 'i32' }, DYNAMICTOP_PTR),
  tempDoublePtr: new WebAssembly.Global({ value: 'i32' }, tempDoublePtr),

  ___lock() {},
  ___unlock() {},

  ___setErrNo(value) {
    if(___errno_location != null)
      memViews.int32[___errno_location() >> 2] = value;
    else
      console.warn("can't set errno", value)
    return value;
  },

  _abort() {
    throw new Error('abort')
  },

  _emscripten_memcpy_big(dest, src, num) {
    memViews.uint8.set(memViews.uint8.subarray(src, src + num), dest)
    return dest;
  },

  _raise(sig) {
    ___setErrNo(38); // ENOSYS
    console.warn('raise() unsupported; calling stub instead');
    return -1;
  },

  __memory_base: new WebAssembly.Global({ value: 'i32' }, 1024),
  __table_base: new WebAssembly.Global({ value: 'i32' }, 0),
  memory,

  table: new WebAssembly.Table({
    element: "anyfunc",
    initial: 400,
    maximum: 400,
  }),
}

;['ii', 'iii', 'iiii', 'iiiii', 'jj', 'vi', 'vii', 'viii', 'viiiiii'].forEach((sig) => {
  const name = `nullFunc_${sig}`
  envImports[name] = {[name](x) {
    throw new Error(`Invalid function pointer called with signature '${sig}'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this): ${x}`)
  }}[name]
})

syscallNames = {
  6: 'close',
  54: 'ioctl',
  140: 'llseek',
  145: 'readv',
  146: 'writev',
}

;[6, 54, 140, 145, 146].forEach((n) => {
  const name = `___syscall${n}`
  envImports[name] = {[name](x) {
    throw new Error(`syscall ${n} (${syscallNames[n]}) not supported yet`)
  }}[name]
})

const utf8Encoder = new TextEncoder('utf-8')
const utf8Decoder = new TextDecoder('utf-8')

const wasmInstance = new WebAssembly.Instance(wasmModule, { global: globalImports, env: envImports })

const { ___errno_location, _malloc } = wasmInstance.exports

module.exports = {
  wasmInstance,
  utils: {
    stringToPtr(str) {
      const b = utf8Encoder.encode(str)
      const ptr = _malloc(b.length + 1)
      memViews.uint8.set(b, ptr)
      memViews.uint8[ptr + b.length] = 0
      return ptr
    },
    ptrToString(ptr) {
      let length
      for(length = 0; memViews.uint8[ptr + length] !== 0; ++length);
      return utf8Decoder.decode(new DataView(memory.buffer, ptr, length))
    },
  },
}
