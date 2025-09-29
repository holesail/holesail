cmake_minimum_required(VERSION 3.31)

set(name holesail)

find_package(cmake-bare-bundle REQUIRED PATHS node_modules/cmake-bare-bundle)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

project(${name} C CXX ASM)
bare_target(target)

if(target MATCHES "win32-x64")
  enable_language(ASM_NASM)
else()
  enable_language(ASM)
endif()

fetch_package("github:holepunchto/libjstl")
fetch_package("github:holepunchto/bare@1.22.0")

add_bare_bundle(
  ${name}_bundle
  ENTRY src/bin/holesail.mjs
  OUT src/main.bundle.h
  BUILTINS src/builtins.json
)

add_executable(${name})

target_sources(
  ${name}
  PRIVATE
    src/main.bundle.h
    src/main.c
)

set_target_properties(
  ${name}
  PROPERTIES
  ENABLE_EXPORTS ON
  MACOSX_BUNDLE OFF
  WINDOWS_EXPORT_ALL_SYMBOLS ON
)

target_link_libraries(
  ${name}
  PUBLIC
    $<LINK_LIBRARY:WHOLE_ARCHIVE,bare_static>
)

link_bare_modules(${name})

install(TARGETS ${name})
