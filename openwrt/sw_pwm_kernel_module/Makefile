OPENWRT = ${HOME}/Working/OpenWRT_gl_inet/trunk

KERNEL = ${OPENWRT}/build_dir/target-mips_34kc_uClibc-0.9.33.2/linux-ar71xx_generic/linux-3.14.26
LD=${OPENWRT}/staging_dir/toolchain-mips_34kc_gcc-4.8-linaro_uClibc-0.9.33.2/bin/mips-openwrt-linux-uclibc-ld
CROSS_COMPILE="mips-openwrt-linux-uclibc-"
EXTRA_LDSFLAGS="-I${OPENWRT}/build_dir/linux-atheros -include symtab.h"
KBUILD_HAVE_NLS=no
CONFIG_SHELL="/bin/bash" 

obj-m += gpio-pwm.o

all:
	make -C ${KERNEL} ARCH="mips" CC="${OPENWRT}/staging_dir/toolchain-mips_34kc_gcc-4.8-linaro_uClibc-0.9.33.2/bin/mips-openwrt-linux-uclibc-gcc"  M=$(PWD) modules

clean:
	make -C ${KERNEL} CC="${OPENWRT}/staging_dir/toolchain-mips_34kc_gcc-4.8-linaro_uClibc-0.9.33.2/bin/mips-openwrt-linux-uclibc-gcc"  M=$(PWD) clean

