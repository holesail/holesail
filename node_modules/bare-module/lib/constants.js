module.exports = {
  states: {
    EVALUATED: 1,
    SYNTHESIZED: 2,
    RUN: 4,
    DESTROYED: 8
  },

  types: {
    SCRIPT: 1,
    MODULE: 2,
    JSON: 3,
    BUNDLE: 4,
    ADDON: 5,
    BINARY: 6,
    TEXT: 7,
    ASSET: 8
  }
}
