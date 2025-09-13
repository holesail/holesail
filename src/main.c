#include <assert.h>
#include <bare.h>
#include <uv.h>

#include "main.bundle.h"

int
main(int argc, char *argv[]) {
  int err;

  argv = uv_setup_args(argc, argv);

  js_platform_t *platform;
  err = js_create_platform(uv_default_loop(), NULL, &platform);
  assert(err == 0);

  bare_t *bare;
  err = bare_setup(uv_default_loop(), platform, NULL, argc, (const char **) argv, NULL, &bare);
  assert(err == 0);

  uv_buf_t source = uv_buf_init((char *) main_bundle, main_bundle_len);

  err = bare_load(bare, "/main.bundle", &source, NULL);
  assert(err == 0);

  err = bare_run(bare);
  assert(err == 0);

  int exit_code;
  err = bare_teardown(bare, &exit_code);
  assert(err == 0);

  err = js_destroy_platform(platform);
  assert(err == 0);

  err = uv_run(uv_default_loop(), UV_RUN_ONCE);
  assert(err == 0);

  return exit_code;
}
