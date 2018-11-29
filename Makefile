OPTIMIZATION_FLAG := ${OPTIMIZATION_FLAG}

GMP_VERSION := 6.1.2
GMP_DIR := gmp-${GMP_VERSION}
GMP_LIB := ${GMP_DIR}/.libs/libgmp.so

MPFR_VERSION := 4.0.1
MPFR_DIR := mpfr-${MPFR_VERSION}
MPFR_LIB := ${MPFR_DIR}/src/.libs/libmpfr.so

MPC_VERSION := 1.1.0
MPC_DIR := mpc-${MPC_VERSION}
MPC_LIB := ${MPC_DIR}/src/.libs/libmpc.so

POST_PROCESS_LIST := sed -e 's/\(.*\)/"_\1"/' | paste -d, -s -
EXPORTED_GMP_FUNCTIONS := $(shell grep -Eo '__gmp[zq]_\w+' ${GMP_DIR}/gmp.h | ${POST_PROCESS_LIST})
EXPORTED_MPFR_FUNCTIONS := $(shell grep -o '^__MPFR_DECLSPEC.* [\(\)]' ${MPFR_DIR}/src/mpfr.h | grep -Eo 'mpfr_\w+ +[\(\)]' | cut -d ' ' -f1 | grep -vwE 'mpfr_([gs]et_(decimal64|float128|[su]j\w*)|(inp|out)_str|(f|v|vas|vs|vsn|vf)printf|fpif_(ex|im)port)' | ${POST_PROCESS_LIST})
EXPORTED_MPC_FUNCTIONS := $(shell grep -o '^__MPC_DECLSPEC.* [\(\)]' ${MPC_DIR}/src/mpc.h | grep -Eo 'mpc_\w+ +[\(\)]' | cut -d ' ' -f1 | ${POST_PROCESS_LIST})
EXPORTED_FUNCTIONS := [${EXPORTED_GMP_FUNCTIONS},${EXPORTED_MPFR_FUNCTIONS},${EXPORTED_MPC_FUNCTIONS}]
EXTRA_EXPORTED_RUNTIME_METHODS := ["Pointer_stringify","stringToUTF8","getValue"]

all: libs-build.js

libs-build.js: ${GMP_LIB} ${MPFR_LIB} ${MPC_LIB} utils.c index.js
	emcc ${OPTIMIZATION_FLAG} ${GMP_LIB} ${MPFR_LIB} ${MPC_LIB} -I${CURDIR}/${GMP_DIR} -I${CURDIR}/${MPFR_DIR}/src -I${CURDIR}/${MPC_DIR}/src utils.c -o libs-build.js -s MODULARIZE=1 -s 'EXPORTED_FUNCTIONS=${EXPORTED_FUNCTIONS}' -s 'EXTRA_EXPORTED_RUNTIME_METHODS=${EXTRA_EXPORTED_RUNTIME_METHODS}'


${GMP_LIB}: | ${GMP_DIR}
	cd ${GMP_DIR} && \
	EMCONFIGURE_JS=1 emconfigure ./configure CFLAGS='${OPTIMIZATION_FLAG}' --disable-assembly ABI=x32 && \
	emmake ${MAKE}

${GMP_DIR}:
	curl -s https://gmplib.org/download/gmp/${GMP_DIR}.tar.lz | tar -x --lzip -C .


${MPFR_LIB}: ${GMP_LIB} | ${MPFR_DIR}
	cd ${MPFR_DIR} && \
	emconfigure ./configure CFLAGS='${OPTIMIZATION_FLAG}' --with-gmp-build=${CURDIR}/${GMP_DIR} && \
	emmake ${MAKE}

${MPFR_DIR}:
	curl -s https://www.mpfr.org/mpfr-current/${MPFR_DIR}.tar.xz | tar -xJC .


${MPC_LIB}: ${GMP_LIB} ${MPFR_LIB} | ${MPC_DIR}
	cd ${MPC_DIR} && \
	emconfigure ./configure CFLAGS='${OPTIMIZATION_FLAG}' --with-gmp-include=${CURDIR}/${GMP_DIR} --with-gmp-lib=${CURDIR}/${GMP_DIR}/.libs --with-mpfr-include=${CURDIR}/${MPFR_DIR}/src --with-mpfr-lib=${CURDIR}/${MPFR_DIR}/src/.libs && \
	emmake ${MAKE}

${MPC_DIR}:
	curl -s https://ftp.gnu.org/gnu/mpc/${MPC_DIR}.tar.gz | tar -xzC .
