cmake_minimum_required(VERSION 3.31)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_MACOSX_BUNDLE OFF)

project(bare_crypto C CXX)

bare_target(target)

if(target MATCHES "win32")
  set(OPENSSL_NO_ASM ON)

  add_definitions(-DWIN32_LEAN_AND_MEAN)
else()
  enable_language(ASM)
endif()

fetch_package("github:google/boringssl#0.20250311.0")

if(TARGET c++)
  target_link_libraries(ssl c++)
endif()

add_bare_module(bare_crypto)

target_sources(
  ${bare_crypto}
  PRIVATE
    binding.c
)

target_link_libraries(
  ${bare_crypto}
  PUBLIC
    ssl
)
