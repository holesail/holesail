cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_pipe C)

add_bare_module(bare_pipe)

target_sources(
  ${bare_pipe}
  PRIVATE
    binding.c
)
