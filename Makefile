GMP_VERSION := 6.1.2
GMP_DIR := gmp-${GMP_VERSION}
GMP_LIB := ${GMP_DIR}/.libs/libgmp.so

MPFR_VERSION := 4.0.1
MPFR_DIR := mpfr-${MPFR_VERSION}
MPFR_LIB := ${MPFR_DIR}/src/.libs/libmpfr.so

MPC_VERSION := 1.1.0
MPC_DIR := mpc-${MPC_VERSION}
MPC_LIB := ${MPC_DIR}/src/.libs/libmpc.so

all: mp-wasm-mods.js

mp-wasm-mods.js: ${GMP_LIB} ${MPFR_LIB} ${MPC_LIB}
	emcc ${GMP_LIB} ${MPFR_LIB} ${MPC_LIB} -o mp-wasm-mods.js -s 'EXTRA_EXPORTED_RUNTIME_METHODS=["cwrap"]' -s 'EXPORTED_FUNCTIONS=["___gmpz_init","_mpfr_init2","_mpc_init3"]'


${GMP_LIB}: | ${GMP_DIR}
	cd ${GMP_DIR} && \
	EMCONFIGURE_JS=1 emconfigure ./configure --disable-assembly ABI=x32 && \
	emmake ${MAKE}

${GMP_DIR}:
	curl -s https://gmplib.org/download/gmp/${GMP_DIR}.tar.lz | tar -x --lzip -C .


${MPFR_LIB}: ${GMP_LIB} | ${MPFR_DIR}
	cd ${MPFR_DIR} && \
	emconfigure ./configure --with-gmp-build=${CURDIR}/${GMP_DIR} && \
	emmake ${MAKE}

${MPFR_DIR}:
	curl -s https://www.mpfr.org/mpfr-current/${MPFR_DIR}.tar.xz | tar -xJC .


${MPC_LIB}:
	cd ${MPC_DIR} && \
	emconfigure ./configure --with-gmp-include=${CURDIR}/${GMP_DIR} --with-gmp-lib=${CURDIR}/${GMP_DIR}/.libs --with-mpfr-include=${CURDIR}/${MPFR_DIR}/src --with-mpfr-lib=${CURDIR}/${MPFR_DIR}/src/.libs && \
	emmake ${MAKE}

${MPC_DIR}:
	curl -s https://ftp.gnu.org/gnu/mpc/${MPC_DIR}.tar.gz | tar -xzC .
