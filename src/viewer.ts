// src/viewer.ts
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  DisplayList,
  Frame,
  Primitive,
  GroupDef,
  Color,
} from './display-list'


function makeThreeColor(color?: Color): THREE.Color {
  if (!color) return new THREE.Color(1, 1, 1)
  return new THREE.Color(color[0], color[1], color[2])
}

function colorToThree(color?: Color): THREE.Color {
  if (!color) return new THREE.Color(1, 1, 1)
  const [r, g, b] = color
  return new THREE.Color(r, g, b)
}

function buildPolygonMeshGeometry(
  vertices: number[],
  polygons: number[],
  polygonSizes: number[],
  vertexColors?: number[],
): { geometry: THREE.BufferGeometry; hasVertexColors: boolean } {
  if (vertices.length % 3 !== 0) {
    console.warn('polygonMesh.vertices length not multiple of 3')
  }

  const vertexCount = Math.floor(vertices.length / 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(vertices), 3),
  )

  let triCount = 0
  for (const size of polygonSizes) {
    if (size < 3) {
      console.warn('polygonMesh polygonSizes contains size < 3')
      continue
    }
    triCount += size - 2
  }

  const indexCount = triCount * 3
  const indices =
    vertexCount > 65535
      ? new Uint32Array(indexCount)
      : new Uint16Array(indexCount)

  let polyOffset = 0
  let write = 0
  for (const size of polygonSizes) {
    if (size < 3) {
      polyOffset += size
      continue
    }

    const base = polygons[polyOffset]
    for (let i = 1; i < size - 1; i += 1) {
      indices[write++] = base
      indices[write++] = polygons[polyOffset + i]
      indices[write++] = polygons[polyOffset + i + 1]
    }

    polyOffset += size
  }

  if (polyOffset !== polygons.length) {
    console.warn(
      'polygonMesh.polygons length does not match sum of polygonSizes',
    )
  }

  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  let hasVertexColors = false
  if (vertexColors && vertexColors.length > 0) {
    const rgbLen = vertexCount * 3
    const rgbaLen = vertexCount * 4
    if (vertexColors.length !== rgbLen && vertexColors.length !== rgbaLen) {
      console.warn(
        'polygonMesh.vertexColors length must be 3 or 4 per vertex',
      )
    } else {
      const colors = new Float32Array(rgbLen)
      if (vertexColors.length === rgbaLen) {
        for (let i = 0, j = 0; i < rgbaLen; i += 4, j += 3) {
          colors[j] = vertexColors[i]
          colors[j + 1] = vertexColors[i + 1]
          colors[j + 2] = vertexColors[i + 2]
        }
      } else {
        colors.set(vertexColors)
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      hasVertexColors = true
    }
  }

  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  return { geometry, hasVertexColors }
}

export interface Viewer {
  setFrame(index: number): void
  setGroupVisibility(groupId: string, visible: boolean): void
  getGroups(): GroupDef[]
  getFrameCount(): number
  setBackground(color: THREE.ColorRepresentation): void
  dispose(): void
}
function createCylinderMesh(
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
  color?: [number, number, number],
  solid?: boolean,
): THREE.Mesh | null {
  const startV = new THREE.Vector3(start[0], start[1], start[2])
  const endV = new THREE.Vector3(end[0], end[1], end[2])

  const dir = new THREE.Vector3().subVectors(endV, startV)
  const length = dir.length()
  if (length === 0) return null

  // Midpoint for position
  const mid = new THREE.Vector3().addVectors(startV, endV).multiplyScalar(0.5)

  // Cylinder along +Y by default in Three.js
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16)
    const material = new THREE.MeshPhongMaterial({
      color: makeThreeColor(color),
      wireframe: !solid,
    })
  const mesh = new THREE.Mesh(geometry, material)

  // Orient from +Y to the direction vector
  dir.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
  mesh.quaternion.copy(quat)

  mesh.position.copy(mid)
  return mesh
}


function createTextSprite(
  text: string,
  color: [number, number, number] = [1, 1, 1],
  fontFamily = 'sans-serif',
  fontSize = 32,
): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Cannot get 2D context')
  }

  const [r, g, b] = color
  const cssColor = `rgb(${Math.round(r * 255)}, ${Math.round(
    g * 255,
  )}, ${Math.round(b * 255)})`

  ctx.font = `${fontSize}px ${fontFamily}`
  const metrics = ctx.measureText(text)
  canvas.width = Math.ceil(metrics.width) + 8
  canvas.height = fontSize + 8

  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = cssColor
  ctx.textBaseline = 'top'
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillText(text, 4, 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    })
  const sprite = new THREE.Sprite(material)

  // scale down into world units
  const scale = 0.01 * fontSize
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1)

  return sprite
}


function buildPrimitiveObject(prim: Primitive): THREE.Object3D {
  switch (prim.kind) {

    case 'polygonMesh': {
      const { geometry, hasVertexColors } = buildPolygonMeshGeometry(
        prim.vertices,
        prim.polygons,
        prim.polygonSizes,
        prim.vertexColors,
      )

      const meshColor = hasVertexColors
        ? new THREE.Color(1, 1, 1)
        : colorToThree(prim.color)

      const mat = new THREE.MeshPhongMaterial({
        color: meshColor,
        vertexColors: hasVertexColors,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geometry, mat)
      if (prim.group) mesh.userData.groupId = prim.group
      return mesh
    }

    case 'lineSegments': {
      if (prim.segments.length % 6 !== 0) {
        console.warn('lineSegments.segments length not multiple of 6')
      }

      const positions = new Float32Array(prim.segments)

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.computeBoundingSphere()

            const mat = new THREE.LineBasicMaterial({
              color: colorToThree(prim.color),
              linewidth: prim.width ?? 1,
            })

      const obj = new THREE.LineSegments(geom, mat)
      if (prim.group) obj.userData.groupId = prim.group
      return obj
    }

    case 'pointCloud': {
      if (prim.points.length % 3 !== 0) {
        console.warn('pointCloud.points length not multiple of 3')
      }

      const positions = new Float32Array(prim.points)

      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.computeBoundingSphere()

            const mat = new THREE.PointsMaterial({
              size: prim.size ?? 0.05,
              color: colorToThree(prim.color),
            })

      const obj = new THREE.Points(geom, mat)
      if (prim.group) obj.userData.groupId = prim.group
      return obj
    }

  case 'point': {
    const geom = new THREE.BufferGeometry()
          const positions = new Float32Array([
        prim.position[0],
        prim.position[1],
        prim.position[2],
          ])
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          const mat = new THREE.PointsMaterial({
            size: prim.size ?? 0.05,            // use provided size
            color: colorToThree(prim.color),
          })
    const obj = new THREE.Points(geom, mat)
    if (prim.group) obj.userData.groupId = prim.group
    return obj
  }

  case 'line': {
          const points = [
        new THREE.Vector3(...prim.start),
        new THREE.Vector3(...prim.end),
          ]
    const geom = new THREE.BufferGeometry().setFromPoints(points)
          const mat = new THREE.LineBasicMaterial({
            color: colorToThree(prim.color),
            linewidth: prim.width ?? 1,
          })
    const obj = new THREE.Line(geom, mat)
    if (prim.group) obj.userData.groupId = prim.group
    return obj
  }

    case 'sphere': {
      const geom = new THREE.SphereGeometry(prim.radius, 32, 24)
            const mat = new THREE.MeshPhongMaterial({
              color: colorToThree(prim.color),
              wireframe: prim.solid ? false : true,
            })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(...prim.center)
      if (prim.group) mesh.userData.groupId = prim.group
      return mesh
    }

    case 'cone': {
      // Scale cone to 1/10 of the requested dimensions
      const scale = 0.1
      const height = prim.length * scale
      const radius = prim.radius * scale

      const geom = new THREE.ConeGeometry(radius, height, 32, 1, false)
      const mat = new THREE.MeshPhongMaterial({
        color: colorToThree(prim.color),
      })
      const mesh = new THREE.Mesh(geom, mat)

      const dir = new THREE.Vector3(...prim.direction).normalize()
      const from = new THREE.Vector3(0, 1, 0)
      const q = new THREE.Quaternion().setFromUnitVectors(from, dir)
      mesh.quaternion.copy(q)

      const tip = new THREE.Vector3(...prim.tip)
      const centerOffset = dir.clone().multiplyScalar(-height / 2)
      mesh.position.copy(tip.clone().add(centerOffset))

      mesh.userData.groupId = prim.group
      mesh.userData.isCone = true
      mesh.userData.tip = prim.tip
      return mesh
    }

    case 'rect': {
      // Axis-aligned rectangle in the XY plane, Z = corner[2]
      const geom = new THREE.PlaneGeometry(prim.width, prim.height)
      const mat = new THREE.MeshPhongMaterial({
        color: colorToThree(prim.color),
        side: THREE.DoubleSide,
        wireframe: prim.solid ? false : true,
      })
      const mesh = new THREE.Mesh(geom, mat)

      // PlaneGeometry is centered at origin in XY; shift so corner is at lower-left
      const [cx, cy, cz] = prim.corner
            mesh.position.set(
        cx + prim.width / 2,
        cy + prim.height / 2,
        cz,
            )

      if (prim.group) mesh.userData.groupId = prim.group
      return mesh
    }
  case 'text': {
          const sprite = createTextSprite(
        prim.text,
        prim.color ?? [1, 1, 1],
        prim.fontFamily ?? 'sans-serif',
        prim.fontSize ?? 32,
          )
    sprite.position.set(...prim.position)
    if (prim.group) sprite.userData.groupId = prim.group
    return sprite
  }
    case 'cylinder': {
      const mesh = createCylinderMesh(prim.start, prim.end, prim.radius, prim.color, prim.solid)
      if (!mesh) return null
      if (prim.group) {
        (mesh as any).userData.groupId = prim.group
      }
      return mesh
    }
  }
}

function buildFrameGroup(frame: Frame): THREE.Group {
  const group = new THREE.Group()
  for (const prim of frame.primitives) {
    const obj = buildPrimitiveObject(prim)
    if (obj) group.add(obj)
  }
  return group
}

function collectGroupDefs(displayList: DisplayList): GroupDef[] {
  if (displayList.groups && displayList.groups.length > 0) {
    return displayList.groups
  }
  const ids = new Set<string>()
  for (const frame of displayList.frames) {
    for (const prim of frame.primitives) {
      if (prim.group) ids.add(prim.group)
    }
  }
  return Array.from(ids)
    .sort()
    .map((id) => ({ id, label: id }))
}

function applyGroupVisibilityToObject(
  obj: THREE.Object3D,
  vis: Record<string, boolean>,
) {
  const groupId = obj.userData?.groupId as string | undefined
  if (groupId) {
    obj.visible = vis[groupId] !== false
  }
  for (const child of obj.children) {
    applyGroupVisibilityToObject(child, vis)
  }
}

export function initViewer(
  container: HTMLDivElement,
  displayList: DisplayList,
  initialFrame = 0,
): Viewer {

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  const coneObjects: THREE.Object3D[] = []

  const CLICK_THRESHOLD = 5 // pixels
  let pointerDown = false
  let pointerDownX = 0
  let pointerDownY = 0

  // Smooth focus animation state
  let isFocusing = false
  const focusDuration = 0.5 // seconds

  let focusStartTime = 0
  const focusStartTarget = new THREE.Vector3()
  const focusEndTarget = new THREE.Vector3()
  const focusStartCamPos = new THREE.Vector3()
  const focusEndCamPos = new THREE.Vector3()

  const width = container.clientWidth || window.innerWidth
  const height = container.clientHeight || window.innerHeight

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
  camera.up.set(0, 0, 1)
  camera.position.set(0, -25, 25)
  camera.lookAt(new THREE.Vector3(0, 0, 0))

  // Soft ambient so nothing is totally black
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25)
  scene.add(ambientLight)

  // Key light attached to the camera: "behind right shoulder"
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9)
  // camera local coords: +X right, +Y up, +Z behind
  keyLight.position.set(0.6, 0.8, 1.0)

  // Make sure the camera is in the scene graph
  scene.add(camera)
  // Parent the light to the camera so it moves with the viewer
  camera.add(keyLight)



  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  container.appendChild(renderer.domElement)

  function setBackground(color: THREE.ColorRepresentation) {
    const c = new THREE.Color(color)
    scene.background = c
    renderer.setClearColor(c, 1)
  }

  const controls = new TrackballControls(camera, renderer.domElement)
  controls.rotateSpeed = 2.0
  controls.zoomSpeed = 1.2
  controls.panSpeed = 0.8
  controls.noZoom = false
  controls.noPan = false
  controls.staticMoving = false
  controls.dynamicDampingFactor = 0.15
  controls.target.set(0, 0, 0)

  const pointer = new THREE.Vector2()

  function startFocusAnimation(point: THREE.Vector3) {
    // Preserve camera–target offset so distance stays the same
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target)

    focusStartTarget.copy(controls.target)
    focusEndTarget.copy(point)

    focusStartCamPos.copy(camera.position)
    focusEndCamPos.copy(point.clone().add(offset))

    focusStartTime = performance.now()
    isFocusing = true
  }

  // Axes: X=red, Y=green, Z=blue
  const axes = new THREE.AxesHelper(2)
  scene.add(axes)

  const groups = collectGroupDefs(displayList)
  const groupVisibility: Record<string, boolean> = {}
  for (const g of groups) groupVisibility[g.id] = true

  const frameGroups = displayList.frames.map(buildFrameGroup)

  // collect cone meshes for picking
  for (const fg of frameGroups) {
    fg.traverse((obj) => {
      if (obj.userData && obj.userData.isCone) {
        coneObjects.push(obj)
      }
    })
  }
  
  let currentIndex = Math.min(
    Math.max(initialFrame, 0),
    frameGroups.length - 1,
  )
  let currentGroup: THREE.Object3D | null = null

  function attachFrame(index: number) {
    if (currentGroup) {
      scene.remove(currentGroup)
    }
    currentGroup = frameGroups[index]
    scene.add(currentGroup)
    if (currentGroup) {
      applyGroupVisibilityToObject(currentGroup, groupVisibility)
    }
  }

  attachFrame(currentIndex)

  function resize() {
    const newWidth = container.clientWidth || window.innerWidth
    const newHeight = container.clientHeight || window.innerHeight
    camera.aspect = newWidth / newHeight
    camera.updateProjectionMatrix()
    renderer.setSize(newWidth, newHeight)
    controls.handleResize()
  }

  window.addEventListener('resize', resize)

  function focusAtPointer(event: MouseEvent | PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(pointer, camera)

    const intersects = raycaster.intersectObjects(scene.children, true)
    if (intersects.length === 0) return

    const hitPoint = intersects[0].point
    startFocusAnimation(hitPoint)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return // left button only
    pointerDown = true
    pointerDownX = event.clientX
    pointerDownY = event.clientY
  }

  function onPointerUp(event: PointerEvent) {
    if (!pointerDown || event.button !== 0) return
    pointerDown = false

    const dx = event.clientX - pointerDownX
    const dy = event.clientY - pointerDownY
    if (dx * dx + dy * dy > CLICK_THRESHOLD * CLICK_THRESHOLD) {
      // Treat as drag, not click
      return
    }

    // Small movement: treat as click and re-center
    focusAtPointer(event)
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)

  let frameId: number
  function animate(time?: number) {
    frameId = requestAnimationFrame(animate)

    const now = time ?? performance.now()

    if (isFocusing) {
      const elapsed = (now - focusStartTime) / 1000.0
      const t = Math.min(Math.max(elapsed / focusDuration, 0), 1)

      // Interpolate camera position and controls.target
      camera.position.lerpVectors(focusStartCamPos, focusEndCamPos, t)
      controls.target.lerpVectors(focusStartTarget, focusEndTarget, t)

      if (t >= 1) {
        isFocusing = false
      }
    }

    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  return {
    setFrame(index: number) {
      if (index < 0 || index >= frameGroups.length) return
      currentIndex = index
      attachFrame(currentIndex)
    },

    setGroupVisibility(groupId: string, visible: boolean) {
      groupVisibility[groupId] = visible
      for (const fg of frameGroups) {
        applyGroupVisibilityToObject(fg, groupVisibility)
      }
    },

    getGroups() {
      return groups
    },

    setBackground(color: THREE.ColorRepresentation) {   // <-- NEW
      setBackground(color)
    },

    getFrameCount() {
      return frameGroups.length
    },

    dispose() {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.dispose()
      if (currentGroup) {
        scene.remove(currentGroup)
      }
      container.removeChild(renderer.domElement)
    },
  }
}
