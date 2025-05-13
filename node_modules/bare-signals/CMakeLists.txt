cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_signals C)

add_bare_module(bare_signals)

target_sources(
  ${bare_signals}
  PRIVATE
    binding.c
)
