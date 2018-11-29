#include "emscripten.h"
#include "gmp.h"
#include "mpfr.h"

size_t EMSCRIPTEN_KEEPALIVE sizeof_unsigned_long() {
    return sizeof(unsigned long);
}

size_t EMSCRIPTEN_KEEPALIVE sizeof_mp_limb_t() {
    return sizeof(mp_limb_t);
}

size_t EMSCRIPTEN_KEEPALIVE sizeof_mpfr_struct() {
    return sizeof(__mpfr_struct);
}

int EMSCRIPTEN_KEEPALIVE get_MPFR_PREC_MIN() {
    return MPFR_PREC_MIN;
}

int EMSCRIPTEN_KEEPALIVE get_MPFR_PREC_MAX() {
    return MPFR_PREC_MAX;
}

char EMSCRIPTEN_KEEPALIVE *conv_mpfr_to_str(mpfr_t rop) {
    char *res;
    int n = mpfr_asprintf(&res, "%.*Rg", (int) ((double) mpfr_get_prec(rop) * 0.301029996) + 2, rop);
    if(n < 0) return 0;
    return res;
}
