#include "endian.h"

// See https://github.com/nodejs/node/blob/master/src/util.h
static const union {
  uint8_t u8[2];
  uint16_t u16;
} byte_order = {{1, 0}};

udx__endianness_t
udx__endianness () {
  return byte_order.u16 == 1 ? UDX_LE : UDX_BE;
}

bool
udx__is_le () {
  return udx__endianness() == UDX_LE;
}

bool
udx__is_be () {
  return udx__endianness() == UDX_BE;
}

uint32_t
udx__swap_uint32 (uint32_t x) {
  return ((x & 0x000000ff) << 24) |
         ((x & 0x0000ff00) << 8) |
         ((x & 0x00ff0000) >> 8) |
         ((x & 0xff000000) >> 24);
}

uint32_t
udx__swap_uint32_if_be (uint32_t n) {
  if (udx__is_le()) return n;
  return udx__swap_uint32(n);
}
