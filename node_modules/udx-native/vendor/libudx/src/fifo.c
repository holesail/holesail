#include <stdlib.h>

#include "../include/udx.h"

#include "fifo.h"

void
udx__fifo_init (udx_fifo_t *f, uint32_t initial_max_size) {
  // OBS: initial_max_size MUST be 2^n
  f->values = (void **) malloc(initial_max_size * sizeof(void *));
  f->mask = initial_max_size - 1;
  f->max_len = initial_max_size;
  f->len = 0;
  f->btm = 0;
}

void
udx__fifo_destroy (udx_fifo_t *f) {
  free(f->values);
  f->values = NULL;
}

void *
udx__fifo_shift (udx_fifo_t *f) {
  if (f->len == 0) return NULL;

  uint32_t btm = f->btm;
  void **b = f->values + btm;
  f->btm = (btm + 1) & f->mask;
  f->len--;

  return *b;
}

void *
udx__fifo_peek (udx_fifo_t *f) {
  if (f->len == 0) return NULL;

  return f->values[f->btm];
}

void
udx__fifo_undo (udx_fifo_t *f) {
  f->btm = (f->btm - 1) & f->mask;
  f->len++;
}

void
udx__fifo_grow (udx_fifo_t *f) {
  uint32_t mask = 2 * f->mask + 1;

  f->mask = mask;
  f->max_len = mask + 1;
  f->values = (void **) realloc(f->values, f->max_len * sizeof(void *));

  for (uint32_t i = 0; i < f->btm; i++) {
    f->values[f->len + i] = f->values[i];
  }
}

uint32_t
udx__fifo_push (udx_fifo_t *f, void *data) {
  if (f->len == f->max_len) udx__fifo_grow(f);

  uint32_t p = (f->btm + f->len++) & f->mask;
  void **t = f->values + p;
  *t = data;

  return p;
}

void
udx__fifo_remove (udx_fifo_t *f, void *data, uint32_t pos_hint) {
  // check if the pos_hint is correct
  if (pos_hint >= f->btm && pos_hint < (f->btm + f->len) && f->values[pos_hint] == data) {
    f->values[pos_hint] = NULL;
  } else {
    // hint was wrong, do a linear sweep
    for (uint32_t i = 0; i < f->len; i++) {
      uint32_t j = (f->btm + i) & f->mask;
      if (f->values[j] == data) {
        f->values[j] = NULL;
        break;
      }
    }
  }

  while (f->len > 0 && f->values[f->btm] == NULL) udx__fifo_shift(f);
}
