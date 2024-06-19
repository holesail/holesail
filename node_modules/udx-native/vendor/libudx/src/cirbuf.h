#ifndef UDX_CIRBUF_H
#define UDX_CIRBUF_H

#include <stdint.h>

#include "../include/udx.h"

void
udx__cirbuf_init (udx_cirbuf_t *c, uint32_t initial_size);

void
udx__cirbuf_destroy (udx_cirbuf_t *c);

void
udx__cirbuf_set (udx_cirbuf_t *c, udx_cirbuf_val_t *val);

udx_cirbuf_val_t *
udx__cirbuf_get (udx_cirbuf_t *c, uint32_t seq);

udx_cirbuf_val_t *
udx__cirbuf_remove (udx_cirbuf_t *c, uint32_t seq);

#endif // UDX_CIRBUF_H
