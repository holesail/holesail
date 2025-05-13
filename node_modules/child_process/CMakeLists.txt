cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_subprocess C)

add_bare_module(bare_subprocess)

target_sources(
  ${bare_subprocess}
  PRIVATE
    binding.c
)
