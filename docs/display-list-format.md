# Display List JSON Format Manual

This document specifies the JSON formats used by the display viewer:

- `DisplayList`: a complete multi-frame display list (single file).
- `Frame`: one time step / optimization step, containing primitives.
- Primitive types: `point`, `line`, `sphere`, `cone`, `rect`, `text`.
- `Manifest`: a playlist that references per-frame JSON files.

The viewer can load:

- A single large `DisplayList` file (via `?displayList=` or drag-drop).
- A `Manifest` file plus multiple per-frame JSON files (via `?displayList=`).
- A local `DisplayList` JSON file (drag-drop or “Open file…”).


## 1. Coordinate system, units, and colors

- Coordinates are 3D Cartesian: `[x, y, z]`.
- The viewer uses **Z up**, with the **XY plane horizontal**.
- The built-in axes helper uses:
  - X axis: red
  - Y axis: green
  - Z axis: blue
- Units are arbitrary but consistent across primitives. All geometry (points, spheres, cones, rectangles) lives in the same world coordinate system.
- Colors are given as `Color = [r, g, b]` with each component in the range `0–1`.

Example color:

    "color": [1.0, 0.2, 0.2]   // bright reddish


## 2. Top-level `DisplayList` JSON

A `DisplayList` is a single JSON object with:

- Optional `groups` array.
- Required `frames` array.

Example:

    {
      "groups": [
        { "id": "atoms", "label": "Atoms" },
        { "id": "bonds", "label": "Bonds" }
      ],
      "frames": [
        {
          "id": 0,
          "annotation": "Frame 0\nEnergy: -123.4 kcal/mol",
          "primitives": [
            {
              "kind": "sphere",
              "center": [0, 0, 0],
              "radius": 1.0,
              "solid": true,
              "group": "atoms"
            }
          ]
        }
      ]
    }

### 2.1. Group definitions

Groups are used for visibility toggling (buttons in the UI).

Example:

    "groups": [
      {
        "id": "atoms",
        "label": "Atoms"
      },
      {
        "id": "bonds",
        "label": "Bonds"
      }
    ]

Conceptual type:

    GroupDef:
      id: string
      label: string

Notes:

- If `groups` is omitted, the viewer infers group IDs from `primitive.group` values and uses those IDs as labels.
- Groups are used purely for **visibility toggling** in the UI.


## 3. Frame object

Each frame represents one timestep / iteration:

Example:

    {
      "id": 0,
      "primitives": [ /* array of primitives */ ],
      "annotation": "Frame 0\nEnergy: -123.4 kcal/mol"
    }

Conceptual type:

    Frame:
      id: number
      primitives: Primitive[]
      annotation?: string   // optional multiline per-frame text

Notes:

- `id` is a frame identifier (typically `0…N−1`).
  - The viewer currently uses the **array index** for playback, not `id`, but keeping them aligned is good practice.
- `annotation` is optional multiline text:
  - Shown as a 2D overlay panel above the 3D view.
  - Newlines (`\n`) are preserved.
  - If `annotation` is missing or empty, nothing is shown for that frame.

Example:

    "annotation": "Frame 42\nTime: 4.2 ps\nEnergy: -456.78 kcal/mol"


## 4. Primitives

`Primitive` is a tagged union on the `kind` field.

    Color = [number, number, number]  // r,g,b in 0–1

    Primitive =
      | PointPrimitive
      | LinePrimitive
      | SpherePrimitive
      | ConePrimitive
      | RectPrimitive
      | TextPrimitive

All primitives may optionally belong to a **group**:

    "group": "atoms"


### 4.1. Points

Example:

    {
      "kind": "point",
      "position": [x, y, z],
      "color": [r, g, b],
      "size": 0.05,
      "group": "points"
    }

Conceptual type:

    PointPrimitive:
      kind: "point"
      position: [number, number, number]
      color?: Color
      size?: number     // point size in world units (approximate)
      group?: string

Notes:

- Rendered as a `THREE.Points` with a single vertex.
- `size` controls the point size; if omitted, a small default is used.


### 4.2. Lines

Example:

    {
      "kind": "line",
      "start": [x1, y1, z1],
      "end": [x2, y2, z2],
      "color": [r, g, b],
      "width": 1.0,
      "group": "bonds"
    }

Conceptual type:

    LinePrimitive:
      kind: "line"
      start: [number, number, number]
      end: [number, number, number]
      color?: Color
      width?: number    // nominal line width (limited in WebGL)
      group?: string

Notes:

- Line width support is limited by browser/WebGL; treat `width` as advisory.


### 4.3. Spheres

Example:

    {
      "kind": "sphere",
      "center": [x, y, z],
      "radius": 0.5,
      "color": [0.2, 0.2, 1.0],
      "solid": true,
      "group": "atoms"
    }

Conceptual type:

    SpherePrimitive:
      kind: "sphere"
      center: [number, number, number]
      radius: number
      color?: Color
      solid?: boolean   // true = solid (lit), false/omitted = wireframe
      group?: string

Notes:

- Rendered as `SphereGeometry + MeshPhongMaterial`.
- Ambient + directional light are used; **no shadows**.
- `solid: true` → shaded solid sphere; omitted/false → wireframe sphere.


### 4.4. Cones

Cones can be clicked to center the camera on their tip.

Example:

    {
      "kind": "cone",
      "tip": [xt, yt, zt],
      "direction": [dx, dy, dz],
      "length": 2.0,
      "radius": 0.3,
      "color": [1.0, 0.2, 0.2],
      "group": "cones"
    }

Conceptual type:

    ConePrimitive:
      kind: "cone"
      tip: [number, number, number]        // pointy end
      direction: [number, number, number]  // axis direction
      length: number                       // logical length
      radius: number                       // logical base radius
      color?: Color
      group?: string

Viewer behavior:

- The `tip` is the world-space point the cone points to and where the view centers when clicked.
- `direction` is normalized internally; the cone’s axis follows this direction.
- Geometry is scaled by an internal factor so cones are visually smaller than the full logical `length` and `radius`, but they are positioned so the **tip is exactly at `tip`**.


### 4.5. Rectangles (axis-aligned XY planes)

Example:

    {
      "kind": "rect",
      "corner": [x0, y0, z0],
      "width": 2.0,
      "height": 1.0,
      "color": [0.5, 0.5, 0.5],
      "solid": true,
      "group": "planes"
    }

Conceptual type:

    RectPrimitive:
      kind: "rect"
      corner: [number, number, number]   // lower-left corner in XY
      width: number                      // along +X
      height: number                     // along +Y
      color?: Color
      solid?: boolean                    // true = filled, false/omitted = wireframe
      group?: string

Viewer behavior:

- Rectangles are **axis-aligned** in the XY plane.
- `corner = [x0, y0, z0]` is the lower-left corner; the rectangle spans:
  - `[x0, x0 + width]` in X
  - `[y0, y0 + height]` in Y
  - `z = z0` is constant
- Rendered as a `PlaneGeometry` with `MeshPhongMaterial`.


### 4.6. Text labels (3D anchored, camera-facing)

Example:

    {
      "kind": "text",
      "position": [x, y, z],
      "text": "Origin\n(0,0,0)",
      "color": [1.0, 1.0, 0.0],
      "fontFamily": "sans-serif",
      "fontSize": 24,
      "group": "labels"
    }

Conceptual type:

    TextPrimitive:
      kind: "text"
      position: [number, number, number]
      text: string
      color?: Color
      fontFamily?: string   // CSS font family, e.g. "sans-serif"
      fontSize?: number     // pixels
      group?: string

Viewer behavior:

- Implemented as a textured sprite:
  - Fixed orientation (always facing the camera).
  - Anchored at `position` (approximate center of the text).
- `fontFamily` and `fontSize` are used to render text into a canvas; the sprite is then scaled into world units (roughly proportional to `fontSize`).


## 5. Manifest file (multi-file trajectories)

A **Manifest** is a “playlist” that points to separate per-frame JSON files.

Example:

    {
      "name": "md_run_001",
      "description": "Lysozyme MD at 300 K",
      "groups": [
        { "id": "atoms", "label": "Atoms" },
        { "id": "bonds", "label": "Bonds" }
      ],
      "frames": [
        { "index": 0, "file": "frames/frame_0000.json", "time_ps": 0.0 },
        { "index": 1, "file": "frames/frame_0001.json", "time_ps": 0.1 },
        { "index": 2, "file": "frames/frame_0002.json", "time_ps": 0.2 }
      ]
    }

Conceptual types:

    ManifestFrameEntry:
      index: number
      file: string
      time_ps?: number

    ManifestFile:
      name?: string
      description?: string
      groups?: GroupDef[]
      frames: ManifestFrameEntry[]

Viewer behavior:

- The loader fetches the manifest JSON from a URL.
- For each `frames[i].file`, it fetches that JSON and expects a `Frame` object (with `primitives`, `annotation`, etc.).
- It builds a `DisplayList`:

      {
        "groups": manifest.groups,
        "frames": [frame0, frame1, ..., frameN]
      }

- File URLs are resolved **relative to the manifest URL**:
  - Manifest at `/runs/run1/manifest.json`
  - `file: "frames/frame_0000.json"`
  - Resolves to `/runs/run1/frames/frame_0000.json`.


## 6. Single large `DisplayList` vs. `Manifest` + per-frame files

There are two main ways to structure a trajectory.

### 6.1. Single large `DisplayList` JSON

- One JSON file with the full `DisplayList` object (including all frames).
- Loaded by URL:

      ?displayList=/runs/run1/display-list.json

- Or via drag-drop / “Open file…” if the file is on your local machine.

Pros:

- Simple to generate and reason about.
- No additional manifest logic required.

Cons:

- Can become large for long trajectories.
- All frames are loaded at once.


### 6.2. `Manifest` + per-frame files

- Smaller per-frame JSONs (each a `Frame` object).
- One manifest JSON that lists them and their metadata.
- Loaded by URL:

      ?displayList=/runs/run1/manifest.json

Pros:

- Scales better to long trajectories.
- Easier to append frames incrementally while a simulation/optimization runs.
- Allows separate tools to work on or regenerate specific frames.

Cons:

- Slightly more complex to generate and manage.

The current implementation **eagerly loads** all frames referenced by the manifest; it can be extended later to lazy-load frames (e.g. a sliding window around the current frame) if needed.


## 7. Loading modes and URL parameters

The viewer recognizes the following URL query parameters:

- `displayList=URL`  
  - Fetches JSON from `URL`.
  - If JSON is a `DisplayList`, it is used directly.
  - If JSON is a `ManifestFile`, it loads the referenced frames and builds a `DisplayList`.

- `manifest=URL`  
  - Historical/compatibility parameter; treated like `displayList=URL` in the current loader.

Examples:

    ?displayList=/runs/run1/display-list.json
    ?displayList=/runs/run1/manifest.json

For **local files** (on your workstation rather than the server):

- Use drag-and-drop onto the viewer area or the “Open file…” button.
- The file must contain a `DisplayList` JSON object.
  - Manifests from local files are not currently supported because there is no base URL to resolve relative frame paths.


## 8. Recommended practices

- Keep a canonical Markdown copy of this spec in the repository (for example `docs/display-list-format.md`).
- Use a single large `DisplayList` file for small/medium trajectories and debugging.
- Use a `Manifest` plus per-frame JSONs for long MD / optimization runs, with:
  - `time_ps` or `step` fields for analysis.
  - Per-frame `annotation` summarizing energy, RMSD, etc.
- Assign consistent group IDs across frames so visibility toggles behave predictably, e.g.:
  - `"atoms"`, `"backbone"`, `"sidechains"`, `"vectors"`, `"cones"`, `"labels"`.


## 9. Converting this manual to other formats

This file is intended as the **canonical Markdown source**.

If you need a PDF, Word, or HTML manual, you can convert it using `pandoc`, for example:

    pandoc display-list-format.md -o display-list-format.pdf
    pandoc display-list-format.md -o display-list-format.docx
    pandoc display-list-format.md -o display-list-format.html

This keeps the spec easy to edit in a text editor and under version control, while still letting you produce formatted documents when needed.
