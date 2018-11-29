const { camelize } = require('humps')

module.exports = new Promise(function(resolve, reject) {
  try {
    require('./libs-build')().then(function(Module) {

const {
  Pointer_stringify, stringToUTF8,
  getValue,
  _malloc, _free,
  _sizeof_mp_limb_t, _sizeof_mpfr_struct, _get_MPFR_PREC_MIN, _get_MPFR_PREC_MAX,
  _mpfr_init, _mpfr_init2, _mpfr_clear,
  _mpfr_set_prec, _mpfr_get_prec,
  _mpfr_set, _mpfr_set_d, _mpfr_set_str,
  _conv_mpfr_to_str, _mpfr_free_str,
} = Module

const mpLimbSize = _sizeof_mp_limb_t()

class MPFloat {

  constructor(initialValue, opts) {
    const { base, roundMode, prec } = opts || {}
    this.mpfrPtr = _malloc(mpf.structSize)

    try {
      if(typeof prec === 'number' && prec === prec | 0 && prec >= mpf.precMin && prec <= mpf.precMax) {
        _mpfr_init2(this.mpfrPtr, prec)
      } else if (prec == null) {
        _mpfr_init(this.mpfrPtr)
      } else
        throw new Error(`invalid precision ${prec}`)

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

  setPrec() {
    return _mpfr_set_prec(this.mpfrPtr)
  }

  getPrec() {
    return _mpfr_get_prec(this.mpfrPtr)
  }

  set(newValue, opts) {
    const { base, roundMode } = opts || {}
    if(typeof newValue === 'number') {
      _mpfr_set_d(this.mpfrPtr, newValue, roundMode || mpf.roundTiesToEven)
    } else if(typeof newValue === 'object' && newValue instanceof MPFloat) {
      _mpfr_set(this.mpfrPtr, newValue.mpfrPtr, roundMode || mpf.roundTiesToEven)
    } else if(
      typeof newValue === 'string' ||
      typeof newValue === 'bigint' ||
      typeof newValue === 'object' && !(newValue instanceof MPFloat)
    ) {
      const valAsCStr = _malloc(newValue.length * 4 + 1)
      stringToUTF8(newValue, valAsCStr, newValue.length * 4 + 1)
      _mpfr_set_str(this.mpfrPtr, valAsCStr, base || 0, roundMode || mpf.roundTiesToEven)
      _free(valAsCStr)
    } else {
      throw new Error(`unexpected set value ${newValue}`)
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

;[
  'sqr', 'sqrt', 'rec_sqrt', 'cbrt', 'neg', 'abs',
  'log2', 'log10', 'log1p',
  'exp', 'exp2', 'exp10', 'expm1',
  'cos', 'sin', 'tan', 'sec', 'csc', 'cot',
  'acos', 'asin', 'atan',
  'cosh', 'sinh', 'tanh', 'sech', 'csch', 'coth',
  'acosh', 'asinh', 'atanh',
  'eint', 'li2', 'gamma', 'lngamma', 'digamma',
  'zeta', 'erf', 'j0', 'j1', 'y0', 'y1',
  'rint', 'rint_ceil', 'rint_floor', 'rint_round', 'rint_roundeven', 'rint_trunc',
  'frac',
].forEach((op) => {
  const name = camelize(op)
  mpf[name] = {[name](a, opts) {
    const { roundMode } = opts || {}
    const ret = mpf(a, opts)
    Module[`_mpfr_${op}`](ret.mpfrPtr, ret.mpfrPtr, roundMode || mpf.roundTiesToEven)
    return ret
  }}[name]
})

;['add', 'sub', 'mul', 'div'].forEach((op) => {
  const name = camelize(op)
  mpf[name] = {[name](a, b, opts) {
    const { roundMode } = opts || {}
    const ret = mpf(null, opts)
    let shouldDestroyB = false

    if(
      typeof a === 'string' ||
      typeof a === 'bigint' ||
      typeof a === 'object' && !(a instanceof MPFloat)
    ) {
      ret.set(a.toString(), opts)
      a = ret
    }

    if(
      typeof b === 'string' ||
      typeof b === 'bigint' ||
      typeof b === 'object' && !(b instanceof MPFloat)
    ) {
      b = mpf(b.toString(), opts)
      shouldDestroyB = true
    }

    if(typeof a === 'object' && a instanceof MPFloat) {
      if(typeof b === 'object' && b instanceof MPFloat) {
        Module[`_mpfr_${op}`](ret.mpfrPtr, a.mpfrPtr, b.mpfrPtr, roundMode || mpf.roundTiesToEven)
      } else if(typeof b === 'number') {
        Module[`_mpfr_${op}_d`](ret.mpfrPtr, a.mpfrPtr, b, roundMode || mpf.roundTiesToEven)
      } else {
        throw new Error(`don't know how to ${op} ${a} and ${b}`)
      }
    } else if(typeof a === 'number') {
      if(typeof b === 'object' && b instanceof MPFloat) {
        if(Module[`_mpfr_d_${op}`])
          Module[`_mpfr_d_${op}`](ret.mpfrPtr, a, b.mpfrPtr, roundMode || mpf.roundTiesToEven)
        else
          Module[`_mpfr_${op}_d`](ret.mpfrPtr, b.mpfrPtr, a, roundMode || mpf.roundTiesToEven)
      } else if(typeof b === 'number') {
        _mpfr_set_d(ret.mpfrPtr, a, roundMode || mpf.roundTiesToEven)
        Module[`_mpfr_${op}_d`](ret.mpfrPtr, ret.mpfrPtr, b, roundMode || mpf.roundTiesToEven)
      } else {
        throw new Error(`don't know how to ${op} ${a} and ${b}`)
      }
    }

    if(shouldDestroyB) {
      b.destroy()
      b = null
    }

    return ret
  }}[name]
})

return resolve({ mpf })

    })
  } catch(e) {
    return reject(e)
  }
})
