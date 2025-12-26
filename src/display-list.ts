// src/display-list.ts

// Simple RGB color in 0–1 range
export type Color = [number, number, number] | [number, number, number, number]

export interface LineSegmentsPrim {
  kind: 'lineSegments'
  segments: number[]
  color?: Color
  width?: number
  group?: string
}

export interface PointCloudPrim {
  kind: 'pointCloud'
  points: number[]
  color?: Color
  size?: number
  group?: string
}

export interface CylinderPrim {
  kind: 'cylinder'
  start: [number, number, number]
  end: [number, number, number]
  radius: number
  color?: Color
  solid?: boolean   // true = solid shaded tube, false/omitted = wireframe
  group?: string
}

export interface PolygonMeshPrim {
  kind: 'polygonMesh'
  // flat xyzxyz vertex array
  vertices: number[]
  // flat vertex indices; boundaries defined by polygonSizes
  polygons: number[]
  polygonSizes: number[]
  color?: Color
  // flat RGB/RGBA per-vertex array
  vertexColors?: number[]
  group?: string
}

export type Primitive =
  | CylinderPrim
  | PolygonMeshPrim
  | LineSegmentsPrim
  | PointCloudPrim
  | {
      kind: 'point'
      position: [number, number, number]
      color?: Color
      size?: number
      group?: string
    }
  | {
    kind: 'line'
    start: [number, number, number]
    end: [number, number, number]
    color?: Color
    width?: number
    group?: string
  }
  | {
    kind: 'sphere'
    center: [number, number, number]
    radius: number
    color?: Color
    solid?: boolean        // true = solid, false/undefined = wireframe
    group?: string
  }
  | {
    kind: 'cone'
    tip: [number, number, number]
    direction: [number, number, number]
    length: number
    radius: number
    color?: Color
    group?: string
  }
  | {
    kind: 'rect'
    corner: [number, number, number] // lower-left corner in XY plane
    width: number                    // along +X
    height: number                   // along +Y
    color?: Color
    solid?: boolean
    group?: string
  }
  | {
    kind: 'text'
    position: [number, number, number]
    text: string
    color?: Color
    fontFamily?: string
    fontSize?: number
    group?: string
  }


export interface Frame {
  id: number
  primitives: Primitive[]
  // Optional multiline annotation for this frame (shown as 2D overlay)
  annotation?: string
}


// Named groups for toggling visibility
export interface GroupDef {
  id: string   // internal id
  label: string // button label
}

export interface DisplayList {
  groups?: GroupDef[]
  frames: Frame[]
}

// Demo data with three groups
export const demoDisplayList: DisplayList = {
  groups: [
    { id: 'points', label: 'Points' },
    { id: 'lines', label: 'Lines' },
    { id: 'spheres', label: 'Spheres' },
  ],
  frames: [
    {
      id: 0,
      primitives: [
        {
          kind: 'point',
          position: [-1, 0, 0],
          color: [1, 0, 0],
          size: 0.1,
          group: 'points',
        },
        {
          kind: 'point',
          position: [1, 0, 0],
          color: [0, 1, 0],
          size: 0.1,
          group: 'points',
        },
        {
          kind: 'line',
          start: [-1, 0, 0],
          end: [1, 0, 0],
          color: [0, 0.5, 1],
          width: 1,
          group: 'lines',
        },
        {
          kind: 'sphere',
          center: [0, 1, 0],
          radius: 0.3,
          color: [1, 1, 0],
          group: 'spheres',
        },
        {
          kind: 'point',
          position: [0, 0, 0],
          color: [1, 1, 1],
          size: 0.02,
          group: 'points',
        },
        {
          kind: 'cone',
          tip: [0, 0, 0],
          direction: [0, 1, 1],
          length: 2.0,
          radius: 0.3,
          color: [1, 0, 0],
          group: 'cones',
        },
        {
          kind: 'text',
          position: [0, 0, 1],
          text: 'Origin',
          color: [1, 1, 0],
          fontFamily: 'sans-serif',
          fontSize: 24,
          group: 'labels',
        },
        {
          kind: 'sphere',
          center: [2, 0, 0],
          radius: 0.5,
          color: [0, 0, 1],
          solid: true,
          group: 'spheres',
        },
        {
          kind: 'rect',
          corner: [-1, -1, 0],
          width: 2,
          height: 1,
          color: [0.5, 0.5, 0.5],
          solid: true,
          group: 'rects',
        },
      ],
    },
    {
      id: 1,
      primitives: [
        {
          kind: 'point',
          position: [0, 0, 0],
          color: [1, 1, 1],
          size: 0.15,
          group: 'points',
        },
        {
          kind: 'sphere',
          center: [0, 0, 0],
          radius: 0.8,
          color: [0, 0.8, 0.8],
          group: 'spheres',
        },
      ],
    },
  ],
}

// Optional manifest types for on-disk "playlist" files
export interface ManifestFrameEntry {
  index: number
  file: string
  time_ps?: number
}

export interface ManifestFile {
  name?: string
  description?: string
  groups?: GroupDef[]
  frames: ManifestFrameEntry[]
}
