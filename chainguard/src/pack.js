import { readFileSync } from 'node:fs'
import { compilePack, DEFAULT_PACK } from './rules.js'

// Load a rule pack from a JSON file, or the built-in Web3 pack when no path is given.
export function loadPack(path) {
  if (!path) return DEFAULT_PACK
  let json
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(`cannot read rule pack ${path}: ${err.message}`)
  }
  return compilePack(json, path)
}
