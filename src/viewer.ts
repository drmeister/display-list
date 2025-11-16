// src/viewer.ts
import * as THREE from 'three'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
import type {
  DisplayList,
  Frame,
  Primitive,
  GroupDef,
} from './display-list'

export interface Viewer {
  setFrame(index: number): void
  setGroupVisibility(groupId: string, visible: boolean): void
  getGroups(): GroupDef[]
  getFrameCount(): number
  setBackground(color: THREE.ColorRepresentation): void
  dispose(): void
}

function makeThreeColor(color?: [number, number, number]): THREE.Color {
  if (!color) return new THREE.Color(1, 1, 1)
  return new THREE.Color(color[0], color[1], color[2])
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



function colorToThree(color?: [number, number, number]): THREE.Color {
  if (!color) return new THREE.Color(1, 1, 1)
  const [r, g, b] = color
  return new THREE.Color(r, g, b)
}

function buildPrimitiveObject(prim: Primitive): THREE.Object3D {
  switch (prim.kind) {
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
    group.add(obj)
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

  function onClick(event: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(coneObjects, true)
    if (intersects.length === 0) return

    const hit = intersects[0].object
    const tipArr = hit.userData?.tip as [number, number, number] | undefined
    if (!tipArr) return

    const tip = new THREE.Vector3(...tipArr)

    // preserve camera offset from target, move both to the cone tip
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
    controls.target.copy(tip)
    camera.position.copy(tip.clone().add(offset))
    controls.update()
  }

  renderer.domElement.addEventListener('click', onClick)

  let frameId: number
  function animate() {
    frameId = requestAnimationFrame(animate)
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
      renderer.domElement.removeEventListener('click', onClick)
      renderer.dispose()
      if (currentGroup) {
        scene.remove(currentGroup)
      }
      container.removeChild(renderer.domElement)
    },
  }
}
