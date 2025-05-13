cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_tty C)

add_bare_module(bare_tty)

target_sources(
  ${bare_tty}
  PRIVATE
    binding.c
)
