#define assert_bounds(arraybuffer) \
  assert(arraybuffer##_offset + arraybuffer##_len <= arraybuffer.size())

#define SN_STATUS_THROWS(call, message) \
  if ((call) != 0) { \
    err = js_throw_error(env, NULL, message); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_STATUS_THROWS_VOID(call, message) \
  if ((call) != 0) { \
    err = js_throw_error(env, NULL, message); \
    assert(err == 0); \
    return; \
  }

#define SN_THROWS(condition, message) \
  if ((condition)) { \
    err = js_throw_error(env, NULL, message); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_BUFFER_CAST(type, name, val) \
  type name; \
  size_t name##_size; \
  SN_STATUS_THROWS(js_get_typedarray_info(env, val, NULL, (void **) &name, &name##_size, NULL, NULL), "")

#define SN_TYPE_ASSERT(name, var, type, message) \
  js_value_type_t name##_valuetype; \
  SN_STATUS_THROWS(js_typeof(env, var, &name##_valuetype), ""); \
  if (name##_valuetype != type) { \
    err = js_throw_type_error(env, NULL, message); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_TYPEDARRAY_ASSERT(name, var, message) \
  bool name##_is_typedarray; \
  SN_STATUS_THROWS(js_is_typedarray(env, var, &name##_is_typedarray), ""); \
  if (name##_is_typedarray != true) { \
    err = js_throw_type_error(env, NULL, message); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_ASSERT_MIN_LENGTH(length, constant, name) \
  SN_THROWS(length < constant, #name " must be at least " #constant " bytes long")

#define SN_ASSERT_MAX_LENGTH(length, constant, name) \
  SN_THROWS(length > constant, #name " must be at most " #constant " bytes long")

#define SN_ASSERT_LENGTH(length, constant, name) \
  SN_THROWS(length != constant, #name " must be " #constant " bytes long")

#define SN_RANGE_THROWS(condition, message) \
  if (condition) { \
    err = js_throw_range_error(env, NULL, message); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_ASSERT_OPT_CALLBACK(argn) \
  if (argc > argn) { \
    js_value_type_t type; \
    err = js_typeof(env, argv[argn], &type); \
    assert(err == 0); \
    if (type != js_function) { \
      err = js_throw_error(env, "EINVAL", "Callback must be a function"); \
      assert(err == 0); \
      return NULL; \
    } \
  }


#define SN_ARGV(n, method_name) \
  int err; \
  js_value_t *argv[n]; \
  size_t argc = n; \
  SN_STATUS_THROWS(js_get_callback_info(env, info, &argc, argv, NULL, NULL), ""); \
  if (argc != n) { \
    err = js_throw_type_error(env, NULL, #method_name " requires " #n " argument(s)"); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_ARGV_OPTS(required, total, method_name) \
  int err; \
  js_value_t *argv[total]; \
  size_t argc = total; \
  SN_STATUS_THROWS(js_get_callback_info(env, info, &argc, argv, NULL, NULL), ""); \
  if (argc < required) { \
    err = js_throw_type_error(env, NULL, #method_name " requires at least " #required " argument(s)"); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_LIT_LENGTH(literal) (sizeof(#literal) - 1)

#define SN_EXPORT_FUNCTION(name, cb) \
  { \
    js_value_t *name##_fn; \
    SN_STATUS_THROWS(js_create_function(env, #name, SN_LIT_LENGTH(name), cb, NULL, &name##_fn), "") \
    SN_STATUS_THROWS(js_set_named_property(env, exports, #name, name##_fn), "") \
  }

#define SN_EXPORT_UINT32(name, num) \
  { \
    js_value_t *name##_num; \
    SN_STATUS_THROWS(js_create_uint32(env, (uint32_t) num, &name##_num), "") \
    SN_STATUS_THROWS(js_set_named_property(env, exports, #name, name##_num), "") \
  }

#define SN_EXPORT_UINT64(name, num) \
  { \
    js_value_t *name##_num; \
    uint64_t max = 0x1fffffffffffffULL; \
    SN_STATUS_THROWS(js_create_int64(env, (uint64_t) (max < num ? max : num), &name##_num), "") \
    SN_STATUS_THROWS(js_set_named_property(env, exports, #name, name##_num), "") \
  }

#define SN_EXPORT_STRING(name, string) \
  { \
    js_value_t *name##_string; \
    SN_STATUS_THROWS(js_create_string_utf8(env, (const utf8_t *) string, -1, &name##_string), "") \
    SN_STATUS_THROWS(js_set_named_property(env, exports, #name, name##_string), "") \
  }

#define SN_ARGV_CHECK_NULL(name, index) \
  js_value_type_t name##_valuetype; \
  SN_STATUS_THROWS(js_typeof(env, argv[index], &name##_valuetype), "") \
  bool name##_is_null = name##_valuetype == js_null;

#define SN_ARGV_OPTS_TYPEDARRAY(name, index) \
  js_value_type_t name##_valuetype; \
  uint8_t *name##_data = NULL; \
  size_t name##_size = 0; \
  SN_STATUS_THROWS(js_typeof(env, argv[index], &name##_valuetype), "") \
  bool use_##name = (name##_valuetype != js_null && name##_valuetype != js_undefined); \
  if (use_##name) { \
    js_value_t *name##_argv = argv[index]; \
    SN_TYPEDARRAY_ASSERT(name, name##_argv, #name " must be an instance of TypedArray") \
    SN_OPT_TYPEDARRAY(name, name##_argv) \
  }

#define SN_TYPEDARRAY(name, var) \
  js_typedarray_type_t name##_type; \
  size_t name##_length; \
  uint8_t *name##_data = NULL; \
  err = js_get_typedarray_info(env, (var), &name##_type, (void **) &name##_data, &name##_length, NULL, NULL); \
  assert(err == 0); \
  uint8_t name##_width = typedarray_width(name##_type); \
  SN_THROWS(name##_width == 0, "Unexpected TypedArray type") \
  size_t name##_size = name##_length * name##_width;

#define SN_TYPEDARRAY_PTR(name, var) \
  js_typedarray_type_t name##_type; \
  size_t name##_length; \
  void *name##_data; \
  err = js_get_typedarray_info(env, (var), &name##_type, &name##_data, &name##_length, NULL, NULL); \
  assert(err == 0); \
  uint8_t name##_width = typedarray_width(name##_type); \
  SN_THROWS(name##_width == 0, "Unexpected TypedArray type") \

#define SN_OPT_TYPEDARRAY(name, var) \
  js_typedarray_type_t name##_type; \
  size_t name##_length; \
  err = js_get_typedarray_info(env, (var), &name##_type, (void **) &name##_data, &name##_length, NULL, NULL); \
  assert(err == 0); \
  uint8_t name##_width = typedarray_width(name##_type); \
  SN_THROWS(name##_width == 0, "Unexpected TypedArray type") \
  name##_size = name##_length * name##_width;

#define SN_UINT8(name, val) \
  uint32_t name##_int32; \
  if (js_get_value_uint32(env, val, &name##_int32) != 0) { \
    err = js_throw_error(env, "EINVAL", "Expected number"); \
    assert(err == 0); \
    return NULL; \
  } \
  SN_THROWS(name##_int32 > 255, "expect uint8") \
  unsigned char name = 0xff & name##_int32;

#define SN_UINT32(name, val) \
  uint32_t name; \
  if (js_get_value_uint32(env, val, &name) != 0) { \
    err = js_throw_error(env, "EINVAL", "Expected number"); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_OPT_UINT32(name, val) \
  if (js_get_value_uint32(env, val, (uint32_t *) &name) != 0) { \
    err = js_throw_error(env, "EINVAL", "Expected number"); \
    assert(err == 0); \
    return NULL; \
  }

#define SN_UINT64(name, val) \
  int64_t name##_i64; \
  if (js_get_value_int64(env, val, &name##_i64) != 0) { \
    err = js_throw_error(env, "EINVAL", "Expected number"); \
    assert(err == 0); \
    return NULL; \
  } \
  if (name##_i64 < 0) { \
    err = js_throw_error(env, "EINVAL", "Expected positive number"); \
    assert(err == 0); \
    return NULL; \
  } \
  uint64_t name = (uint64_t) name##_i64;

#define SN_ARGV_TYPEDARRAY(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPEDARRAY_ASSERT(name, name##_argv, #name " must be an instance of TypedArray") \
  SN_TYPEDARRAY(name, name##_argv)

#define SN_ARGV_TYPEDARRAY_PTR(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPEDARRAY_ASSERT(name, name##_argv, #name " must be an instance of TypedArray") \
  SN_TYPEDARRAY_PTR(name, name##_argv)

#define SN_ARGV_BUFFER_CAST(type, name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_BUFFER_CAST(type, name, name##_argv)

#define SN_OPT_ARGV_TYPEDARRAY(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPEDARRAY_ASSERT(name, name##_argv, #name " must be an instance of TypedArray") \
  SN_OPT_TYPEDARRAY(name, name##_argv)

#define SN_ARGV_UINT8(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPE_ASSERT(name, name##_argv, js_number, #name " must be an instance of Number") \
  SN_UINT8(name, name##_argv)

#define SN_ARGV_UINT32(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPE_ASSERT(name, name##_argv, js_number, #name " must be an instance of Number") \
  SN_UINT32(name, name##_argv)

#define SN_ARGV_UINT64(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPE_ASSERT(name, name##_argv, js_number, #name " must be an instance of Number") \
  SN_UINT64(name, name##_argv)

#define SN_OPT_ARGV_UINT32(name, index) \
  js_value_t *name##_argv = argv[index]; \
  SN_TYPE_ASSERT(name, name##_argv, js_number, #name " must be an instance of Number") \
  SN_OPT_UINT32(name, name##_argv)

#define SN_CALL(call, message) \
  int success = call; \
  SN_THROWS(success != 0, message)

#define SN_CALL_FUNCTION(env, ctx, cb, n, argv, res) \
  { \
    int err = js_call_function_with_checkpoint(env, ctx, cb, n, argv, res); \
    if (err == js_pending_exception) { \
      js_value_t *fatal_exception; \
      err = js_get_and_clear_last_exception(env, &fatal_exception); \
      assert(err == 0); \
      err = js_fatal_exception(env, fatal_exception); \
      assert(err == 0); \
    } \
  }

#define SN_RETURN(call, message) \
  int success = (call); \
  SN_THROWS(success != 0, message) \
  return NULL;

#define SN_RETURN_BOOLEAN(call) \
  int success = call; \
  js_value_t *result; \
  SN_THROWS(js_get_boolean(env, success == 0, &result) != 0, "result not boolean") \
  return result;

#define SN_RETURN_BOOLEAN_FROM_1(call) \
  int success = call; \
  js_value_t *result; \
  SN_THROWS(js_get_boolean(env, success != 0, &result) != 0, "result not boolean") \
  return result;

#define SN_ASYNC_CHECK_FOR_ERROR(message) \
  if (req->n == 0) { \
    err = js_get_null(req->env, &argv[0]); \
    assert(err == 0); \
  } else { \
    js_value_t *err_msg; \
    err = js_create_string_utf8(req->env, (const utf8_t *) #message, SN_LIT_LENGTH(message), &err_msg); \
    assert(err == 0); \
    err = js_create_error(req->env, NULL, err_msg, &argv[0]); \
    assert(err == 0); \
  }

#define SN_CALLBACK_CHECK_FOR_ERROR(message) \
  if (task->code == 0) { \
    err = js_get_null(req->env, &argv[0]); \
    assert(err == 0); \
  } else { \
    js_value_t *err_msg; \
    err = js_create_string_utf8(req->env, (const utf8_t *) #message, SN_LIT_LENGTH(message), &err_msg); \
    assert(err == 0); \
    err = js_create_error(req->env, NULL, err_msg, &argv[0]); \
    assert(err == 0); \
  }

#define SN_QUEUE_WORK(req, execute, complete) \
  uv_loop_t *loop; \
  err = js_get_env_loop(env, &loop); \
  assert(err == 0); \
  err = uv_queue_work(loop, (uv_work_t *) req, execute, complete); \
  assert(err == 0);

#define SN_QUEUE_TASK(task, execute, complete) \
  uv_loop_t *loop; \
  err = js_get_env_loop(env, &loop); \
  assert(err == 0); \
  err = uv_queue_work(loop, (uv_work_t *) task, execute, complete); \
  assert(err == 0); \

#define SN_ASYNC_TASK(cb_pos) \
    task->req = (void *) req; \
    js_value_t *promise; \
    if (argc > cb_pos) { \
      task->type = sn_async_task_t::sn_async_task_callback; \
      promise = NULL; \
      err = js_create_reference(env, argv[cb_pos], 1, &task->cb); \
      assert(err == 0); \
    } else { \
      task->type = sn_async_task_t::sn_async_task_promise; \
      err = js_create_promise(env, &task->deferred, &promise); \
      assert(err == 0); \
    }

#define SN_ASYNC_COMPLETE(message) \
  js_value_t *argv[1]; \
  switch (task->type) { \
    case sn_async_task_t::sn_async_task_promise: { \
    if (task->code == 0) { \
      err = js_get_null(req->env, &argv[0]); \
      assert(err == 0); \
      err = js_resolve_deferred(req->env, task->deferred, argv[0]); \
      assert(err == 0); \
    } else { \
      js_value_t *err_msg; \
      assert(err == 0); \
      err = js_create_string_utf8(req->env, (const utf8_t *) #message, SN_LIT_LENGTH(message), &err_msg); \
      assert(err == 0); \
      err = js_create_error(req->env, NULL, err_msg, &argv[0]); \
      assert(err == 0); \
      err = js_reject_deferred(req->env, task->deferred, argv[0]); \
      assert(err == 0); \
    } \
    task->deferred = NULL; \
    break; \
  } \
  case sn_async_task_t::sn_async_task_callback: { \
    SN_CALLBACK_CHECK_FOR_ERROR(#message) \
    js_value_t *callback; \
    err = js_get_reference_value(req->env, task->cb, &callback); \
    assert(err == 0); \
    js_value_t *return_val; \
    SN_CALL_FUNCTION(req->env, global, callback, 1, argv, &return_val) \
    err = js_delete_reference(req->env, task->cb); \
    assert(err == 0); \
    break; \
  } \
  }

#define SN_BUFFER_CAST(type, name, val) \
  type name; \
  size_t name##_size; \
  SN_STATUS_THROWS(js_get_typedarray_info(env, val, NULL, (void **) &name, &name##_size, NULL, NULL), "")
