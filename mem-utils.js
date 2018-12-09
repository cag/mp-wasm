const assert = require("assert");
const { LRUMap } = require("lru_map");

const utf8Encoder = new TextEncoder("utf-8");
const utf8Decoder = new TextDecoder("utf-8");

module.exports = function(memory, wasmInstance) {
  const memViews = {
    int8: new Int8Array(memory.buffer),
    uint8: new Uint8Array(memory.buffer),
    uint8Clamped: new Uint8ClampedArray(memory.buffer),
    int16: new Int16Array(memory.buffer),
    uint16: new Uint16Array(memory.buffer),
    int32: new Int32Array(memory.buffer),
    uint32: new Uint32Array(memory.buffer),
    float32: new Float32Array(memory.buffer),
    float64: new Float64Array(memory.buffer)
  };

  const { _malloc, _sizeof_unsigned_long } = wasmInstance.exports;

  const wordSize = _sizeof_unsigned_long();
  const memWordView = memViews[`uint${wordSize * 8}`];
  const memSwordView = memViews[`int${wordSize * 8}`];
  const wordLimit = 1 << (wordSize * 8);
  const swordLimits = [-(1 << (wordSize * 8 - 1)), 1 << (wordSize * 8 - 1)];

  const registerSize = 16;
  const numRegisters = 8;
  const registersBeginPtr = _malloc(registerSize * numRegisters);
  const initRegister = Symbol("initRegister");
  const clearRegister = Symbol("clearRegister");
  const registersObjMap = new LRUMap(numRegisters);
  registersObjMap.assign([...Array(numRegisters).keys()].map(n => [n, null]));
  registersObjMap.shift = function shift() {
    const [n, obj] = LRUMap.prototype.shift.call(this);
    if (obj != null) {
      obj[clearRegister](getRegisterPtr(n));
      objsRegisterNumMap.delete(obj);
    }
    return [n, obj];
  };

  const objsRegisterNumMap = new WeakMap();

  function getRegisterPtr(n) {
    assert(
      Number.isInteger(n) && n >= 0 && n < numRegisters,
      `invalid register number ${n}`
    );
    return registersBeginPtr + n * registerSize;
  }

  function ensureRegister(obj) {
    let registerPtr;
    if (objsRegisterNumMap.has(obj)) {
      n = objsRegisterNumMap.get(obj);
      assert(
        registersObjMap.get(n) === obj,
        `wrong object found in register ${n}`
      );
      registerPtr = getRegisterPtr(n);
    } else {
      n = registersObjMap.shift()[0];
      registerPtr = getRegisterPtr(n);

      registersObjMap.set(n, obj);
      objsRegisterNumMap.set(obj, n);

      obj[initRegister](registerPtr);
    }
    return registerPtr;
  }

  return {
    isWord(n) {
      return Number.isInteger(n) && n >= 0 && n < wordLimit;
    },

    isSword(n) {
      return Number.isInteger(n) && n >= swordLimits[0] && n < swordLimits[1];
    },

    ensureRegister,
    initRegister,
    clearRegister,

    memViews,

    stringToNewCStr(str) {
      const b = utf8Encoder.encode(str);
      const ptr = _malloc(b.length + 1);
      memViews.uint8.set(b, ptr);
      memViews.uint8[ptr + b.length] = 0;
      return ptr;
    },
    cstrToString(ptr) {
      let length;
      for (length = 0; memViews.uint8[ptr + length] !== 0; ++length);
      return utf8Decoder.decode(new DataView(memory.buffer, ptr, length));
    }
  };
};
