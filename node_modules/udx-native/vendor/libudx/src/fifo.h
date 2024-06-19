#ifndef UDX_FIFO_H
#define UDX_FIFO_H

#include <stdint.h>

#include "../include/udx.h"

void
udx__fifo_init (udx_fifo_t *f, uint32_t initial_max_size);

void
udx__fifo_destroy (udx_fifo_t *f);

void *
udx__fifo_shift (udx_fifo_t *f);

void *
udx__fifo_peek (udx_fifo_t *f);

void
udx__fifo_undo (udx_fifo_t *f);

void
udx__fifo_grow (udx_fifo_t *f);

uint32_t
udx__fifo_push (udx_fifo_t *f, void *data);

void
udx__fifo_remove (udx_fifo_t *f, void *data, uint32_t pos_hint);

#endif // UDX_FIFO_H
