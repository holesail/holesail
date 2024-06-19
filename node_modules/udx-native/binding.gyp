{
  'targets': [{
    'target_name': 'udx',
    'include_dirs': [
      '<!(node -e "require(\'napi-macros\')")',
      './vendor/libudx/include',
    ],
    'dependencies': [
      './vendor/libudx.gyp:libudx',
    ],
    'sources': [
      './binding.c',
    ],
    'configurations': {
      'Debug': {
        'defines': ['DEBUG'],
      },
      'Release': {
        'defines': ['NDEBUG'],
      },
    },
    'conditions': [
      ['OS=="win"', {
        'libraries': [
          '-lws2_32',
        ]
      }],
    ],
  }]
}
