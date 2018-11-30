(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
global.fetchMPWasm = function fetchMPWasm(source) {
  const { importObj, errNoObj } = require('./setup')
  const memory = importObj.env.memory

  return WebAssembly.instantiateStreaming(fetch(source), importObj)
  .then(obj => {
    const wasmInstance = obj.instance
    errNoObj.getLoc = wasmInstance.exports.___errno_location

    const memUtils = require('./mem-utils')(memory, wasmInstance)
    const mpf = require('./mpf')(wasmInstance, memUtils)

    return { mpf }
  })
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./mem-utils":2,"./mpf":3,"./setup":5}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
const { camelize } = require('humps')

module.exports = function(wasmInstance, memUtils) {

  const wasmExports = wasmInstance.exports
  const { ptrToString, stringToPtr } = memUtils

  const {
    _malloc, _free,
    _sizeof_mp_limb_t, _sizeof_mpfr_struct, _sizeof_unsigned_long,
    _get_MPFR_PREC_MIN, _get_MPFR_PREC_MAX,
    _mpfr_init, _mpfr_init2, _mpfr_clear,
    _mpfr_set_prec, _mpfr_get_prec,
    _mpfr_set_default_prec, _mpfr_get_default_prec,
    _mpfr_set_default_rounding_mode, _mpfr_get_default_rounding_mode,
    _mpfr_set, _mpfr_set_d, _mpfr_set_str,
    _conv_mpfr_to_str, _mpfr_free_str, _mpfr_get_d,
    _mpfr_nan_p, _mpfr_number_p, _mpfr_integer_p,
  } = wasmExports

  const unsignedLongSize = _sizeof_unsigned_long()
  const unsignedLongLimit = 2 ** (unsignedLongSize * 4)
  const signedLongLimits = [-(2 ** (unsignedLongSize * 4 - 1)), 2 ** (unsignedLongSize * 4 - 1)]
  const mpLimbSize = _sizeof_mp_limb_t()

  function checkValidPrec(prec) {
    if(
      prec == null ||
      typeof prec !== 'number' ||
      !Number.isInteger(prec) ||
      prec < mpf.precMin ||
      prec > mpf.precMax
    ) {
      throw new Error(`invalid precision value ${prec}`)
    }
  }

  function checkValidRoundingMode(roundingMode) {
    if(
      roundingMode == null ||
      typeof roundingMode !== 'number' ||
      !mpf.roundingModeNames.hasOwnProperty(roundingMode)
    ) {
      throw new Error(`invalid rounding mode ${roundingMode}`)
    }
  }

  function normalizeRoundingMode(roundingMode) {
    if(roundingMode == null)
      return mpf.getDefaultRoundingMode()

    if(typeof roundingMode === 'number' && mpf.roundingModeNames.hasOwnProperty(roundingMode))
      return roundingMode

    if(typeof roundingMode === 'string' && mpf.roundingModes.hasOwnProperty(roundingMode))
      return mpf.roundingModes[roundingMode]

    throw new Error(`invalid rounding mode ${roundingMode}`)
  }

  function isUnsignedLong(n) {
    return Number.isInteger(n) && n >= 0 && n < unsignedLongLimit
  }

  function isSignedLong(n) {
    return Number.isInteger(n) && n >= signedLongLimits[0] && n < signedLongLimits[1]
  }

  class MPFloat {

    constructor(initialValue, opts) {
      const { prec } = opts || {}
      this.mpfrPtr = _malloc(mpf.structSize)

      try {
        if (prec == null) {
          _mpfr_init(this.mpfrPtr)
        } else {
          checkValidPrec(prec)
          _mpfr_init2(this.mpfrPtr, prec)
        }

        try {
          if(initialValue != null) {
            this.set(initialValue, opts)
          }
        } catch(e) {
          this.destroy()
          throw e
        }
      } catch(e) {
        _free(this.mpfrPtr)
        this.mpfrPtr = 0
        throw e
      }
    }

    destroy() {
      _mpfr_clear(this.mpfrPtr)
      _free(this.mpfrPtr)
      this.mpfrPtr = 0
    }

    setPrec(prec) {
      checkValidPrec(prec)
      return _mpfr_set_prec(this.mpfrPtr, prec)
    }

    getPrec() {
      return _mpfr_get_prec(this.mpfrPtr)
    }

    set(newValue, opts) {
      const { base, roundingMode } = opts || {}
      if(typeof newValue === 'number') {
        _mpfr_set_d(this.mpfrPtr, newValue, normalizeRoundingMode(roundingMode))
      } else if(mpf.isMPFloat(newValue)) {
        _mpfr_set(this.mpfrPtr, newValue.mpfrPtr, normalizeRoundingMode(roundingMode))
      } else if(
        typeof newValue === 'string' ||
        typeof newValue === 'bigint' ||
        typeof newValue === 'object'
      ) {
        const valAsCStr = stringToPtr(newValue)
        _mpfr_set_str(this.mpfrPtr, valAsCStr, base || 0, normalizeRoundingMode(roundingMode))
        _free(valAsCStr)
      } else {
        throw new Error(`can't set value to ${newValue}`)
      }
    }

    toString() {
      const ptr = _conv_mpfr_to_str(this.mpfrPtr)
      if(ptr === 0)
        throw new Error(`could not convert mpfr at ${this.mpfrPtr} to string`)
      const ret = ptrToString(ptr)
      _mpfr_free_str(ptr)
      return ret
    }

    toNumber(opts) {
      const { roundingMode } = opts || {}
      return _mpfr_get_d(this.mpfrPtr, normalizeRoundingMode(roundingMode))
    }

    isNaN() {
      return Boolean(_mpfr_nan_p(this.mpfrPtr))
    }

    isFinite() {
      return Boolean(_mpfr_number_p(this.mpfrPtr))
    }

    isInteger() {
      return Boolean(_mpfr_integer_p(this.mpfrPtr))
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
      return `mpf('${this.toString()}')`
    }
  }

  function mpf(...args) { return new MPFloat(...args) }
  mpf.prototype = MPFloat.prototype

  mpf.structSize = _sizeof_mpfr_struct()
  mpf.precMin = _get_MPFR_PREC_MIN()
  mpf.precMax = _get_MPFR_PREC_MAX()

  mpf.roundingModeNames = {}
  mpf.roundingModes = {}
  ;[
    ['roundTiesToEven', 0],
    ['roundTowardZero', 1],
    ['roundTowardPositive', 2],
    ['roundTowardNegative', 3],
    ['roundAwayZero', 4],
    ['roundFaithful', 5],
    ['roundTiesToAwayZero', -1],
  ].forEach(([name, value]) => {
    mpf.roundingModeNames[value] = name;
    mpf.roundingModes[name] = value;
  })
  Object.freeze(mpf.roundingModeNames)
  Object.freeze(mpf.roundingModes)

  mpf.getDefaultPrec = function getDefaultPrec() {
    return _mpfr_get_default_prec()
  }

  mpf.setDefaultPrec = function setDefaultPrec(prec) {
    checkValidPrec(prec)
    _mpfr_set_default_prec(prec)
  }

  mpf.getDefaultRoundingMode = function getDefaultRoundingMode() {
    return _mpfr_get_default_rounding_mode()
  }

  mpf.setDefaultRoundingMode = function setDefaultRoundingMode(roundingMode) {
    if(roundingMode == null) throw new Error('missing rounding mode')
    _mpfr_set_default_rounding_mode(normalizeRoundingMode(roundingMode))
  }

  mpf.isMPFloat = function isMPFloat(value) {
    return typeof value === 'object' && value instanceof MPFloat
  }

  ;['log2', 'pi', 'euler', 'catalan'].forEach(constant => {
    const name = `get${constant.charAt(0).toUpperCase()}${constant.slice(1)}`
    const fn = wasmExports[`_mpfr_const_${constant}`]
    mpf[name] = {[name](opts) {
      const { roundingMode } = opts || {}
      const ret = mpf(null, opts)
      fn(ret.mpfrPtr, normalizeRoundingMode(roundingMode))
      return ret
    }}[name]
  })

  curriedOps = []

  ;[
    'sqr', 'sqrt', 'rec_sqrt', 'cbrt', 'neg', 'abs',
    'log', 'log2', 'log10', 'log1p',
    'exp', 'exp2', 'exp10', 'expm1',
    'cos', 'sin', 'tan', 'sec', 'csc', 'cot',
    'acos', 'asin', 'atan',
    'cosh', 'sinh', 'tanh', 'sech', 'csch', 'coth',
    'acosh', 'asinh', 'atanh', 'fac',
    'eint', 'li2', 'gamma', 'lngamma', 'digamma',
    'zeta', 'erf', 'erfc', 'j0', 'j1', 'y0', 'y1',
    'rint', 'rint_ceil', 'rint_floor', 'rint_round', 'rint_roundeven', 'rint_trunc',
    'frac',
  ].forEach((op) => {
    const name = camelize(op)
    mpf[name] = {[name](a, opts) {
      if(a == null) throw new Error('missing argument')

      const { roundingMode } = opts || {}
      const ret = mpf(a, opts)

      let fn, arg

      if((fn = wasmExports[`_mpfr_${op}_ui`]) && isUnsignedLong(a)) {
        arg = a
      } else if(fn = wasmExports[`_mpfr_${op}`]) {
        arg = ret.mpfrPtr
      } else {
        throw new Error(`can't perform ${op} on ${a}`)
      }

      fn(ret.mpfrPtr, arg, normalizeRoundingMode(roundingMode))
      return ret
    }}[name]
    if(name !== 'fac') curriedOps.push(name)
  })

  ;['ceil', 'floor', 'round', 'roundeven', 'trunc'].forEach((op) => {
    const name = camelize(op)
    const fn = wasmExports[`_mpfr_${op}`]
    mpf[name] = {[name](a, opts) {
      if(a == null) throw new Error('missing argument')

      const { roundingMode } = opts || {}
      const ret = mpf(a, opts)

      fn(ret.mpfrPtr, ret.mpfrPtr)
      return ret
    }}[name]
    curriedOps.push(name)
  })

  ;[
    'add', 'sub', 'mul', 'div',
    'rootn', 'pow', 'dim',
    'atan2', 'gamma_inc',
    'beta', 'agm', 'hypot',
    'fmod', 'remainder',
    'min', 'max',
  ].forEach((op) => {
    const name = camelize(op)
    mpf[name] = {[name](a, b, opts) {
      if(a == null) throw new Error('missing first argument')
      if(b == null) throw new Error('missing second argument')

      const { roundingMode } = opts || {}
      const ret = mpf(null, opts)
      let shouldDestroyB = false

      try {
        let fn, arg1, arg2

        // here is a long chain of responsibility...
        // castless cases
        if((fn = wasmExports[`_mpfr_d_${op}`]) && typeof a === 'number' && mpf.isMPFloat(b)) {
          arg1 = a
          arg2 = b.mpfrPtr
        } else if((fn = wasmExports[`_mpfr_${op}_d`]) && mpf.isMPFloat(a) && typeof b === 'number') {
          arg1 = a.mpfrPtr
          arg2 = b
        } else if(fn && typeof a === 'number' && mpf.isMPFloat(b)) {
          // assume op is commutative if _mpfr_d_${op} does not exist
          arg1 = b.mpfrPtr
          arg2 = a
        } else if((fn = wasmExports[`_mpfr_ui_${op}_ui`]) && isUnsignedLong(a) && isUnsignedLong(b)) {
          arg1 = a
          arg2 = b
        } else if((fn = wasmExports[`_mpfr_${op}_ui`]) && mpf.isMPFloat(a) && isUnsignedLong(b)) {
          arg1 = a.mpfrPtr
          arg2 = b
        } else if((fn = wasmExports[`_mpfr_${op}_si`]) && mpf.isMPFloat(a) && isSignedLong(b)) {
          arg1 = a.mpfrPtr
          arg2 = b
        } else if((fn = wasmExports[`_mpfr_ui_${op}`]) && isUnsignedLong(a) && mpf.isMPFloat(b)) {
          arg1 = a
          arg2 = b.mpfrPtr
        } else if((fn = wasmExports[`_mpfr_${op}`]) && mpf.isMPFloat(a) && mpf.isMPFloat(b)) {
          arg1 = a.mpfrPtr
          arg2 = b.mpfrPtr
        }
        // casted cases
        else if((fn = wasmExports[`_mpfr_d_${op}`]) && typeof a === 'number') {
          ret.set(b, opts)
          b = ret
          arg1 = a
          arg2 = b.mpfrPtr
        } else if((fn = wasmExports[`_mpfr_${op}_d`]) && typeof b === 'number') {
          ret.set(a, opts)
          a = ret
          arg1 = a.mpfrPtr
          arg2 = b
        } else if(fn && typeof a === 'number') {
          // (commutativity assumption again)
          ret.set(b, opts)
          b = ret
          arg1 = b.mpfrPtr
          arg2 = a
        } else if((fn = wasmExports[`_mpfr_${op}_ui`]) && isUnsignedLong(b)) {
          ret.set(a, opts)
          a = ret
          arg1 = a.mpfrPtr
          arg2 = b
        } else if((fn = wasmExports[`_mpfr_${op}_si`]) && isSignedLong(b)) {
          ret.set(a, opts)
          a = ret
          arg1 = a.mpfrPtr
          arg2 = b
        } else if((fn = wasmExports[`_mpfr_ui_${op}`]) && isUnsignedLong(a)) {
          ret.set(b, opts)
          b = ret
          arg1 = a
          arg2 = b.mpfrPtr
        } else if((fn = wasmExports[`_mpfr_${op}`]) && mpf.isMPFloat(b)) {
          ret.set(a, opts)
          a = ret
          arg1 = a.mpfrPtr
          arg2 = b.mpfrPtr
        } else if(fn && mpf.isMPFloat(a)) {
          ret.set(b, opts)
          b = ret
          arg1 = a.mpfrPtr
          arg2 = b.mpfrPtr
        } else if(fn) {
          ret.set(a, opts)
          a = ret
          b = mpf(b, opts)
          shouldDestroyB = true
          arg1 = a.mpfrPtr
          arg2 = b.mpfrPtr
        }
        // couldn't find anything
        else {
          throw new Error(`can't perform ${op} on ${a} and ${b}`)
        }

        fn(ret.mpfrPtr, arg1, arg2, normalizeRoundingMode(roundingMode))

      } finally {
        if(shouldDestroyB) {
          b.destroy()
          b = null
        }
      }

      return ret
    }}[name]
    curriedOps.push(name)
  })

  ;['jn', 'yn'].forEach((op) => {
    const name = camelize(op)
    const fn = wasmExports[`_mpfr_${op}`]
    mpf[name] = {[name](n, a, opts) {
      if(n == null) throw new Error('missing n')
      if(a == null) throw new Error('missing argument')
      if(!isSignedLong(n)) {
        throw new Error(`can't perform ${op} with invalid n=${n} (a = ${a})`)
      }

      const { roundingMode } = opts || {}
      const ret = mpf(a, opts)

      fn(ret.mpfrPtr, n, ret.mpfrPtr, normalizeRoundingMode(roundingMode))

      return ret
    }}[name]
    curriedOps.push(name)
  })

  const { _mpfr_cmp, _mpfr_cmp_d, _mpfr_cmpabs } = wasmExports

  mpf.cmp = function cmp(a, b) {
    let shouldDestroyA = false
    let shouldDestroyB = false

    try {
      if(
        typeof a === 'string' ||
        typeof a === 'bigint' ||
        typeof a === 'object' && !(a instanceof MPFloat)
      ) {
        a = mpf(a.toString())
        shouldDestroyA = true
      }

      if(
        typeof b === 'string' ||
        typeof b === 'bigint' ||
        typeof b === 'object' && !(b instanceof MPFloat)
      ) {
        b = mpf(b.toString())
        shouldDestroyB = true
      }

      let ret

      if(mpf.isMPFloat(a)) {
        if(mpf.isMPFloat(b)) {
          ret = _mpfr_cmp(a.mpfrPtr, b.mpfrPtr)
        } else if(typeof b === 'number') {
          ret = _mpfr_cmp_d(a.mpfrPtr, b)
        }
      } else if(typeof a === 'number') {
        if(mpf.isMPFloat(b)) {
          ret = -_mpfr_cmp_d(b.mpfrPtr, a)
        } else if(typeof b === 'number') {
          a = mpf(a)
          shouldDestroyA = true
          ret = _mpfr_cmp_d(a.mpfrPtr, b)
        }
      }

      if(ret == null)
        throw new Error(`don't know how to cmp ${a} and ${b}`)
    } finally {
      if(shouldDestroyA) {
        a.destroy()
        a = null
      }

      if(shouldDestroyB) {
        b.destroy()
        b = null
      }
    }

    return ret
  }
  curriedOps.push('cmp')

  mpf.cmpabs = function cmpabs(a, b) {
    let shouldDestroyA = false
    let shouldDestroyB = false

    if(!mpf.isMPFloat(a)) {
      a = mpf(a)
      shouldDestroyA = true
    }

    if(!mpf.isMPFloat(b)) {
      b = mpf(b)
      shouldDestroyB = true
    }

    const ret = _mpfr_cmpabs(a.mpfrPtr, b.mpfrPtr)

    if(shouldDestroyA) {
      a.destroy()
      a = null
    }

    if(shouldDestroyB) {
      b.destroy()
      b = null
    }

    return ret
  }
  curriedOps.push('cmpabs')

  ;[
    ['greater', 'gt'],
    ['greaterequal', 'gte'],
    ['less', 'lt'],
    ['lessequal', 'lte'],
    ['equal', 'eq'],
    ['lessgreater', 'lgt'],
  ].forEach(([op, name]) => {
    mpf.prototype[name] = {[name](other) {
      let shouldDestroyOther = false

      if(!mpf.isMPFloat(other)) {
        other = mpf(other)
        shouldDestroyOther = true
      }

      const res = Boolean(wasmExports[`_mpfr_${op}_p`](this.mpfrPtr, other.mpfrPtr))

      if(shouldDestroyOther) {
        other.destroy()
        other = null
      }

      return res
    }}[name]
  })

  curriedOps.forEach((name) => {
    mpf.prototype[name] = {[name](...args) {
      return mpf[name](this, ...args)
    }}[name]
  })

  return mpf
}

},{"humps":4}],4:[function(require,module,exports){
// =========
// = humps =
// =========
// Underscore-to-camelCase converter (and vice versa)
// for strings and object keys

// humps is copyright © 2012+ Dom Christie
// Released under the MIT license.


;(function(global) {

  var _processKeys = function(convert, obj, options) {
    if(!_isObject(obj) || _isDate(obj) || _isRegExp(obj) || _isBoolean(obj) || _isFunction(obj)) {
      return obj;
    }

    var output,
        i = 0,
        l = 0;

    if(_isArray(obj)) {
      output = [];
      for(l=obj.length; i<l; i++) {
        output.push(_processKeys(convert, obj[i], options));
      }
    }
    else {
      output = {};
      for(var key in obj) {
        if(Object.prototype.hasOwnProperty.call(obj, key)) {
          output[convert(key, options)] = _processKeys(convert, obj[key], options);
        }
      }
    }
    return output;
  };

  // String conversion methods

  var separateWords = function(string, options) {
    options = options || {};
    var separator = options.separator || '_';
    var split = options.split || /(?=[A-Z])/;

    return string.split(split).join(separator);
  };

  var camelize = function(string) {
    if (_isNumerical(string)) {
      return string;
    }
    string = string.replace(/[\-_\s]+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
    // Ensure 1st char is always lowercase
    return string.substr(0, 1).toLowerCase() + string.substr(1);
  };

  var pascalize = function(string) {
    var camelized = camelize(string);
    // Ensure 1st char is always uppercase
    return camelized.substr(0, 1).toUpperCase() + camelized.substr(1);
  };

  var decamelize = function(string, options) {
    return separateWords(string, options).toLowerCase();
  };

  // Utilities
  // Taken from Underscore.js

  var toString = Object.prototype.toString;

  var _isFunction = function(obj) {
    return typeof(obj) === 'function';
  };
  var _isObject = function(obj) {
    return obj === Object(obj);
  };
  var _isArray = function(obj) {
    return toString.call(obj) == '[object Array]';
  };
  var _isDate = function(obj) {
    return toString.call(obj) == '[object Date]';
  };
  var _isRegExp = function(obj) {
    return toString.call(obj) == '[object RegExp]';
  };
  var _isBoolean = function(obj) {
    return toString.call(obj) == '[object Boolean]';
  };

  // Performant way to determine if obj coerces to a number
  var _isNumerical = function(obj) {
    obj = obj - 0;
    return obj === obj;
  };

  // Sets up function which handles processing keys
  // allowing the convert function to be modified by a callback
  var _processor = function(convert, options) {
    var callback = options && 'process' in options ? options.process : options;

    if(typeof(callback) !== 'function') {
      return convert;
    }

    return function(string, options) {
      return callback(string, convert, options);
    }
  };

  var humps = {
    camelize: camelize,
    decamelize: decamelize,
    pascalize: pascalize,
    depascalize: decamelize,
    camelizeKeys: function(object, options) {
      return _processKeys(_processor(camelize, options), object);
    },
    decamelizeKeys: function(object, options) {
      return _processKeys(_processor(decamelize, options), object, options);
    },
    pascalizeKeys: function(object, options) {
      return _processKeys(_processor(pascalize, options), object);
    },
    depascalizeKeys: function () {
      return this.decamelizeKeys.apply(this, arguments);
    }
  };

  if (typeof define === 'function' && define.amd) {
    define(humps);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = humps;
  } else {
    global.humps = humps;
  }

})(this);

},{}],5:[function(require,module,exports){
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

const memViews = {
  uint8: new Uint8Array(memory.buffer),
  uint32: new Uint32Array(memory.buffer),
}

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

memViews.uint32[DYNAMICTOP_PTR >> 2] = dynamicBase;

let tempRet0 = 0
const errNoObj = {}

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
    const { getLoc } = errNoObj
    if(getLoc != null)
      memViews.uint32[getLoc() >> 2] = value;
    else
      console.warn("can't set errno", value)
    return value;
  },

  abort() {
    throw new Error('abort')
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
    initial: 70,
    maximum: 70,
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

module.exports = {
  importObj: { global: globalImports, env: envImports, errNoObj },
  errNoObj,
}

},{}]},{},[1]);
