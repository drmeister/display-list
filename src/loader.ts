// src/loader.ts
import type {
  DisplayList,
  Frame,
  ManifestFile,
} from './display-list'

// ---- Type guards ----

function isManifest(obj: any): obj is ManifestFile {
  return (
    obj &&
      Array.isArray(obj.frames) &&
      obj.frames.length > 0 &&
      typeof obj.frames[0].file === 'string'
  )
}

function isDisplayList(obj: any): obj is DisplayList {
  return (
    obj &&
      Array.isArray(obj.frames) &&
      obj.frames.length > 0 &&
      Array.isArray(obj.frames[0].primitives)
  )
}

// ---- Low-level helper to fetch a single frame ----

async function fetchFrame(frameUrl: string): Promise<Frame> {
  const res = await fetch(frameUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch frame: ${frameUrl} (${res.status})`)
  }
  const data = await res.json()
  if (!Array.isArray((data as any).primitives)) {
    throw new Error(`Invalid frame JSON at ${frameUrl}: missing "primitives"`)
  }
  return data as Frame
}

// ---- High-level loaders ----

// Load a DisplayList or manifest from a URL.
// If it's already a DisplayList JSON, just return it.
// If it's a manifest JSON, fetch all the frames it references.
export async function loadDisplayListFromUrl(url: string): Promise<DisplayList> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch display list: ${url} (${res.status})`)
  }
  const obj = await res.json()

  if (isDisplayList(obj)) {
    return obj
  }

  if (isManifest(obj)) {
    const manifest = obj as ManifestFile
    const base = new URL(url, window.location.href)
    const frames: Frame[] = []
    for (const entry of manifest.frames) {
      const frameUrl = new URL(entry.file, base).toString()
      const frame = await fetchFrame(frameUrl)
      frames.push(frame)
    }
    return {
      groups: manifest.groups,
      frames,
    }
  }

  throw new Error('JSON at URL is neither a DisplayList nor a manifest')
}

// Read from a local File (drag-and-drop or file input).
// For now we only accept direct DisplayList JSON here (no manifest),
// because we don’t have a base URL to resolve relative frame paths.
export async function loadDisplayListFromFile(file: File): Promise<DisplayList> {
  const text = await file.text()
  const obj = JSON.parse(text)

  if (isDisplayList(obj)) {
    return obj
  }

  if (isManifest(obj)) {
        throw new Error(
      'Manifest JSON from a local file is not supported (no base URL to resolve frame paths).',
        )
  }

  throw new Error('JSON file is neither a DisplayList nor a manifest')
}



