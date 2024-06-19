#ifndef UDX_ENDIAN_H
#define UDX_ENDIAN_H

#include <stdbool.h>
#include <stdint.h>

typedef enum udx__endianness udx__endianness_t;

enum udx__endianness {
  UDX_LE,
  UDX_BE
};

udx__endianness_t
udx__endianness ();

bool
udx__is_le ();

bool
udx__is_be ();

uint32_t
udx__swap_uint32 (uint32_t x);

uint32_t
udx__swap_uint32_if_be (uint32_t n);

#endif // UDX_ENDIAN_H
