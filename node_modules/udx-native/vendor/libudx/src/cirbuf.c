#include <stdlib.h>

#include "../include/udx.h"

#include "cirbuf.h"

void
udx__cirbuf_init (udx_cirbuf_t *c, uint32_t initial_size) {
  // OBS: initial_size MUST be 2^n
  c->size = initial_size;
  c->mask = initial_size - 1;
  c->values = calloc(initial_size, sizeof(udx_cirbuf_val_t *));
}

void
udx__cirbuf_destroy (udx_cirbuf_t *c) {
  if (c->values != NULL) free(c->values);
  c->size = c->mask = 0;
  c->values = NULL;
}

void
udx__cirbuf_set (udx_cirbuf_t *c, udx_cirbuf_val_t *val) {
  udx_cirbuf_val_t **values = c->values + (val->seq & c->mask);
  udx_cirbuf_val_t *v = *values;

  if (v == NULL || v->seq == val->seq) {
    *values = val;
    return;
  }

  uint32_t old_size = c->size;
  udx_cirbuf_val_t **old_values = c->values;

  while ((v->seq & c->mask) == (val->seq & c->mask)) {
    c->size *= 2;
    c->mask = c->size - 1;
  }

  c->values = calloc(c->size, sizeof(udx_cirbuf_val_t *));
  c->values[val->seq & c->mask] = val;
  for (uint32_t i = 0; i < old_size; i++) {
    udx_cirbuf_val_t *v = old_values[i];
    if (v != NULL) c->values[v->seq & c->mask] = v;
  }

  free(old_values);
}

udx_cirbuf_val_t *
udx__cirbuf_get (udx_cirbuf_t *c, uint32_t seq) {
  udx_cirbuf_val_t *v = c->values[seq & c->mask];
  return (v == NULL || v->seq != seq) ? NULL : v;
}

udx_cirbuf_val_t *
udx__cirbuf_remove (udx_cirbuf_t *c, uint32_t seq) {
  udx_cirbuf_val_t **values = c->values + (seq & c->mask);
  udx_cirbuf_val_t *v = *values;

  if (v == NULL || v->seq != seq) return NULL;

  *values = NULL;
  return v;
}
