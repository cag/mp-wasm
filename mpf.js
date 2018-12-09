const assert = require("assert");
const { camelize } = require("humps");

module.exports = function(wasmInstance, memUtils) {
  const wasmExports = wasmInstance.exports;
  const {
    isWord,
    isSword,

    ensureRegister,
    initRegister,
    clearRegister,
    registerSize,
    memViews,

    cstrToString,
    stringToNewCStr
  } = memUtils;

  const {
    _malloc,
    _free,
    _sizeof_mpfr_struct,
    _get_MPFR_PREC_MIN,
    _get_MPFR_PREC_MAX,
    _mpfr_init,
    _mpfr_init2,
    _mpfr_clear,
    _get_mpfr_sign,
    _set_mpfr_sign,
    _get_mpfr_exp,
    _set_mpfr_exp,
    _mpfr_custom_get_size,
    _mpfr_custom_get_significand,
    _mpfr_set_prec,
    _mpfr_get_prec,
    _mpfr_set_default_prec,
    _mpfr_get_default_prec,
    _mpfr_set_default_rounding_mode,
    _mpfr_get_default_rounding_mode,
    _mpfr_set,
    _mpfr_set_d,
    _mpfr_set_str,
    _conv_mpfr_to_str,
    _mpfr_free_str,
    _mpfr_get_d,
    _mpfr_nan_p,
    _mpfr_number_p,
    _mpfr_integer_p
  } = wasmExports;

  function checkValidPrec(prec) {
    if (
      prec == null ||
      typeof prec !== "number" ||
      !Number.isInteger(prec) ||
      prec < mpf.precMin ||
      prec > mpf.precMax
    ) {
      throw new Error(`invalid precision value ${prec}`);
    }
  }

  function normalizeBaseOption(base) {
    if (base == null) return 0;

    if (Number.isInteger(base) && (base == 0 || (base >= 2 && base <= 62)))
      return base;

    throw new Error(`invalid base ${base}`);
  }

  function normalizeRoundingMode(roundingMode) {
    if (roundingMode == null) return _mpfr_get_default_rounding_mode();

    if (
      typeof roundingMode === "number" &&
      mpf.roundingModeNames.hasOwnProperty(roundingMode)
    )
      return roundingMode;

    if (
      typeof roundingMode === "string" &&
      mpf.roundingModes.hasOwnProperty(roundingMode)
    )
      return mpf.roundingModes[roundingMode];

    throw new Error(`invalid rounding mode ${roundingMode}`);
  }

  const readFromMemory = Symbol("readFromMemory");
  const setRaw = Symbol("setRaw");
  const precision = Symbol("precision");
  const sign = Symbol("sign");
  const exp = Symbol("exp");
  const significand = Symbol("significand");

  class MPFloat {
    constructor(initialValue, opts) {
      const { prec } = opts || {};

      if (prec != null) {
        checkValidPrec(prec);
        this[precision] = prec;
      }

      const ptr = ensureRegister(this);

      if (initialValue != null) {
        this[setRaw](ptr, initialValue, opts);
      }

      this[readFromMemory](ptr);
    }

    [readFromMemory](ptr) {
      this[precision] = _mpfr_get_prec(ptr);
      this[sign] = _get_mpfr_sign(ptr);
      this[exp] = _get_mpfr_exp(ptr);
      const significandSize = _mpfr_custom_get_size(this[precision]);

      if (
        this[significand] != null &&
        significandSize <= this[significand].buffer.byteLength
      ) {
        this[significand] = this[significand].subarray(0, significandSize);
      } else {
        this[significand] = new Uint8Array(new ArrayBuffer(significandSize));
      }

      const significandPtr = _mpfr_custom_get_significand(ptr);

      this[significand].set(
        memViews.uint8.subarray(
          significandPtr,
          significandPtr + significandSize
        )
      );
    }

    [initRegister](ptr) {
      if (
        this[precision] != null &&
        this[sign] != null &&
        this[exp] != null &&
        this[significand] != null
      ) {
        _mpfr_init2(ptr, this[precision]);
        _set_mpfr_sign(ptr, this[sign]);
        _set_mpfr_exp(ptr, this[exp]);

        const significandPtr = _mpfr_custom_get_significand(ptr);
        memViews.uint8.set(this[significand], significandPtr);
      } else {
        if (this[precision] == null) {
          _mpfr_init(ptr);
        } else {
          _mpfr_init2(ptr, this[precision]);
        }
      }
    }

    [clearRegister](ptr) {
      _mpfr_clear(ptr);
    }

    setPrec(prec) {
      checkValidPrec(prec);
      const ptr = ensureRegister(this);
      _mpfr_set_prec(ptr, prec);
      this[readFromMemory](ptr);
    }

    getPrec() {
      return this[precision] || mpf.getDefaultPrec();
    }

    set(newValue, opts) {
      const ptr = ensureRegister(this);
      this[setRaw](ptr, newValue, opts);
      this[readFromMemory](ptr);
    }

    [setRaw](ptr, newValue, opts) {
      const { base, roundingMode } = opts || {};

      if (typeof newValue === "number") {
        _mpfr_set_d(ptr, newValue, normalizeRoundingMode(roundingMode));
      } else if (mpf.isMPFloat(newValue)) {
        const ptr2 = ensureRegister(newValue);
        _mpfr_set(ptr, ptr2, normalizeRoundingMode(roundingMode));
      } else if (
        typeof newValue === "string" ||
        typeof newValue === "bigint" ||
        typeof newValue === "object"
      ) {
        const valAsCStr = stringToNewCStr(newValue);
        _mpfr_set_str(
          ptr,
          valAsCStr,
          normalizeBaseOption(base),
          normalizeRoundingMode(roundingMode)
        );
        _free(valAsCStr);
      } else {
        throw new Error(`can't set value to ${newValue}`);
      }
    }

    toString() {
      const ptr = ensureRegister(this);
      const strPtr = _conv_mpfr_to_str(ptr);
      assert(strPtr !== 0, `could not convert mpfr at ${ptr} to string`);
      const ret = cstrToString(strPtr);
      _mpfr_free_str(strPtr);
      return ret;
    }

    toNumber(opts) {
      const { roundingMode } = opts || {};
      const ptr = ensureRegister(this);
      return _mpfr_get_d(ptr, normalizeRoundingMode(roundingMode));
    }

    isNaN() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_nan_p(ptr));
    }

    isFinite() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_number_p(ptr));
    }

    isInteger() {
      const ptr = ensureRegister(this);
      return Boolean(_mpfr_integer_p(ptr));
    }

    [Symbol.for("nodejs.util.inspect.custom")]() {
      return `mpf('${this.toString()}')`;
    }
  }

  function mpf(...args) {
    return new MPFloat(...args);
  }
  mpf.prototype = MPFloat.prototype;

  mpf.structSize = _sizeof_mpfr_struct();
  assert(
    mpf.structSize <= registerSize,
    `mpfr struct size ${
      mpf.structSize
    } bigger than register size ${registerSize}`
  );

  mpf.precMin = _get_MPFR_PREC_MIN();
  mpf.precMax = _get_MPFR_PREC_MAX();

  mpf.roundingModeNames = {};
  mpf.roundingModes = {};
  [
    ["roundTiesToEven", 0],
    ["roundTowardZero", 1],
    ["roundTowardPositive", 2],
    ["roundTowardNegative", 3],
    ["roundAwayZero", 4],
    ["roundFaithful", 5],
    ["roundTiesToAwayZero", -1]
  ].forEach(([name, value]) => {
    mpf.roundingModeNames[value] = name;
    mpf.roundingModes[name] = value;
  });
  Object.freeze(mpf.roundingModeNames);
  Object.freeze(mpf.roundingModes);

  mpf.getDefaultPrec = function getDefaultPrec() {
    return _mpfr_get_default_prec();
  };

  mpf.setDefaultPrec = function setDefaultPrec(prec) {
    checkValidPrec(prec);
    _mpfr_set_default_prec(prec);
  };

  mpf.getDefaultRoundingMode = function getDefaultRoundingMode() {
    return mpf.roundingModeNames[_mpfr_get_default_rounding_mode()];
  };

  mpf.setDefaultRoundingMode = function setDefaultRoundingMode(roundingMode) {
    if (roundingMode == null) throw new Error("missing rounding mode");
    _mpfr_set_default_rounding_mode(normalizeRoundingMode(roundingMode));
  };

  mpf.isMPFloat = function isMPFloat(value) {
    return typeof value === "object" && value instanceof MPFloat;
  };

  ["log2", "pi", "euler", "catalan"].forEach(constant => {
    const name = `get${constant.charAt(0).toUpperCase()}${constant.slice(1)}`;
    const fn = wasmExports[`_mpfr_const_${constant}`];
    mpf[name] = {
      [name](opts) {
        const { roundingMode } = opts || {};
        const ret = mpf(null, opts);
        const retPtr = ensureRegister(ret);
        fn(retPtr, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
  });

  curriedOps = [];
  [
    "sqr",
    "sqrt",
    "rec_sqrt",
    "cbrt",
    "neg",
    "abs",
    "log",
    "log2",
    "log10",
    "log1p",
    "exp",
    "exp2",
    "exp10",
    "expm1",
    "cos",
    "sin",
    "tan",
    "sec",
    "csc",
    "cot",
    "acos",
    "asin",
    "atan",
    "cosh",
    "sinh",
    "tanh",
    "sech",
    "csch",
    "coth",
    "acosh",
    "asinh",
    "atanh",
    "fac",
    "eint",
    "li2",
    "gamma",
    "lngamma",
    "digamma",
    "zeta",
    "erf",
    "erfc",
    "j0",
    "j1",
    "y0",
    "y1",
    "rint",
    "rint_ceil",
    "rint_floor",
    "rint_round",
    "rint_roundeven",
    "rint_trunc",
    "frac"
  ].forEach(op => {
    const name = camelize(op);
    mpf[name] = {
      [name](a, opts) {
        if (a == null) throw new Error("missing argument");

        const { roundingMode } = opts || {};
        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        let fn, arg;

        if ((fn = wasmExports[`_mpfr_${op}_ui`]) && isWord(a)) {
          arg = a;
        } else if ((fn = wasmExports[`_mpfr_${op}`])) {
          arg = retPtr;
        } else {
          throw new Error(`can't perform ${op} on ${a}`);
        }

        fn(retPtr, arg, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    if (name !== "fac") curriedOps.push(name);
  });

  ["ceil", "floor", "round", "roundeven", "trunc"].forEach(op => {
    const name = camelize(op);
    const fn = wasmExports[`_mpfr_${op}`];
    mpf[name] = {
      [name](a, opts) {
        if (a == null) throw new Error("missing argument");

        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        fn(retPtr, retPtr);
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    curriedOps.push(name);
  });

  [
    "add",
    "sub",
    "mul",
    "div",
    "rootn",
    "pow",
    "dim",
    "atan2",
    "gamma_inc",
    "beta",
    "agm",
    "hypot",
    "fmod",
    "remainder",
    "min",
    "max"
  ].forEach(op => {
    const name = camelize(op);
    mpf[name] = {
      [name](a, b, opts) {
        if (a == null) throw new Error("missing first argument");
        if (b == null) throw new Error("missing second argument");

        const { roundingMode } = opts || {};
        const ret = mpf(null, opts);

        let fn, arg1, arg2;

        // here is a long chain of responsibility...
        // castless cases
        if (
          (fn = wasmExports[`_mpfr_d_${op}`]) &&
          typeof a === "number" &&
          mpf.isMPFloat(b)
        ) {
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}_d`]) &&
          mpf.isMPFloat(a) &&
          typeof b === "number"
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (fn && typeof a === "number" && mpf.isMPFloat(b)) {
          // assume op is commutative if _mpfr_d_${op} does not exist
          arg1 = ensureRegister(b);
          arg2 = a;
        } else if (
          (fn = wasmExports[`_mpfr_ui_${op}_ui`]) &&
          isWord(a) &&
          isWord(b)
        ) {
          arg1 = a;
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_${op}_ui`]) &&
          mpf.isMPFloat(a) &&
          isWord(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_${op}_si`]) &&
          mpf.isMPFloat(a) &&
          isSword(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (
          (fn = wasmExports[`_mpfr_ui_${op}`]) &&
          isWord(a) &&
          mpf.isMPFloat(b)
        ) {
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}`]) &&
          mpf.isMPFloat(a) &&
          mpf.isMPFloat(b)
        ) {
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        }
        // casted cases
        else if ((fn = wasmExports[`_mpfr_d_${op}`]) && typeof a === "number") {
          ret.set(b, opts);
          b = ret;
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if (
          (fn = wasmExports[`_mpfr_${op}_d`]) &&
          typeof b === "number"
        ) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if (fn && typeof a === "number") {
          // (commutativity assumption again)
          ret.set(b, opts);
          b = ret;
          arg1 = ensureRegister(b);
          arg2 = a;
        } else if ((fn = wasmExports[`_mpfr_${op}_ui`]) && isWord(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if ((fn = wasmExports[`_mpfr_${op}_si`]) && isSword(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = b;
        } else if ((fn = wasmExports[`_mpfr_ui_${op}`]) && isWord(a)) {
          ret.set(b, opts);
          b = ret;
          arg1 = a;
          arg2 = ensureRegister(b);
        } else if ((fn = wasmExports[`_mpfr_${op}`]) && mpf.isMPFloat(b)) {
          ret.set(a, opts);
          a = ret;
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        } else if (fn && mpf.isMPFloat(a)) {
          ret.set(b, opts);
          b = ret;
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        } else if (fn) {
          ret.set(a, opts);
          a = ret;
          b = mpf(b, opts);
          arg1 = ensureRegister(a);
          arg2 = ensureRegister(b);
        }
        // couldn't find anything
        else {
          throw new Error(`can't perform ${op} on ${a} and ${b}`);
        }

        const retPtr = ensureRegister(ret);
        fn(retPtr, arg1, arg2, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
    curriedOps.push(name);
  });

  ["jn", "yn"].forEach(op => {
    const name = camelize(op);
    const fn = wasmExports[`_mpfr_${op}`];
    mpf[name] = {
      [name](n, a, opts) {
        if (n == null) throw new Error("missing n");
        if (a == null) throw new Error("missing argument");
        if (!isSword(n)) {
          throw new Error(`can't perform ${op} with invalid n=${n} (a = ${a})`);
        }

        const { roundingMode } = opts || {};
        const ret = mpf(a, opts);
        const retPtr = ensureRegister(ret);

        fn(retPtr, n, retPtr, normalizeRoundingMode(roundingMode));
        ret[readFromMemory](retPtr);
        return ret;
      }
    }[name];
  });

  const { _mpfr_cmp, _mpfr_cmp_d, _mpfr_cmpabs } = wasmExports;

  mpf.cmp = function cmp(a, b) {
    if (
      typeof a === "string" ||
      typeof a === "bigint" ||
      (typeof a === "object" && !(a instanceof MPFloat))
    ) {
      a = mpf(a);
    }

    if (
      typeof b === "string" ||
      typeof b === "bigint" ||
      (typeof b === "object" && !(b instanceof MPFloat))
    ) {
      b = mpf(b);
    }

    let ret;

    if (mpf.isMPFloat(a)) {
      if (mpf.isMPFloat(b)) {
        ret = _mpfr_cmp(ensureRegister(a), ensureRegister(b));
      } else if (typeof b === "number") {
        ret = _mpfr_cmp_d(ensureRegister(a), b);
      }
    } else if (typeof a === "number") {
      if (mpf.isMPFloat(b)) {
        ret = -_mpfr_cmp_d(ensureRegister(b), a);
      } else if (typeof b === "number") {
        a = mpf(a);
        ret = _mpfr_cmp_d(ensureRegister(a), b);
      }
    }

    if (ret == null) throw new Error(`don't know how to cmp ${a} and ${b}`);

    return ret;
  };
  curriedOps.push("cmp");

  mpf.cmpabs = function cmpabs(a, b) {
    if (!mpf.isMPFloat(a)) {
      a = mpf(a);
    }

    if (!mpf.isMPFloat(b)) {
      b = mpf(b);
    }

    return _mpfr_cmpabs(ensureRegister(a), ensureRegister(b));
  };
  curriedOps.push("cmpabs");

  [
    ["greater", "gt"],
    ["greaterequal", "gte"],
    ["less", "lt"],
    ["lessequal", "lte"],
    ["equal", "eq"],
    ["lessgreater", "lgt"]
  ].forEach(([op, name]) => {
    mpf.prototype[name] = {
      [name](other) {
        if (!mpf.isMPFloat(other)) {
          other = mpf(other);
        }
        return Boolean(
          wasmExports[`_mpfr_${op}_p`](
            ensureRegister(this),
            ensureRegister(other)
          )
        );
      }
    }[name];
  });

  curriedOps.forEach(name => {
    mpf.prototype[name] = {
      [name](...args) {
        return mpf[name](this, ...args);
      }
    }[name];
  });

  return mpf;
};
