cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-napi REQUIRED PATHS node_modules/cmake-napi)
find_package(cmake-npm REQUIRED PATHS node_modules/cmake-npm)

project(bare_module_lexer C)

add_bare_module(bare_module_lexer)

target_sources(
  ${bare_module_lexer}
  PRIVATE
    binding.c
)

add_napi_module(bare_module_lexer_napi)

target_sources(
  ${bare_module_lexer_napi}
  PRIVATE
    binding.c
)

resolve_node_module(bare-compat-napi compat)

target_include_directories(
  ${bare_module_lexer_napi}
  PRIVATE
    "${compat}/include"
)
