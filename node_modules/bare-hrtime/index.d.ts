declare function hrtime(
  prev?: ArrayLike<number>
): [seconds: number, nanoseconds: number]

declare namespace hrtime {
  export function bigint(): bigint
}

export = hrtime
