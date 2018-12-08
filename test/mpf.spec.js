const assert = require('chai').assert

describe('mpf', () => {
  let mpWasm, mpf

  before(async () => {
    if (typeof window === 'undefined') {
        mpWasm = require('..')
    } else {
        require('../browser.js')
        mpWasm = await fetchMPWasm('/base/mp.wasm')
    }
    mpf = mpWasm.mpf
  })

  it('exists', () => {
    assert.exists(mpf)
  })

  it('by default constructs NaN', () => {
    const x = mpf()
    assert.exists(x, "x couldn't be initialized")
    assert.equal(x.toString(), 'nan')
    assert.isNaN(x.toNumber())
  })

  it('can have value changed', () => {
    const x = mpf()
    x.set(3.25)
    assert.equal(x.toNumber(), 3.25)
    x.set('-4.5')
    assert.equal(x.toNumber(), -4.5)
    x.set('123456789123456789')
    assert.equal(x.toNumber(), Number('123456789123456789'))
    const y = mpf()
    x.set(1)
    y.set(x)
    assert.equal(x.toNumber(), y.toNumber())
    assert.equal(y.toNumber(), 1)
    y.set(-5.5)
    assert.notEqual(x.toNumber(), y.toNumber())
  })

  it('can be constructed with an initial value', () => {
    const x = mpf(3.141592)
    assert.equal(x.toNumber(), 3.141592)
    const y = mpf('-4.1234')
    assert.equal(y.toNumber(), -4.1234)
    x.set('4.2')
    const z = mpf(x)
    assert.equal(x.toNumber(), 4.2)
  })

  it('can specify precision for values', () => {
    const vStr = '123.45678901234567890123456789012345678901234567890123456789012345678901234567890123'
    const v1 = mpf(vStr, { prec: 1 })
    assert.equal(v1.toNumber(), 128)

    const v53 = mpf(vStr, { prec: 53 })
    assert.equal(v53.toNumber(), Number(vStr))

    const v275 = mpf(vStr, { prec: 275 })
    assert.equal(v275.toString(), vStr)
  })

  it('has a default precision setting', () => {
    assert.equal(mpf.getDefaultPrec(), 53)

    const vStr = '123.45678901234567890123456789012345678901234567890123456789012345678901234567890123'
    const v53 = mpf(vStr)

    mpf.setDefaultPrec(1)
    assert.equal(mpf.getDefaultPrec(), 1)
    const v1a = mpf(vStr)
    const v1b = mpf(v53)
    assert.equal(v1a.toNumber(), 128)
    assert.equal(v1b.toNumber(), 128)
    assert.equal(v53.toNumber(), Number(vStr))

    mpf.setDefaultPrec(275)
    assert.equal(mpf.getDefaultPrec(), 275)
    const v275 = mpf(vStr)
    assert.equal(v275.toString(), vStr)
    assert.equal(v53.toNumber(), Number(vStr))

    mpf.setDefaultPrec(53)
    assert.equal(mpf.getDefaultPrec(), 53)
  })

  it('can specify rounding mode for values', () => {
    assert.equal(mpf(1.5, { prec: 1, roundingMode: 'roundTiesToEven' }).toNumber(), 2)
    assert.equal(mpf(-1.5, { prec: 1, roundingMode: 'roundTiesToEven' }).toNumber(), -2)
    assert.equal(mpf(1.4999, { prec: 1, roundingMode: 'roundTiesToEven' }).toNumber(), 1)
    assert.equal(mpf(-1.4999, { prec: 1, roundingMode: 'roundTiesToEven' }).toNumber(), -1)

    assert.equal(mpf(1.9999, { prec: 1, roundingMode: 'roundTowardZero' }).toNumber(), 1)
    assert.equal(mpf(-1.9999, { prec: 1, roundingMode: 'roundTowardZero' }).toNumber(), -1)

    assert.equal(mpf(1.0001, { prec: 1, roundingMode: 'roundTowardPositive' }).toNumber(), 2)
    assert.equal(mpf(-1.9999, { prec: 1, roundingMode: 'roundTowardPositive' }).toNumber(), -1)

    assert.equal(mpf(1.9999, { prec: 1, roundingMode: 'roundTowardNegative' }).toNumber(), 1)
    assert.equal(mpf(-1.0001, { prec: 1, roundingMode: 'roundTowardNegative' }).toNumber(), -2)

    assert.equal(mpf(1.0001, { prec: 1, roundingMode: 'roundAwayZero' }).toNumber(), 2)
    assert.equal(mpf(-1.0001, { prec: 1, roundingMode: 'roundAwayZero' }).toNumber(), -2)

    assert.equal(mpf(1.9999, { prec: 1, roundingMode: 'roundFaithful' }).toNumber(), 1)
    assert.equal(mpf(-1.9999, { prec: 1, roundingMode: 'roundFaithful' }).toNumber(), -1)

    assert.equal(mpf(1.0001, { prec: 1, roundingMode: 'roundTiesToAwayZero' }).toNumber(), 2)
    assert.equal(mpf(-1.0001, { prec: 1, roundingMode: 'roundTiesToAwayZero' }).toNumber(), -2)
  })

  it('has a default rounding mode setting', () => {
    assert.equal(mpf.getDefaultRoundingMode(), 'roundTiesToEven')
    assert.equal(mpf(1.75, { prec: 2 }).toNumber(), 2)
    assert.equal(mpf(-1.75, { prec: 2 }).toNumber(), -2)
    assert.equal(mpf(1.74999, { prec: 2 }).toNumber(), 1.5)
    assert.equal(mpf(-1.74999, { prec: 2 }).toNumber(), -1.5)

    mpf.setDefaultRoundingMode(1)
    assert.equal(mpf.getDefaultRoundingMode(), 'roundTowardZero')
    assert.equal(mpf(1.9999, { prec: 2 }).toNumber(), 1.5)
    assert.equal(mpf(-1.9999, { prec: 2 }).toNumber(), -1.5)

    mpf.setDefaultRoundingMode(2)
    assert.equal(mpf.getDefaultRoundingMode(), 'roundTowardPositive')
    assert.equal(mpf(1.0001, { prec: 2 }).toNumber(), 1.5)
    assert.equal(mpf(-1.9999, { prec: 2 }).toNumber(), -1.5)

    mpf.setDefaultRoundingMode('roundTowardNegative')
    assert.equal(mpf.getDefaultRoundingMode(), 'roundTowardNegative')
    assert.equal(mpf(1.9999, { prec: 2 }).toNumber(), 1.5)
    assert.equal(mpf(-1.0001, { prec: 2 }).toNumber(), -1.5)

    mpf.setDefaultRoundingMode(0)
    assert.equal(mpf.getDefaultRoundingMode(), 'roundTiesToEven')
  })

  it('can determine whether or not something is an MPFloat', () => {
    assert(!mpf.isMPFloat(1))
    assert(!mpf.isMPFloat('2'))
    assert(!mpf.isMPFloat('.3333333333'))
    assert(mpf.isMPFloat(mpf(4)))
    assert(mpf.isMPFloat(mpf('58.9e6')))
    assert(mpf.isMPFloat(mpf('-.7')))
  })

  it('can calculate constants to specified precision and rounding', () => {
    assert.equal(mpf.getLog2().toNumber(), Math.LN2)
    assert.equal(mpf.getPi().toNumber(), Math.PI)
    assert(mpf.getEuler({ prec: 200 }).toString().startsWith('0.57721566490153286060651209008240243104215933593992'))
    assert(mpf.getCatalan({ prec: 200 }).toString().startsWith('0.915965594177219015054603514932384110774'))
    assert.equal(mpf.getPi({ prec: 4 }).toNumber(), 3.25)
    assert.equal(mpf.getPi({ prec: 4, roundingMode: 'roundTowardZero' }).toNumber(), 3)
  })

  it('can be compared', () => {
    for(const x of [-12.345, '-12.345', mpf(-12.345)]) {
      for(const y of [3.481, '3.481', mpf(3.481)]) {
        assert.isBelow(mpf.cmp(x, y), 0)
        assert.isAbove(mpf.cmpabs(x, y), 0)

        if(mpf.isMPFloat(x)) {
          assert.isBelow(x.cmp(y), 0)
          assert.isAbove(x.cmpabs(y), 0)
          assert.isAbove(x.neg().cmpabs(y), 0)

          assert.isTrue(x.lt(y))
          assert.isTrue(x.lte(y))
          assert.isTrue(x.lgt(y))

          assert.isFalse(x.eq(y))
          assert.isFalse(x.gt(y))
          assert.isFalse(x.gte(y))
        }
      }
    }
    for(const x of [8.912, '8.912', mpf(8.912)]) {
      for(const y of [9e-2, '9e-2', mpf(9e-2)]) {
        assert.isAbove(mpf.cmp(x, y), 0)
        assert.isAbove(mpf.cmpabs(x, y), 0)

        if(mpf.isMPFloat(x)) {
          assert.isAbove(x.cmp(y), 0)
          assert.isAbove(x.cmpabs(y), 0)
          assert.isAbove(x.neg().cmpabs(y), 0)

          assert.isTrue(x.gt(y))
          assert.isTrue(x.gte(y))
          assert.isTrue(x.lgt(y))

          assert.isFalse(x.eq(y))
          assert.isFalse(x.lt(y))
          assert.isFalse(x.lte(y))
        }
      }
    }
    for(const x of [-0.533, '-0.533', mpf(-0.533)]) {
      for(const y of [-0.533, '-0.533', mpf(-0.533)]) {
        assert.equal(mpf.cmp(x, y), 0)

        if(mpf.isMPFloat(x)) {
          assert.equal(x.cmp(y), 0)
          assert.equal(x.cmpabs(y), 0)

          assert.isTrue(x.eq(y))
          assert.isTrue(x.lte(y))
          assert.isTrue(x.gte(y))

          assert.isFalse(x.lt(y))
          assert.isFalse(x.gt(y))
          assert.isFalse(x.lgt(y))
        }
      }
    }
  })

  it('matches IEEE Std 754-2008 and ECMA262', () => {
    const genParams = () => [
      -Infinity, Infinity, NaN, 0, -1, 1,
      Math.random(),
      (Math.random() - 0.5) * Math.pow(2, Math.ceil(Math.random() * 2048 - 1024)),
    ]

    function assertIsApproximately(actual, expected, args, fnName) {
      const errMsg = `${fnName}(${args.join(', ')}) wrong`
      if(Number.isNaN(expected)) {
        assert.isNaN(expected, errMsg)
        assert.isNaN(actual, errMsg)
      } else if(!Number.isFinite(expected)) {
        assert.equal(actual, expected, errMsg)
      } else {
        // last couple of bits of significand might differ, since
        // approximation behavior is unspecified in ECMA262
        assert.approximately(actual, expected,
          Math.pow(2, -51) * Math.max(Math.abs(actual), Math.abs(expected)),
          errMsg)
      }
    }

    for(let i = 0; i < 10; i++) {
      for(const [fnName, expectedFn] of [
        ['sqr', (x) => x * x],
        ['sqrt', Math.sqrt],
        ['recSqrt', (x) => 1 / Math.sqrt(x)],
        ['cbrt', Math.cbrt],
        ['neg', (x) => -x],
        ['abs', Math.abs],
        ['log', Math.log],
        ['log2', Math.log2],
        ['log10', Math.log10],
        ['log1p', Math.log1p],
        ['exp', Math.exp],
        ['exp2', (x) => Math.pow(2, x)],
        ['exp10', (x) => Math.pow(10, x)],
        ['expm1', Math.expm1],
        ['cos', Math.cos],
        ['sin', Math.sin],
        ['tan', Math.tan],
        ['sec', (x) => 1 / Math.cos(x)],
        ['csc', (x) => 1 / Math.sin(x)],
        ['cot', (x) => 1 / Math.tan(x)],
        ['acos', Math.acos],
        ['asin', Math.asin],
        ['atan', Math.atan],
        ['cosh', Math.cosh],
        ['sinh', Math.sinh],
        ['tanh', Math.tanh],
        ['sech', (x) => 1 / Math.cosh(x)],
        ['csch', (x) => 1 / Math.sinh(x)],
        ['coth', (x) => 1 / Math.tanh(x)],
        ['acosh', Math.acosh],
        ['asinh', Math.asinh],
        ['atanh', Math.atanh],
      ]) {
        for(const x of genParams()) {
          const actual = mpf[fnName](x).toNumber()
          const expected = expectedFn(x)
          assertIsApproximately(actual, expected, [x], fnName)
        }
      }

      for(const [fnName, expectedFn] of [
        ["add", (x, y) => x + y],
        ["sub", (x, y) => x - y],
        ["mul", (x, y) => x * y],
        ["div", (x, y) => x / y],
        ["pow", Math.pow],
        ["dim", (x, y) => x <= y ? 0 : x - y],
        ["atan2", Math.atan2],
        ["hypot", Math.hypot],
        ["min", Math.min],
        ["max", Math.max],
      ]) {
        for(const x of genParams()) {
          for(const y of genParams()) {
            const actual = mpf[fnName](x, y).toNumber()
            const expected = expectedFn(x, y)
            if(fnName === 'pow' && (
              Math.abs(x) === 1 && Math.abs(y) === Infinity ||
              x === 1 && Number.isNaN(y)
            )) {
              // [ECMA262](https://www.ecma-international.org/ecma-262/6.0/#sec-math.pow):
              // * If y is NaN, the result is NaN.
              // * If abs(x) is 1 and y is +∞, the result is NaN.
              // * If abs(x) is 1 and y is −∞, the result is NaN.
              assert.isNaN(expected)

              // IEEE Std 754-2008:
              // * pow(−1, ±∞) is 1 with no exception
              // * pow(+1, y) is 1 for any y (even a quiet NaN)
              assert.equal(actual, 1)

            } else if((fnName === 'min' || fnName === 'max') && (
              Number.isNaN(x) || Number.isNaN(y)
            )) {
              // [ECMA262](https://www.ecma-international.org/ecma-262/6.0/#sec-math.min):
              // * If any value is NaN, the result is NaN
              assert.isNaN(expected)

              // IEEE Std 754-2008:
              //  "For an operation with quiet NaN inputs,
              //  *other than maximum and minimum operations,*
              //  if a floating-point result is to be delivered
              //  the result shall be a quiet NaN which
              //  should be one of the input NaNs."
              //
              // Actually the behavior is unspecified, but seems
              // to imply that NaNs are to be ignored essentially
              // unless every argument is NaN, in which return NaN.
              if(!Number.isNaN(x)) {
                assert.equal(actual, x)
              } else if(!Number.isNaN(y)) {
                assert.equal(actual, y)
              } else {
                assert.isNaN(actual)
              }

            } else {
              assertIsApproximately(actual, expected, [x, y], fnName)
            }
          }
        }
      }
    }
  })
})
