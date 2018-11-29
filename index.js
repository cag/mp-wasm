module.exports = new Promise(function(resolve, reject) {
  try {
    require('./libs-build')().then(function({
      Pointer_stringify, stringToUTF8,
      getValue,
      _malloc, _free,
      _sizeof_mp_limb_t, _sizeof_mpfr_struct, _get_MPFR_PREC_MIN, _get_MPFR_PREC_MAX,
      _mpfr_init, _mpfr_init2, _mpfr_clear,
      _mpfr_set_prec, _mpfr_get_prec,
      _mpfr_set_d,
      _conv_mpfr_to_str, _mpfr_free_str
    }) {

const mpLimbSize = _sizeof_mp_limb_t()

class MPFloat {

  constructor(initialValue, base, roundMode, prec) {
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

  set(newValue, base, roundMode) {
    if(typeof newValue === 'number') {
      roundMode = base
      _mpfr_set_d(this.mpfrPtr, newValue, roundMode || mpf.roundTiesToEven)
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
        '0x' + [getValue(dptr + 8*i, '*'), getValue(dptr + 8*i + 4, '*')]
          .map(v => ('00000000' + ((v + 4294967296) % 4294967296).toString(16)).slice(-8))
          .reverse()
          .join('')
      ).join(' ')
    }`

    return str
  }
}

function mpf(...args) { return new MPFloat(...args) }
mpf.prototype = mpf.prototype

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

return resolve({ mpf })

    })
  } catch(e) {
    return reject(e)
  }
})
