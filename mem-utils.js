const utf8Encoder = new TextEncoder('utf-8')
const utf8Decoder = new TextDecoder('utf-8')

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
    float64: new Float64Array(memory.buffer),
  }

  const { _malloc } = wasmInstance.exports

  return {
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
  }
}
