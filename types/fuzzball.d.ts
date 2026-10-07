// Type shim for fuzzball (no official types available)
declare module 'fuzzball' {
  export function ratio(a: string, b: string, opts?: any): number
  export function partial_ratio(a: string, b: string, opts?: any): number
  export function token_sort_ratio(a: string, b: string, opts?: any): number
  export function token_set_ratio(a: string, b: string, opts?: any): number
  export function extract(
    query: string,
    choices: string[] | Record<string, string>,
    opts?: any
  ): Array<[string, number]> | Array<[string, number, any]>
  export const distance: (a: string, b: string, opts?: any) => number
  const _default: {
    ratio: typeof ratio
    partial_ratio: typeof partial_ratio
    token_sort_ratio: typeof token_sort_ratio
    token_set_ratio: typeof token_set_ratio
    extract: typeof extract
    distance: typeof distance
  }
  export default _default
}
