const globalImports = {
  NaN: new WebAssembly.Global({ value: "f64" }, NaN),
  Infinity: new WebAssembly.Global({ value: "f64" }, Infinity)
};

const ptrSize = 4;
const wasmPageSize = 65536;
const numMemoryPages = 256;
const totalMemory = numMemoryPages * wasmPageSize;
const memoryAlignment = 16;

function alignMemory(size) {
  return Math.ceil(size / memoryAlignment) * memoryAlignment;
}

const memory = new WebAssembly.Memory({
  initial: numMemoryPages,
  maximum: numMemoryPages
});

const memViews = {
  uint8: new Uint8Array(memory.buffer),
  uint32: new Uint32Array(memory.buffer)
};

const numStackPages = 80;
const totalStackMemory = numStackPages * wasmPageSize;

const staticBase = 1024;
const staticBump = 91344;

let staticTop = staticBase + staticBump;
const tempDoublePtr = staticTop;
staticTop += memoryAlignment;

const _stdin = staticTop;
staticTop += memoryAlignment;

const _stdout = staticTop;
staticTop += memoryAlignment;

const _stderr = staticTop;
staticTop += memoryAlignment;

const DYNAMICTOP_PTR = staticTop;
staticTop = alignMemory(staticTop + ptrSize);

const STACKTOP = staticTop;
const STACK_MAX = STACKTOP + totalStackMemory;

const dynamicBase = alignMemory(STACK_MAX);

memViews.uint32[DYNAMICTOP_PTR >> 2] = dynamicBase;

let tempRet0 = 0;
const errNoObj = {};

const envImports = {
  setTempRet0(value) {
    tempRet0 = value;
  },

  abortStackOverflow(allocSize) {
    throw new Error("stack overflow");
  },

  abortOnCannotGrowMemory() {
    throw new Error("cannot grow memory");
  },

  enlargeMemory() {
    throw new Error("cannot enlarge memory");
  },

  getTotalMemory() {
    return totalMemory;
  },

  STACKTOP: new WebAssembly.Global({ value: "i32" }, STACKTOP),
  STACK_MAX: new WebAssembly.Global({ value: "i32" }, STACK_MAX),
  DYNAMICTOP_PTR: new WebAssembly.Global({ value: "i32" }, DYNAMICTOP_PTR),
  tempDoublePtr: new WebAssembly.Global({ value: "i32" }, tempDoublePtr),

  ___lock() {},
  ___unlock() {},

  ___setErrNo(value) {
    const { getLoc } = errNoObj;
    if (getLoc != null) memViews.uint32[getLoc() >> 2] = value;
    else console.warn("can't set errno", value);
    return value;
  },

  abort() {
    throw new Error("abort");
  },

  _abort() {
    throw new Error("abort");
  },

  _emscripten_memcpy_big(dest, src, num) {
    memViews.uint8.set(memViews.uint8.subarray(src, src + num), dest);
    return dest;
  },

  _raise(sig) {
    ___setErrNo(38); // ENOSYS
    console.warn("raise() unsupported; calling stub instead");
    return -1;
  },

  __memory_base: new WebAssembly.Global({ value: "i32" }, 1024),
  __table_base: new WebAssembly.Global({ value: "i32" }, 0),
  memory,

  table: new WebAssembly.Table({
    element: "anyfunc",
    initial: 70,
    maximum: 70
  })
};

["ii", "iii", "iiii", "iiiii", "jj", "vi", "vii", "viii", "viiiiii"].forEach(
  sig => {
    const name = `nullFunc_${sig}`;
    envImports[name] = {
      [name](x) {
        throw new Error(
          `Invalid function pointer called with signature '${sig}'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this): ${x}`
        );
      }
    }[name];
  }
);

syscallNames = {
  6: "close",
  54: "ioctl",
  140: "llseek",
  145: "readv",
  146: "writev"
};
[6, 54, 140, 145, 146].forEach(n => {
  const name = `___syscall${n}`;
  const altName = syscallNames[n];
  envImports[name] = {
    [altName](x) {
      throw new Error(`syscall ${n} (${altName}) not supported yet`);
    }
  }[altName];
});

module.exports = {
  importObj: { global: globalImports, env: envImports, errNoObj },
  errNoObj
};
