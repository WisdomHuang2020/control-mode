export type Complex = [number, number]
export type Params = { num: number[]; den: number[]; T: number; fp: number; delay: number }
export type Computed = {
  fs: number; a_raw: number; k: number; a_eff: number; a: number;
  b: number[]; a_coef: number[]; M: number;
}
export type FrequencyResponse = {
  f: number[]; fmin: number; fmax: number;
  mag: number[]; pha: number[]; magD: number[]; phaD: number[];
}

export const C: {
  add(a: Complex, b: Complex): Complex
  sub(a: Complex, b: Complex): Complex
  mul(a: Complex, b: Complex): Complex
  div(a: Complex, b: Complex): Complex
  abs(a: Complex): number
  arg(a: Complex): number
}

export function polyEval(c: number[], s: Complex): Complex
export function polyAdd(a: number[], b: number[]): number[]
export function polyMul(a: number[], b: number[]): number[]
export function polyPow(p: number[], e: number): number[]
export function polyDeg(c: number[]): number
export function substitute(num: number[], den: number[], a: number): { n: number[]; d: number[]; M: number }
export function toNegPowers(nz: number[], dz: number[], M: number): { b: number[]; a: number[] }
export function fmt(x: number, sig?: number): string
export function polyText(c: number[], varname: string): string
export function texPoly(c: number[], v: string): string
export function texNeg(c: number[]): string
export function parseSeries(txt: string): number[]
export function presetCoefficients(key: string): { num: number[]; den: number[] } | null

export const PRESETS: Record<string, {
  label: string
  fz?: number
  fp?: number
  fL?: number
  build: (...args: number[]) => { num: number[]; den: number[] }
}>

export function computeTustin(params: Params): Computed
export function Gc(params: Params, w: number): Complex
export function Gcd(params: Params, w: number, a: number, delay: number): Complex
export function frequencyResponse(params: Params, computed: Computed, N?: number): FrequencyResponse
export function errorAt(params: Params, computed: Computed, freq: number): { dB: number; ph: number } | null
export function differenceEquation(b: number[], aCoef: number[]): string
