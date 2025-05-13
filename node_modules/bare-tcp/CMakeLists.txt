cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

project(bare_tcp C)

bare_target(target)

add_bare_module(bare_tcp)

target_sources(
  ${bare_tcp}
  PRIVATE
    binding.c
)

if(target MATCHES "win32")
  target_link_libraries(
    ${bare_tcp}
    PUBLIC
      ws2_32
  )
endif()
