cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_module C)

add_bare_module(bare_module)

target_sources(
  ${bare_module}
  PRIVATE
    binding.c
)
