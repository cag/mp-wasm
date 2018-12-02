#include "emscripten.h"
#include "gmp.h"
#include "mpfr.h"

size_t EMSCRIPTEN_KEEPALIVE sizeof_unsigned_long() {
    return sizeof(unsigned long);
}

size_t EMSCRIPTEN_KEEPALIVE sizeof_mpfr_struct() {
    return sizeof(__mpfr_struct);
}

mpfr_sign_t EMSCRIPTEN_KEEPALIVE get_mpfr_sign(mpfr_t rop) {
    return rop[0]._mpfr_sign;
}

void EMSCRIPTEN_KEEPALIVE set_mpfr_sign(mpfr_t rop, mpfr_sign_t sign) {
    rop[0]._mpfr_sign = sign;
}

mpfr_exp_t EMSCRIPTEN_KEEPALIVE get_mpfr_exp(mpfr_t rop) {
    return rop[0]._mpfr_exp;
}

void EMSCRIPTEN_KEEPALIVE set_mpfr_exp(mpfr_t rop, mpfr_exp_t exp) {
    rop[0]._mpfr_exp = exp;
}

int EMSCRIPTEN_KEEPALIVE get_MPFR_PREC_MIN() {
    return MPFR_PREC_MIN;
}

int EMSCRIPTEN_KEEPALIVE get_MPFR_PREC_MAX() {
    return MPFR_PREC_MAX;
}

char EMSCRIPTEN_KEEPALIVE *conv_mpfr_to_str(mpfr_t rop) {
    char *res;
    int n = mpfr_asprintf(&res, "%.*Rg", (int) ((double) mpfr_get_prec(rop) * 0.301029996) + 1, rop);
    if(n < 0) return 0;
    return res;
}
