{
  'targets': [{
    'target_name': 'libudx',
    'type': 'static_library',
    'sources': [
      './libudx/src/cirbuf.c',
      './libudx/src/endian.c',
      './libudx/src/fifo.c',
      './libudx/src/udx.c',
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
        'sources': [
          './libudx/src/io_win.c',
        ],
      }, {
        'sources': [
          './libudx/src/io_posix.c',
        ],
      }],
    ],
  }]
}
