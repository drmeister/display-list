import './style.css'
import { initViewer } from './viewer'
import { demoDisplayList, type DisplayList } from './display-list'
import {
  loadDisplayListFromFile,
  loadDisplayListFromUrl,
} from './loader'
import type { Viewer } from './viewer'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('No #app element found in index.html')
}

// Top-level layout: controls + viewer
const controls = document.createElement('div')
controls.id = 'controls'

const viewerDiv = document.createElement('div')
viewerDiv.id = 'viewer'

app.appendChild(controls)
app.appendChild(viewerDiv)

// Sub-containers inside controls:
// - ioControls: open file / drag-drop / URL info
// - dataControls: group toggles + frame controls for the current DisplayList
const ioControls = document.createElement('div')
const dataControls = document.createElement('div')
dataControls.style.marginTop = '4px'

controls.appendChild(ioControls)
controls.appendChild(dataControls)

let currentViewer: Viewer | null = null
let bgColorInput: HTMLInputElement | null = null

function clearViewer() {
  if (currentViewer) {
    currentViewer.dispose()
    currentViewer = null
  }
  // Clear viewer div content
  while (viewerDiv.firstChild) {
    viewerDiv.removeChild(viewerDiv.firstChild)
  }
  // Clear data controls (but leave ioControls)
  while (dataControls.firstChild) {
    dataControls.removeChild(dataControls.firstChild)
  }
}

// Build group + frame controls for a given DisplayList and initialize viewer
function setupForDisplayList(displayList: DisplayList) {
  clearViewer()

  // Initialize viewer for this display list
  currentViewer = initViewer(viewerDiv, displayList)

  // Apply current background color (if user already picked one)
  if (bgColorInput && currentViewer) {
    currentViewer.setBackground(bgColorInput.value)
  }

  // --- overlay div for per-frame text annotations ---
  const frameTextDiv = document.createElement('div')
  frameTextDiv.id = 'frame-text'
  viewerDiv.appendChild(frameTextDiv)

  let textVisible = true

  // ----- Group toggle buttons -----
  const groups = currentViewer.getGroups()
  const visibilityState: Record<string, boolean> = {}
  for (const g of groups) visibilityState[g.id] = true

  const groupContainer = document.createElement('div')

  for (const group of groups) {
    const button = document.createElement('button')
    button.textContent = group.label

    button.addEventListener('click', () => {
      const current = visibilityState[group.id]
      const next = !current
      visibilityState[group.id] = next
      currentViewer!.setGroupVisibility(group.id, next)
      if (!next) {
        button.classList.add('off')
} else {
        button.classList.remove('off')
      }
    })

    groupContainer.appendChild(button)
  }

  dataControls.appendChild(groupContainer)

  // ----- Frame controls -----

  const frameControls = document.createElement('div')
  frameControls.style.marginTop = '4px'

  const frameCount = currentViewer.getFrameCount()
  let currentFrame = 0

  // Play / Pause
  const playButton = document.createElement('button')
  playButton.textContent = 'Play'

  // Step backward / forward
  const stepBackButton = document.createElement('button')
  stepBackButton.textContent = '<<'

  const stepForwardButton = document.createElement('button')
  stepForwardButton.textContent = '>>'

  // Frame slider
  const frameSlider = document.createElement('input')
  frameSlider.type = 'range'
  frameSlider.min = '0'
  frameSlider.max = frameCount > 0 ? String(frameCount - 1) : '0'
  frameSlider.value = '0'
  frameSlider.step = '1'
  frameSlider.style.width = '200px'
  frameSlider.style.marginLeft = '8px'

  // Frame label
  const frameLabel = document.createElement('span')
  frameLabel.style.marginLeft = '8px'
  frameLabel.textContent = `Frame: 0 / ${Math.max(frameCount - 1, 0)}`

  // Jump to frame N
  const jumpInput = document.createElement('input')
  jumpInput.type = 'number'
  jumpInput.min = '0'
  jumpInput.max = frameCount > 0 ? String(frameCount - 1) : '0'
  jumpInput.value = '0'
  jumpInput.style.width = '60px'
  jumpInput.style.marginLeft = '8px'

  const jumpButton = document.createElement('button')
  jumpButton.textContent = 'Go'

  // Playback speed (fps)
  const speedLabel = document.createElement('span')
  speedLabel.style.marginLeft = '8px'
  speedLabel.textContent = 'Speed:'

  const speedSelect = document.createElement('select')
  speedSelect.style.marginLeft = '4px'
  ;[5, 10, 30, 60].forEach((fps) => {
    const opt = document.createElement('option')
    opt.value = String(fps)
    opt.textContent = `${fps} fps`
    if (fps === 30) opt.selected = true
    speedSelect.appendChild(opt)
})

  // Loop mode: wrap, ping-pong, stop
  const loopLabel = document.createElement('span')
  loopLabel.style.marginLeft = '8px'
  loopLabel.textContent = 'Loop:'

  const loopSelect = document.createElement('select')
  loopSelect.style.marginLeft = '4px'
  ;[
    { value: 'wrap', label: 'Wrap' },
    { value: 'pingpong', label: 'Ping-pong' },
    { value: 'stop', label: 'Stop at end' },
  ].forEach((mode) => {
    const opt = document.createElement('option')
    opt.value = mode.value
    opt.textContent = mode.label
    if (mode.value === 'wrap') opt.selected = true
    loopSelect.appendChild(opt)
})

  // Text on/off button
  const textButton = document.createElement('button')
  textButton.textContent = 'Text on'

  // ----- Playback + annotation logic -----

  let isPlaying = false
  let animId: number | null = null
  let direction = 1 // +1 forward, -1 backward for ping-pong

  function getFps(): number {
    const v = parseInt(speedSelect.value, 10)
    return Number.isFinite(v) && v > 0 ? v : 30
  }

  function getFrameDuration(): number {
    return 1000 / getFps()
  }

  function getLoopMode(): 'wrap' | 'pingpong' | 'stop' {
    const v = loopSelect.value
    if (v === 'pingpong' || v === 'stop') return v
    return 'wrap'
  }

  function clampFrame(idx: number): number {
    if (frameCount <= 0) return 0
    if (idx < 0) return 0
    if (idx >= frameCount) return frameCount - 1
    return idx
  }

  function refreshFrameText() {
    const frame = displayList.frames[currentFrame]
    const text = frame && frame.annotation

    if (!textVisible || !text || text.trim() === '') {
      frameTextDiv.style.display = 'none'
      frameTextDiv.textContent = ''
    } else {
      frameTextDiv.style.display = 'block'
      frameTextDiv.textContent = text
    }
  }

  function applyFrame(idx: number) {
    currentFrame = clampFrame(idx)
    currentViewer!.setFrame(currentFrame)
    frameSlider.value = String(currentFrame)
    frameLabel.textContent = `Frame: ${currentFrame} / ${Math.max(
      frameCount - 1,
      0,
    )}`
    jumpInput.value = String(currentFrame)
    refreshFrameText()
  }

  function stopPlayback() {
    isPlaying = false
    playButton.textContent = 'Play'
    if (animId !== null) {
      cancelAnimationFrame(animId)
      animId = null
    }
  }

  function startPlayback() {
    if (frameCount <= 0) return
    isPlaying = true
    playButton.textContent = 'Pause'
    let lastTime = performance.now()
    direction = 1

    const step = (time: number) => {
      if (!isPlaying) return
      const frameDuration = getFrameDuration()
      if (time - lastTime >= frameDuration) {
        const mode = getLoopMode()
        let next = currentFrame + direction

        if (mode === 'wrap') {
          if (next >= frameCount) next = 0
          if (next < 0) next = frameCount - 1
} else if (mode === 'pingpong') {
          if (next >= frameCount) {
            direction = -1
            next = frameCount - 2 >= 0 ? frameCount - 2 : 0
          } else if (next < 0) {
            direction = 1
            next = frameCount > 1 ? 1 : 0
          }
        } else if (mode === 'stop') {
          if (next >= frameCount) {
            applyFrame(frameCount - 1)
            stopPlayback()
            return
          }
          if (next < 0) {
            applyFrame(0)
            stopPlayback()
            return
          }
        }

        applyFrame(next)
        lastTime = time
      }
      animId = requestAnimationFrame(step)
    }

    animId = requestAnimationFrame(step)
  }

  // Wire up controls

  frameSlider.addEventListener('input', () => {
    const idx = parseInt(frameSlider.value, 10) || 0
    applyFrame(idx)
  })

  playButton.addEventListener('click', () => {
    if (isPlaying) {
      stopPlayback()
} else {
      startPlayback()
    }
  })

  stepBackButton.addEventListener('click', () => {
    stopPlayback()
    applyFrame(currentFrame - 1)
  })

  stepForwardButton.addEventListener('click', () => {
    stopPlayback()
    applyFrame(currentFrame + 1)
  })

  jumpButton.addEventListener('click', () => {
    const idx = parseInt(jumpInput.value, 10)
    if (!Number.isFinite(idx)) return
    stopPlayback()
    applyFrame(idx)
  })

  textButton.addEventListener('click', () => {
    textVisible = !textVisible
    if (!textVisible) {
      textButton.classList.add('off')
      textButton.textContent = 'Text off'
} else {
      textButton.classList.remove('off')
      textButton.textContent = 'Text on'
    }
    refreshFrameText()
  })

  // Initial frame
  applyFrame(0)

  frameControls.appendChild(playButton)
  frameControls.appendChild(stepBackButton)
  frameControls.appendChild(stepForwardButton)
  frameControls.appendChild(frameSlider)
  frameControls.appendChild(frameLabel)
  frameControls.appendChild(jumpInput)
  frameControls.appendChild(jumpButton)
  frameControls.appendChild(speedLabel)
  frameControls.appendChild(speedSelect)
  frameControls.appendChild(loopLabel)
  frameControls.appendChild(loopSelect)
  frameControls.appendChild(textButton)

  dataControls.appendChild(frameControls)
}

// ----- IO controls: local file + drag-and-drop -----

// "Open file..." (local DisplayList JSON)
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.accept = '.json'
fileInput.style.display = 'none'

const openFileButton = document.createElement('button')
openFileButton.textContent = 'Open file...'

openFileButton.addEventListener('click', () => {
  fileInput.click()
})

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0]
  if (!file) return
  try {
    const dl = await loadDisplayListFromFile(file)
    setupForDisplayList(dl)
} catch (err) {
    console.error(err)
    alert(`Failed to load display list from file: ${String(err)}`)
  }
})

// Drag-and-drop onto viewer
viewerDiv.addEventListener('dragover', (event) => {
  event.preventDefault()
})

viewerDiv.addEventListener('drop', async (event) => {
  event.preventDefault()
  const dt = event.dataTransfer
  if (!dt || !dt.files || dt.files.length === 0) return
  const file = dt.files[0]
  try {
    const dl = await loadDisplayListFromFile(file)
    setupForDisplayList(dl)
} catch (err) {
    console.error(err)
    alert(`Failed to load display list from dropped file: ${String(err)}`)
  }
})

ioControls.appendChild(openFileButton)
ioControls.appendChild(fileInput)

const hint = document.createElement('span')
hint.style.marginLeft = '8px'
hint.textContent =
  'Drop a DisplayList JSON file here, or use ?displayList=/path/to/display-list.json in the URL.'
ioControls.appendChild(hint)

// --- Background color controls ---
// Create the color input once and reuse it across DisplayLists
bgColorInput = document.createElement('input')
bgColorInput.type = 'color'
bgColorInput.value = '#000000'  // default black
bgColorInput.style.marginLeft = '12px'

bgColorInput.addEventListener('input', () => {
  if (!currentViewer) return
  currentViewer.setBackground(bgColorInput!.value)
})

const bgLabel = document.createElement('span')
bgLabel.style.marginLeft = '8px'
bgLabel.textContent = 'Background:'

const bgBlackBtn = document.createElement('button')
bgBlackBtn.textContent = 'Black'
bgBlackBtn.addEventListener('click', () => {
  if (!currentViewer || !bgColorInput) return
  bgColorInput.value = '#000000'
  currentViewer.setBackground('#000000')
})

const bgWhiteBtn = document.createElement('button')
bgWhiteBtn.textContent = 'White'
bgWhiteBtn.style.marginLeft = '4px'
bgWhiteBtn.addEventListener('click', () => {
  if (!currentViewer || !bgColorInput) return
  bgColorInput.value = '#ffffff'
  currentViewer.setBackground('#ffffff')
})

// Attach to IO controls
ioControls.appendChild(bgLabel)
ioControls.appendChild(bgBlackBtn)
ioControls.appendChild(bgWhiteBtn)
ioControls.appendChild(bgColorInput)














// ----- Bootstrap: displayList URL or demo -----

async function bootstrap() {
  const params = new URLSearchParams(window.location.search)
  const displayListUrl = params.get('displayList')
  const manifestUrl = params.get('manifest') // kept for backward compatibility

  // Prefer explicit displayList= if present; fall back to manifest=
  const url = displayListUrl || manifestUrl

  if (url) {
    try {
      const dl = await loadDisplayListFromUrl(url)
      setupForDisplayList(dl)
      return
    } catch (err) {
      console.error(err)
      alert(
        `Failed to load display list from URL: ${String(
          err,
        )}. Falling back to demo.`,
      )
    }
  }

  // Fallback: built-in demo
  setupForDisplayList(demoDisplayList)
}

bootstrap().catch((err) => {
  console.error(err)
  alert(`Fatal error during startup: ${String(err)}`)
})
