cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_dns C)

add_bare_module(bare_dns)

target_sources(
  ${bare_dns}
  PRIVATE
    binding.c
)
