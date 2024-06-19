cmake_minimum_required(VERSION 3.25)

project(udx_native C)

include(bare)

if(NOT TARGET udx)
  add_subdirectory(vendor/libudx EXCLUDE_FROM_ALL)
endif()

add_bare_module(udx_native)

target_sources(
  ${udx_native}
  PRIVATE
    binding.c
)

target_link_libraries(
  ${udx_native}
  PUBLIC
    udx_static
)
