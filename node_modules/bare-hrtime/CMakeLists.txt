cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_hrtime C)

add_bare_module(bare_hrtime)

target_sources(
  ${bare_hrtime}
  PRIVATE
    binding.c
)
