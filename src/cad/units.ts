import type { Unit } from './types'
export const units: { value: Unit; label: string }[] = [
  { value: 'mm', label: 'Millimeters' }, { value: 'cm', label: 'Centimeters' },
  { value: 'm', label: 'Meters' }, { value: 'um', label: 'Micrometers' },
  { value: 'in', label: 'Inches' }, { value: 'ft', label: 'Feet' },
]
const factors: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, um: 0.001, in: 25.4, ft: 304.8 }
function finite(value: number) { if (!Number.isFinite(value)) throw new Error('Enter a finite number.'); return value }
export const UnitService = {
  toInternal(value: number, unit: Unit): number { return finite(finite(value) * factors[unit]) },
  fromInternal(value: number, unit: Unit): number { return finite(value) / factors[unit] },
  format(value: number, unit: Unit, precision = 3, power = 1): string {
    const converted = finite(value) / Math.pow(factors[unit], power)
    return `${converted.toFixed(Math.max(0, Math.min(12, precision)))} ${unit}${power === 2 ? '²' : power === 3 ? '³' : ''}`
  },
  parse(text: string, defaultUnit: Unit): number {
    const match = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|m|um|in|ft)?\s*$/i.exec(text)
    if (!match) throw new Error('Enter a number, optionally followed by mm, cm, m, um, in, or ft.')
    return this.toInternal(Number(match[1]), (match[2]?.toLowerCase() as Unit | undefined) ?? defaultUnit)
  },
}
