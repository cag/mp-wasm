# mp-wasm

Multiple precision arithmetic in JS with WASM.

Note: This is pretty experimental, as WASM is itself somewhat experimental right now.


## Installation

### Node.JS

Just grab this off of NPM:

    npm i mp-wasm

```js
const mpWasm = require('mp-wasm')
// ...
```

### Web

Download the files `mp.wasm` and `mp-wasm.js`. In your page, just pop this in there:

```html
<script src="mp-wasm.js"></script>
<script>
fetchMPWasm('mp.wasm').then((mpWasm) => {
    // ...
})
</script>
```

#### They're Different?

Yes. Synchronous feels right on Node.JS for this. Likewise, the web is built for asynchronous stuff.

The rest of this is the same though (that is, synchronous).


## Usage

The main API object (named `mpWasm` above), currently exposes one thing: `mpf`, which is a [GNU MP floating point *reliably*](https://www.mpfr.org/) factory:

```js
const { mpf } = mpWasm
```

`mpf` lets you make `MPFloat` instances (I will now use `mpf` to also refer to `MPFloat`):

```js
mpf(1.5e-4)
mpf('3.563432432')
mpf('0xdeadbeef')
mpf('55434.3244324235454353543e10')
mpf(99999999999999999999999999999999999999999999999n)
```

You can also set the value of an `mpf` instance after it's initially created:

```js
mpf(54235432.432432432).set(-5)
```

It also has a bunch of functions which accept parameters of all types:

```js
mpf.add(1, '3.56')
mpf.sub(3247321987493214231n, mpf('7.67653431432143214324321432115e21'))
```

All these functions are curried into methods for instances as well:

```js
mpf(55659437894732143172493127n).mul(10n**33n)
mpf('inf').neg()
```

### Instance Configuration

Many of the functions also carry similar options which may be expressed as an optional last parameter. For example,

```js
mpf(1.567e10, { prec: 3 })
```

create as instance of `mpf` with only three bits in its significand. Likewise, a rounding mode may be specified:

```js
mpf(1.5, { 'roundTowardZero' })
```

#### Available Rounding Modes

These modes correspond with MPFR's:

| 'roundTiesToEven'     |  0  |
| 'roundTowardZero'     |  1  |
| 'roundTowardPositive' |  2  |
| 'roundTowardNegative' |  3  |
| 'roundAwayZero'       |  4  |
| 'roundFaithful'       |  5  |
| 'roundTiesToAwayZero' | -1  |

Either the string or the number value may be specified as the rounding mode.

### General Configuration

For getting/setting the default precision in bits used (be sure to set this to a higher precision than its default starting value `53`, which is comparable to just doing plain double float computations):

    getDefaultPrec()
    setDefaultPrec(prec)

For getting/setting the default rounding mode:

    getDefaultRoundingMode() {
    setDefaultRoundingMode(roundingMode) {

Past `mpf` instances do not get updated when this parameter changes. Future new instances and computations will use these default settings though.

### Constants

These functions gets a corresponding math constant and returns an shared instance of it:

    getLog2(opts)
    getPi(opts)
    getEuler(opts)
    getCatalan(opts)

### Operators

Unary operators:

    sqr       sqrt      rec_sqrt   cbrt    neg     abs
    log       log2      log10      log1p
    exp       exp2      exp10      expm1
    cos       sin       tan        sec     csc     cot
    acos      asin      atan     
    cosh      sinh      tanh       sech    csch    coth
    acosh     asinh     atanh      fac
    eint      li2       gamma      lngamma      digamma
    zeta      erf       erfc       j0    j1    y0   y1
    rint      rintCeil  rintFloor  rintRound
    rintRoundeven       rintTrunc  frac

Binary operators:

    add       sub       mul        div
    rootn     pow       dim
    atan2   gammaInc    beta
    jn        yn        agm       hypot
    fmod      remainder
    min       max

And comparison operators `<` (`lt`), `<=` (`lte`), `>` (`gt`) `>=` (`gte`), `==` (`eq`), and `<>` (`lgt`) exist, with the latter two distinguishing between edge cases with NaN values. All of the comparison operators are on the prototype and must be called as a method on the instance:

    mpf('1.0').lt('1.0000000000000000000000000000001')

Cast these `mpf`s to JS primitives with:

    toString()
    toNumber(opts)

The following checks are also available:

    isNaN()
    isFinite()
    isInteger()


## Future Stuff

### Fix Memory Leakage

Okay, so you can't keep calculating with this *forever* yet, unless you're super careful, which really means you have to call `instance.destroy()` on every `mpf` you make after you're done with them if you're doing some really intense stuff. With that said this can be addressed though, so maybe one day this section of the README will be gone.

### Add MPC, MPFI, and/or iRRAM?

At least some complex ops would be nice.
