const { camelize } = require('humps')

module.exports = new Promise(function(resolve, reject) {
  try {
    require('./libs-build')().then(function(Module) {

const {
  Pointer_stringify, stringToUTF8,
  getValue,
  _malloc, _free,
  _sizeof_mp_limb_t, _sizeof_mpfr_struct, _sizeof_unsigned_long,
  _get_MPFR_PREC_MIN, _get_MPFR_PREC_MAX,
  _mpfr_init, _mpfr_init2, _mpfr_clear,
  _mpfr_set_prec, _mpfr_get_prec,
  _mpfr_set_default_prec, _mpfr_get_default_prec,
  _mpfr_set, _mpfr_set_d, _mpfr_set_str,
  _conv_mpfr_to_str, _mpfr_free_str, _mpfr_get_d,
  _mpfr_nan_p, _mpfr_number_p, _mpfr_integer_p,
} = Module

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

function isUnsignedLong(n) {
  return Number.isInteger(n) && n >= 0 && n < unsignedLongLimit
}

function isSignedLong(n) {
  return Number.isInteger(n) && n >= signedLongLimits[0] && n < signedLongLimits[1]
}

class MPFloat {

  constructor(initialValue, opts) {
    const { base, roundMode, prec } = opts || {}
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
          this.set(initialValue, base, roundMode)
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
    const { base, roundMode } = opts || {}
    if(typeof newValue === 'number') {
      _mpfr_set_d(this.mpfrPtr, newValue, roundMode || mpf.roundTiesToEven)
    } else if(mpf.isMPFloat(newValue)) {
      _mpfr_set(this.mpfrPtr, newValue.mpfrPtr, roundMode || mpf.roundTiesToEven)
    } else if(
      typeof newValue === 'string' ||
      typeof newValue === 'bigint' ||
      typeof newValue === 'object'
    ) {
      const valAsCStr = _malloc(newValue.length * 4 + 1)
      stringToUTF8(newValue, valAsCStr, newValue.length * 4 + 1)
      _mpfr_set_str(this.mpfrPtr, valAsCStr, base || 0, roundMode || mpf.roundTiesToEven)
      _free(valAsCStr)
    } else {
      throw new Error(`can't set value to ${newValue}`)
    }
  }

  toString() {
    const ptr = _conv_mpfr_to_str(this.mpfrPtr)
    if(ptr === 0)
      throw new Error(`could not convert mpfr at ${this.mpfrPtr} to string`)
    const ret = Pointer_stringify(ptr)
    _mpfr_free_str(ptr)
    return ret
  }

  toNumber(opts) {
    const { roundMode } = opts || {}
    return _mpfr_get_d(this.mpfrPtr, roundMode || mpf.roundTiesToEven)
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

  dumpInternals() {
    const precision = getValue(this.mpfrPtr, 'i32')
    const dptr = getValue(this.mpfrPtr + 12, '*')
    const str = `precision: ${
      precision
    } -- sign: ${
      getValue(this.mpfrPtr + 4, 'i32')
    } -- exp: ${
      getValue(this.mpfrPtr + 8, 'i32')
    } -- limbs: ${
      [...Array(Math.ceil(precision / mpLimbSize / 8)).keys()].map(i =>
        '0x' + [getValue(dptr + 8 * i, '*'), getValue(dptr + 8 * i + 4, '*')]
          .map(v => ('00000000' + ((v + 4294967296) % 4294967296).toString(16)).slice(-8))
          .reverse()
          .join('')
      ).join(' ')
    }`

    return str
  }
}

function mpf(...args) { return new MPFloat(...args) }
mpf.prototype = MPFloat.prototype

mpf.structSize = _sizeof_mpfr_struct()
mpf.precMin = _get_MPFR_PREC_MIN()
mpf.precMax = _get_MPFR_PREC_MAX()

mpf.roundTiesToEven = 0
mpf.roundTowardZero = 1
mpf.roundTowardPositive = 2
mpf.roundTowardNegative = 3
mpf.roundAwayZero = 4
mpf.roundFaithful = 5
mpf.roundTiesToAwayZero = -1

mpf.getDefaultPrec = function getDefaultPrec() {
  return _mpfr_get_default_prec()
}

mpf.setDefaultPrec = function setDefaultPrec(prec) {
  checkValidPrec(prec)
  _mpfr_set_default_prec(prec)
}

mpf.isMPFloat = function isMPFloat(value) {
  return typeof value === 'object' && value instanceof MPFloat
}

;['log2', 'pi', 'euler', 'catalan'].forEach(constant => {
  const name = `get${constant.charAt(0).toUpperCase()}${constant.slice(1)}`
  const fn = Module[`_mpfr_const_${constant}`]
  mpf[name] = {[name](opts) {
    const { roundMode } = opts || {}
    const ret = mpf(null, opts)
    fn(ret.mpfrPtr, roundMode || mpf.roundTiesToEven)
    return ret
  }}[name]
})

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

    const { roundMode } = opts || {}
    const ret = mpf(a, opts)

    let fn, arg

    if((fn = Module[`_mpfr_${op}_ui`]) && isUnsignedLong(a)) {
      arg = a
    } else if(fn = Module[`_mpfr_${op}`]) {
      arg = ret.mpfrPtr
    } else {
      throw new Error(`can't perform ${op} on ${a}`)
    }

    fn(ret.mpfrPtr, arg, roundMode || mpf.roundTiesToEven)
    return ret
  }}[name]
})

;['ceil', 'floor', 'round', 'roundeven', 'trunc'].forEach((op) => {
  const name = camelize(op)
  const fn = Module[`_mpfr_${op}`]
  mpf[name] = {[name](a, opts) {
    if(a == null) throw new Error('missing argument')

    const { roundMode } = opts || {}
    const ret = mpf(a, opts)

    fn(ret.mpfrPtr, ret.mpfrPtr)
    return ret
  }}[name]
})

;[
  'add', 'sub', 'mul', 'div',
  'rootn', 'pow', 'dim',
  'atan2', 'gamma_inc',
  'beta', 'agm', 'hypot',
  'fmod', 'remainder',
].forEach((op) => {
  const name = camelize(op)
  mpf[name] = {[name](a, b, opts) {
    if(a == null) throw new Error('missing first argument')
    if(b == null) throw new Error('missing second argument')

    const { roundMode } = opts || {}
    const ret = mpf(null, opts)
    let shouldDestroyB = false

    try {
      let fn, arg1, arg2

      // here is a long chain of responsibility...
      // castless cases
      if((fn = Module[`_mpfr_d_${op}`]) && typeof a === 'number' && mpf.isMPFloat(b)) {
        arg1 = a
        arg2 = b.mpfrPtr
      } else if((fn = Module[`_mpfr_${op}_d`]) && mpf.isMPFloat(a) && typeof b === 'number') {
        arg1 = a.mpfrPtr
        arg2 = b
      } else if(fn && typeof a === 'number' && mpf.isMPFloat(b)) {
        // assume op is commutative if _mpfr_d_${op} does not exist
        arg1 = b.mpfrPtr
        arg2 = a
      } else if((fn = Module[`_mpfr_ui_${op}_ui`]) && isUnsignedLong(a) && isUnsignedLong(b)) {
        arg1 = a
        arg2 = b
      } else if((fn = Module[`_mpfr_${op}_ui`]) && mpf.isMPFloat(a) && isUnsignedLong(b)) {
        arg1 = a.mpfrPtr
        arg2 = b
      } else if((fn = Module[`_mpfr_${op}_si`]) && mpf.isMPFloat(a) && isSignedLong(b)) {
        arg1 = a.mpfrPtr
        arg2 = b
      } else if((fn = Module[`_mpfr_ui_${op}`]) && isUnsignedLong(a) && mpf.isMPFloat(b)) {
        arg1 = a
        arg2 = b.mpfrPtr
      } else if((fn = Module[`_mpfr_${op}`]) && mpf.isMPFloat(a) && mpf.isMPFloat(b)) {
        arg1 = a.mpfrPtr
        arg2 = b.mpfrPtr
      }
      // casted cases
      else if((fn = Module[`_mpfr_d_${op}`]) && typeof a === 'number') {
        ret.set(b, opts)
        b = ret
        arg1 = a
        arg2 = b.mpfrPtr
      } else if((fn = Module[`_mpfr_${op}_d`]) && typeof b === 'number') {
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
      } else if((fn = Module[`_mpfr_${op}_ui`]) && isUnsignedLong(b)) {
        ret.set(a, opts)
        a = ret
        arg1 = a.mpfrPtr
        arg2 = b
      } else if((fn = Module[`_mpfr_${op}_si`]) && isSignedLong(b)) {
        ret.set(a, opts)
        a = ret
        arg1 = a.mpfrPtr
        arg2 = b
      } else if((fn = Module[`_mpfr_ui_${op}`]) && isUnsignedLong(a)) {
        ret.set(b, opts)
        b = ret
        arg1 = a
        arg2 = b.mpfrPtr
      } else if((fn = Module[`_mpfr_${op}`]) && mpf.isMPFloat(b)) {
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

      fn(ret.mpfrPtr, arg1, arg2, roundMode || mpf.roundTiesToEven)

    } finally {
      if(shouldDestroyB) {
        b.destroy()
        b = null
      }
    }

    return ret
  }}[name]
})

;['jn', 'yn'].forEach((op) => {
  const name = camelize(op)
  const fn = Module[`_mpfr_${op}`]
  mpf[name] = {[name](n, a, opts) {
    if(n == null) throw new Error('missing n')
    if(a == null) throw new Error('missing argument')
    if(!isSignedLong(n)) {
      throw new Error(`can't perform ${op} with invalid n=${n} (a = ${a})`)
    }

    const { roundMode } = opts || {}
    const ret = mpf(a, opts)

    fn(ret.mpfrPtr, n, ret.mpfrPtr, roundMode || mpf.roundTiesToEven)

    return ret
  }}[name]
})

const { _mpfr_cmp, _mpfr_cmp_d, _mpfr_cmpabs } = Module

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

    const res = Boolean(Module[`_mpfr_${op}_p`](this.mpfrPtr, other.mpfrPtr))

    if(shouldDestroyOther) {
      other.destroy()
      other = null
    }

    return res
  }}[name]
})

return resolve({ mpf })

    })
  } catch(e) {
    return reject(e)
  }
})
