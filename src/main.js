import * as THREE from 'three'
import './style.css'

const canvas = document.querySelector('#scene')
const ui = {
  hud: document.querySelector('#hud'),
  score: document.querySelector('#score'),
  shards: document.querySelector('#shards'),
  best: document.querySelector('#best'),
  menuBest: document.querySelector('#menuBest'),
  finalScore: document.querySelector('#finalScore'),
  finalShards: document.querySelector('#finalShards'),
  finalBest: document.querySelector('#finalBest'),
  startOverlay: document.querySelector('#startOverlay'),
  pauseOverlay: document.querySelector('#pauseOverlay'),
  overOverlay: document.querySelector('#overOverlay'),
  play: document.querySelector('#play-button'),
  resume: document.querySelector('#resume-button'),
  replay: document.querySelector('#replay-button'),
  pause: document.querySelector('#pause'),
  speedWrap: document.querySelector('#speedWrap'),
  speedFill: document.querySelector('#speedFill'),
  speedLabel: document.querySelector('#speedLabel'),
  hint: document.querySelector('#controlHint'),
  rotateNote: document.querySelector('#rotateNote'),
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
const isCoarse = window.matchMedia('(pointer: coarse)').matches
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const MAX_DPR = isCoarse ? 1.75 : 2
const TRACK_HALF = 4.25
const START_SPEED = 26
const SPAWN_Z = -175
const DESPAWN_Z = 16

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x170a2e, 70, 230)

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600)
camera.position.set(0, 4.8, 9.6)
camera.lookAt(0, 1.2, -18)

function makeGradientTexture(stops, width = 16, height = 512) {
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height
  const ctx = surface.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeGlowTexture() {
  const size = 128
  const surface = document.createElement('canvas')
  surface.width = surface.height = size
  const ctx = surface.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.65)')
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.14)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const glowTexture = makeGlowTexture()

scene.background = makeGradientTexture([
  [0, '#04010c'],
  [0.32, '#150629'],
  [0.5, '#3d0e52'],
  [0.6, '#a0216b'],
  [0.68, '#2c0b40'],
  [1, '#08030f'],
])

const hemi = new THREE.HemisphereLight(0x9b7bff, 0x150820, 1.35)
scene.add(hemi)
const keyLight = new THREE.DirectionalLight(0xff5fa2, 2.1)
keyLight.position.set(8, 14, 6)
scene.add(keyLight)
const rimLight = new THREE.DirectionalLight(0x3ce7ff, 1.5)
rimLight.position.set(-9, 6, -12)
scene.add(rimLight)

const starsGeometry = new THREE.BufferGeometry()
const starCount = isCoarse ? 650 : 1200
const starPositions = new Float32Array(starCount * 3)
for (let i = 0; i < starCount; i += 1) {
  const radius = 140 + Math.random() * 180
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(Math.random() * 0.9 + 0.05)
  starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
  starPositions[i * 3 + 1] = Math.cos(phi) * radius * 0.7 + 24
  starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
const stars = new THREE.Points(
  starsGeometry,
  new THREE.PointsMaterial({
    color: 0xd9d2ff,
    size: 1.35,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  }),
)
scene.add(stars)

const sunCanvas = document.createElement('canvas')
sunCanvas.width = sunCanvas.height = 256
{
  const ctx = sunCanvas.getContext('2d')
  const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 128)
  gradient.addColorStop(0, '#fff6c9')
  gradient.addColorStop(0.38, '#ffd166')
  gradient.addColorStop(0.72, '#ff5c9d')
  gradient.addColorStop(1, 'rgba(255,61,154,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(128, 128, 126, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  for (let y = 142; y < 244; y += 14) {
    const thickness = 2 + (y - 142) * 0.045
    ctx.fillRect(0, y, 256, thickness)
  }
}
const sunTexture = new THREE.CanvasTexture(sunCanvas)
sunTexture.colorSpace = THREE.SRGBColorSpace
const sun = new THREE.Mesh(
  new THREE.PlaneGeometry(58, 58),
  new THREE.MeshBasicMaterial({
    map: sunTexture,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }),
)
sun.position.set(-6, 24, -224)
scene.add(sun)
const sunHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff4f9d,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }),
)
sunHalo.position.copy(sun.position)
sunHalo.scale.set(118, 118, 1)
scene.add(sunHalo)

const skyline = new THREE.Group()
const towerMaterial = new THREE.MeshBasicMaterial({ color: 0x160a2c, fog: true })
const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x5ce9ff, transparent: true, opacity: 0.55, fog: true })
for (let i = 0; i < 34; i += 1) {
  const width = 4 + Math.random() * 9
  const height = 6 + Math.random() * 30
  const depth = 4 + Math.random() * 6
  const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), towerMaterial)
  tower.position.set(-150 + i * 9 + Math.random() * 4, height / 2 - 2, -252 - Math.random() * 24)
  skyline.add(tower)
  if (i % 2 === 0) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, height * 0.55, 0.22), windowMaterial)
    strip.position.set(tower.position.x + width * 0.22, height * 0.5, tower.position.z + depth / 2 + 0.03)
    skyline.add(strip)
  }
}
scene.add(skyline)

const floorBase = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 440),
  new THREE.MeshBasicMaterial({ color: 0x070213 }),
)
floorBase.rotation.x = -Math.PI / 2
floorBase.position.set(0, -0.02, -180)
scene.add(floorBase)

function makeGridTexture() {
  const size = 512
  const surface = document.createElement('canvas')
  surface.width = surface.height = size
  const ctx = surface.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  const cell = size / 8
  ctx.lineWidth = 3
  for (let i = 0; i <= 8; i += 1) {
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,61,154,0.9)' : 'rgba(78,242,255,0.62)'
    ctx.beginPath()
    ctx.moveTo(i * cell, 0)
    ctx.lineTo(i * cell, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * cell)
    ctx.lineTo(size, i * cell)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(surface)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(14, 110)
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const gridTexture = makeGridTexture()
const grid = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 440),
  new THREE.MeshBasicMaterial({
    map: gridTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
)
grid.rotation.x = -Math.PI / 2
grid.position.set(0, 0.015, -180)
scene.add(grid)

const railGroup = new THREE.Group()
const railMaterial = new THREE.MeshBasicMaterial({
  color: 0x3ff3ff,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const railAccent = new THREE.MeshBasicMaterial({
  color: 0xff3d9a,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const railSegments = []
const railLength = 216
for (const side of [-1, 1]) {
  for (let i = 0; i < 36; i += 1) {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.9), railMaterial)
    segment.position.set(side * 7.4, 0.07, 12 - i * 6)
    railGroup.add(segment)
    railSegments.push(segment)
    if (i % 3 === 0) {
      const accent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 1.4), railAccent)
      accent.position.set(side * 7.4, 0.04, 12 - i * 6)
      railGroup.add(accent)
      railSegments.push(accent)
    }
  }
}
scene.add(railGroup)

const pylonGroup = new THREE.Group()
const pylonBody = new THREE.MeshStandardMaterial({ color: 0x120827, roughness: 0.5, metalness: 0.7 })
const pylonGlow = new THREE.MeshBasicMaterial({
  color: 0x7b5cff,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const pylons = []
for (let i = 0; i < 22; i += 1) {
  const side = i % 2 === 0 ? -1 : 1
  const height = 3 + Math.random() * 9
  const pylon = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, height, 0.9), pylonBody)
  body.position.y = height / 2
  pylon.add(body)
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, height * 0.8, 0.95), pylonGlow)
  strip.position.set(side * 0.42, height * 0.5, 0)
  pylon.add(strip)
  pylon.position.set(side * (9 + Math.random() * 5), 0, 10 - i * 11 - Math.random() * 4)
  pylonGroup.add(pylon)
  pylons.push(pylon)
}
scene.add(pylonGroup)

const shardGroup = new THREE.Group()
const shardMaterial = new THREE.MeshStandardMaterial({
  color: 0x1d0f38,
  emissive: 0x5c2aff,
  emissiveIntensity: 0.35,
  roughness: 0.35,
  metalness: 0.8,
})
const shards = []
for (let i = 0; i < 18; i += 1) {
  const side = i % 2 === 0 ? -1 : 1
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + Math.random() * 1.7, 0), shardMaterial)
  mesh.position.set(side * (7.8 + Math.random() * 8), 1.5 + Math.random() * 9, 8 - i * 12)
  mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
  mesh.userData.spin = new THREE.Vector3(
    (Math.random() - 0.5) * 0.35,
    (Math.random() - 0.5) * 0.35,
    (Math.random() - 0.5) * 0.35,
  )
  shardGroup.add(mesh)
  shards.push(mesh)
}
scene.add(shardGroup)

function buildShip() {
  const ship = new THREE.Group()

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ef2ff,
    emissive: 0x0b6f8a,
    emissiveIntensity: 1.1,
    metalness: 0.7,
    roughness: 0.22,
  })
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x140a2c,
    emissive: 0x2a1060,
    emissiveIntensity: 0.6,
    metalness: 0.85,
    roughness: 0.3,
  })
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0518,
    emissive: 0x7b3cff,
    emissiveIntensity: 0.9,
    metalness: 0.9,
    roughness: 0.12,
  })
  const engineMaterial = new THREE.MeshBasicMaterial({ color: 0xff67b5 })
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xa8fbff, transparent: true, opacity: 0.9 })

  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 4), hullMaterial)
  hull.rotation.x = -Math.PI / 2
  hull.rotation.z = Math.PI / 4
  hull.scale.set(1, 1, 0.7)
  ship.add(hull)

  const hullEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hull.geometry), edgeMaterial)
  hullEdges.rotation.copy(hull.rotation)
  hullEdges.scale.copy(hull.scale).multiplyScalar(1.02)
  ship.add(hullEdges)

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), glassMaterial)
  cockpit.scale.set(0.9, 0.62, 1.5)
  cockpit.position.set(0, 0.2, -0.18)
  ship.add(cockpit)

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.72), darkMaterial)
    wing.position.set(side * 0.82, -0.02, 0.22)
    wing.rotation.y = side * -0.34
    wing.rotation.z = side * 0.1
    ship.add(wing)

    const wingEdge = new THREE.LineSegments(new THREE.EdgesGeometry(wing.geometry), edgeMaterial)
    wingEdge.position.copy(wing.position)
    wingEdge.rotation.copy(wing.rotation)
    ship.add(wingEdge)

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), engineMaterial)
    tip.position.set(side * 1.52, 0.02, 0.42)
    ship.add(tip)
  }

  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.29, 0.72, 10), darkMaterial)
  engine.rotation.x = Math.PI / 2
  engine.position.set(0, 0.02, 0.86)
  ship.add(engine)

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.74, 10), engineMaterial)
  core.rotation.x = Math.PI / 2
  core.position.set(0, 0.02, 0.9)
  ship.add(core)

  const engineGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff5fae,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  engineGlow.position.set(0, 0.02, 1.24)
  engineGlow.scale.set(1.7, 1.7, 1)
  ship.add(engineGlow)

  const groundGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x2de2ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  groundGlow.position.set(0, -1.05, 0.2)
  groundGlow.scale.set(4.6, 2.2, 1)
  ship.add(groundGlow)

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.5),
    new THREE.MeshBasicMaterial({ map: glowTexture, color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.03
  scene.add(shadow)
  ship.userData.shadow = shadow

  const engineLight = new THREE.PointLight(0xff3d9a, 6, 9, 2)
  engineLight.position.set(0, 0.2, 1.2)
  ship.add(engineLight)

  ship.position.set(0, 1.15, 0)
  return ship
}

const ship = buildShip()
scene.add(ship)

const trailCount = 70
const trailPositions = new Float32Array(trailCount * 3)
const trailColors = new Float32Array(trailCount * 3)
const trailGeometry = new THREE.BufferGeometry()
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
const trail = new THREE.Points(
  trailGeometry,
  new THREE.PointsMaterial({
    map: glowTexture,
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
)
trail.frustumCulled = false
scene.add(trail)
const trailHistory = Array.from({ length: trailCount }, () => new THREE.Vector3(0, 1.15, 1.2))

const burstCount = 180
const burstPositions = new Float32Array(burstCount * 3)
const burstColors = new Float32Array(burstCount * 3)
const burstVelocity = Array.from({ length: burstCount }, () => new THREE.Vector3())
const burstLife = new Float32Array(burstCount)
const burstGeometry = new THREE.BufferGeometry()
burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3))
burstGeometry.setAttribute('color', new THREE.BufferAttribute(burstColors, 3))
const burst = new THREE.Points(
  burstGeometry,
  new THREE.PointsMaterial({
    map: glowTexture,
    size: 0.6,
    sizeAttenuation: true,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
)
burst.frustumCulled = false
scene.add(burst)
for (let i = 0; i < burstCount; i += 1) burstPositions[i * 3 + 1] = -999

function emitBurst(origin, color, count = 46, power = 9) {
  const tint = new THREE.Color(color)
  let emitted = 0
  for (let i = 0; i < burstCount && emitted < count; i += 1) {
    if (burstLife[i] > 0) continue
    emitted += 1
    burstLife[i] = 0.6 + Math.random() * 0.7
    burstPositions[i * 3] = origin.x + (Math.random() - 0.5) * 0.5
    burstPositions[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.5
    burstPositions[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.5
    burstVelocity[i].set(
      (Math.random() - 0.5) * power,
      Math.random() * power * 0.75 + 1,
      (Math.random() - 0.5) * power,
    )
    burstColors[i * 3] = tint.r
    burstColors[i * 3 + 1] = tint.g
    burstColors[i * 3 + 2] = tint.b
  }
  burstGeometry.attributes.position.needsUpdate = true
  burstGeometry.attributes.color.needsUpdate = true
}

const obstacleGeometry = new THREE.BoxGeometry(2.0, 1.25, 0.6)
const obstacleMaterial = new THREE.MeshStandardMaterial({
  color: 0x1c0b31,
  emissive: 0xff2d7a,
  emissiveIntensity: 0.4,
  metalness: 0.7,
  roughness: 0.35,
})
const obstacleEdgeGeometry = new THREE.EdgesGeometry(obstacleGeometry)
const obstacleEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xff6cb4, transparent: true, opacity: 0.95 })
const obstacleBeaconGeometry = new THREE.SphereGeometry(0.11, 8, 8)
const obstacleBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffd166 })

function makeObstacle() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(obstacleGeometry, obstacleMaterial)
  group.add(body)
  group.add(new THREE.LineSegments(obstacleEdgeGeometry, obstacleEdgeMaterial))
  const beacon = new THREE.Mesh(obstacleBeaconGeometry, obstacleBeaconMaterial)
  beacon.position.set(0, 0.74, 0)
  group.add(beacon)
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff2d7a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo.position.set(0, 0, -0.35)
  halo.scale.set(4.2, 2.4, 1)
  group.add(halo)
  return group
}

const orbGeometry = new THREE.OctahedronGeometry(0.36, 0)
const orbMaterial = new THREE.MeshStandardMaterial({
  color: 0x9ffcff,
  emissive: 0x2de2ff,
  emissiveIntensity: 2.2,
  metalness: 0.5,
  roughness: 0.15,
})
const orbHaloMaterial = new THREE.SpriteMaterial({
  map: glowTexture,
  color: 0x4ef2ff,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

function makeOrb() {
  const group = new THREE.Group()
  const core = new THREE.Mesh(orbGeometry, orbMaterial)
  group.add(core)
  const halo = new THREE.Sprite(orbHaloMaterial)
  halo.scale.set(1.9, 1.9, 1)
  group.add(halo)
  group.userData.core = core
  return group
}

const obstacles = []
const orbs = []

function addObstacle(lane, z) {
  const obstacle = makeObstacle()
  obstacle.position.set(lane, 0.7, z)
  scene.add(obstacle)
  obstacles.push(obstacle)
}

function addOrb(lane, z) {
  const orb = makeOrb()
  orb.position.set(lane, 1.15, z)
  scene.add(orb)
  orbs.push(orb)
}

function clearCourse() {
  for (const obstacle of obstacles) scene.remove(obstacle)
  obstacles.length = 0
  for (const orb of orbs) scene.remove(orb)
  orbs.length = 0
}

const LANES = [-2.7, 0, 2.7]
const game = {
  mode: 'menu',
  elapsed: 0,
  distance: 0,
  speed: START_SPEED,
  shards: 0,
  score: 0,
  best: Number(window.localStorage.getItem('neon-drift-best') || 0),
  targetX: 0,
  spawnTimer: 2.4,
  orbTimer: 2.2,
  shake: 0,
  hintTimer: 0,
  lastHud: '',
}

ui.best.textContent = game.best.toLocaleString('en-US')
ui.menuBest.textContent = game.best.toLocaleString('en-US')

const keys = { left: false, right: false }
let pointerActive = false
let pointerX = 0

function setMode(mode) {
  game.mode = mode
  document.body.dataset.state = mode
  const inRun = mode === 'playing' || mode === 'paused'
  ui.hud.classList.toggle('is-hidden', !inRun)
  ui.speedWrap.classList.toggle('is-hidden', !inRun)
  ui.pauseOverlay.hidden = mode !== 'paused'
  ui.overOverlay.hidden = mode !== 'over'
  updateRotateNote()
}

function resetRun() {
  clearCourse()
  game.elapsed = 0
  game.distance = 0
  game.speed = START_SPEED
  game.shards = 0
  game.score = 0
  game.targetX = 0
  game.spawnTimer = 1.6
  game.orbTimer = 3.2
  game.shake = 0
  game.hintTimer = 6
  ship.position.set(0, 1.15, 0)
  ship.rotation.set(0, 0, 0)
  ship.userData.shadow.visible = true
  camera.position.set(0, 4.85, 9.6)
  camera.fov = 62
  camera.updateProjectionMatrix()
  ui.hint.classList.remove('is-faded')
  ui.score.textContent = '0'
  ui.shards.textContent = '0'
  ui.speedFill.style.width = '8%'
  ui.speedLabel.textContent = '1.0x'
  for (let i = 0; i < trailCount; i += 1) trailHistory[i].set(0, 1.15, 1.2)
  addObstacle(LANES[1], -58)
  addObstacle(LANES[0], -102)
  addObstacle(LANES[2], -150)
  for (let i = 0; i < 6; i += 1) addOrb(LANES[2], -32 - i * 2.6)
  for (let i = 0; i < 4; i += 1) addOrb(LANES[1], -78 - i * 2.4)
}

function startRun() {
  resetRun()
  setMode('playing')
  ui.startOverlay.classList.add('is-hidden')
}

function crash() {
  if (game.mode !== 'playing') return
  setMode('over')
  game.shake = 0.5
  emitBurst(ship.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xff3d9a, 90, 14)
  emitBurst(ship.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xffd166, 34, 9)
  ship.userData.shadow.visible = false
  if (game.score > game.best) {
    game.best = game.score
    window.localStorage.setItem('neon-drift-best', String(game.best))
  }
  ui.finalScore.textContent = game.score.toLocaleString('en-US')
  ui.finalShards.textContent = String(game.shards)
  ui.finalBest.textContent = game.best.toLocaleString('en-US')
  ui.best.textContent = game.best.toLocaleString('en-US')
  ui.menuBest.textContent = game.best.toLocaleString('en-US')
}

function togglePause() {
  if (game.mode === 'playing') setMode('paused')
  else if (game.mode === 'paused') setMode('playing')
}

ui.play.addEventListener('click', startRun)
ui.replay.addEventListener('click', startRun)
ui.resume.addEventListener('click', togglePause)
ui.pause.addEventListener('click', togglePause)

window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    keys.left = true
    event.preventDefault()
  }
  if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    keys.right = true
    event.preventDefault()
  }
  if (event.code === 'Space') {
    event.preventDefault()
    togglePause()
  }
  if (event.code === 'Enter' && (game.mode === 'menu' || game.mode === 'over')) startRun()
})

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false
  if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false
})

canvas.addEventListener('pointerdown', (event) => {
  if (game.mode !== 'playing') return
  pointerActive = true
  pointerX = event.clientX
  canvas.setPointerCapture?.(event.pointerId)
})

canvas.addEventListener('pointermove', (event) => {
  if (!pointerActive || game.mode !== 'playing') return
  const delta = event.clientX - pointerX
  pointerX = event.clientX
  game.targetX = clamp(game.targetX + (delta / window.innerWidth) * 11, -TRACK_HALF, TRACK_HALF)
})

function releasePointer() {
  pointerActive = false
}
canvas.addEventListener('pointerup', releasePointer)
canvas.addEventListener('pointercancel', releasePointer)
canvas.addEventListener('pointerleave', releasePointer)

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') setMode('paused')
})

function updateShip(dt, time) {
  const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
  if (direction !== 0) game.targetX = clamp(game.targetX + direction * 7 * dt, -TRACK_HALF, TRACK_HALF)
  const previousX = ship.position.x
  ship.position.x = lerp(ship.position.x, game.targetX, Math.min(1, dt * 11))
  const velocityX = dt > 0 ? (ship.position.x - previousX) / dt : 0
  const roll = clamp(-velocityX * 0.045, -0.5, 0.5)
  ship.rotation.z = lerp(ship.rotation.z, roll, Math.min(1, dt * 7))
  ship.rotation.y = lerp(ship.rotation.y, roll * 0.5, Math.min(1, dt * 6))
  ship.rotation.x = lerp(ship.rotation.x, clamp(velocityX * 0.012, -0.12, 0.12), Math.min(1, dt * 6))
  ship.position.y = 1.15 + Math.sin(time * 3.1) * 0.055
  ship.userData.shadow.position.set(ship.position.x, 0.035, 0)
  ship.userData.shadow.material.opacity = 0.22 - Math.sin(time * 3.1) * 0.04
}

function updateTrail(dt) {
  const head = trailHistory[0]
  head.set(ship.position.x, ship.position.y + 0.02, 1.15 + ship.position.z)
  for (let i = trailCount - 1; i > 0; i -= 1) trailHistory[i].copy(trailHistory[i - 1])
  trailHistory[0].copy(head)
  for (let i = 0; i < trailCount; i += 1) {
    const point = trailHistory[i]
    trailPositions[i * 3] = point.x
    trailPositions[i * 3 + 1] = point.y
    trailPositions[i * 3 + 2] = point.z
    const fade = Math.pow(1 - i / trailCount, 1.7)
    trailColors[i * 3] = 0.35 * fade
    trailColors[i * 3 + 1] = 0.95 * fade
    trailColors[i * 3 + 2] = 1.0 * fade
  }
  trailGeometry.attributes.position.needsUpdate = true
  trailGeometry.attributes.color.needsUpdate = true
}

function updateBursts(dt) {
  let changed = false
  for (let i = 0; i < burstCount; i += 1) {
    if (burstLife[i] <= 0) continue
    changed = true
    burstLife[i] -= dt
    if (burstLife[i] <= 0) {
      burstPositions[i * 3 + 1] = -999
      continue
    }
    const velocity = burstVelocity[i]
    velocity.y -= 11 * dt
    burstPositions[i * 3] += velocity.x * dt
    burstPositions[i * 3 + 1] += velocity.y * dt
    burstPositions[i * 3 + 2] += velocity.z * dt
    const fade = Math.min(1, burstLife[i] * 2.4)
    burstColors[i * 3] *= 1 - dt * 0.9
    burstColors[i * 3 + 1] *= 1 - dt * 0.9
    burstColors[i * 3 + 2] *= 1 - dt * 0.9
    burstColors[i * 3] = Math.min(burstColors[i * 3], fade)
  }
  if (changed) {
    burstGeometry.attributes.position.needsUpdate = true
    burstGeometry.attributes.color.needsUpdate = true
  }
}

function updateEnvironment(dt, scrollSpeed) {
  gridTexture.offset.y -= scrollSpeed * dt * 0.031
  for (const segment of railSegments) {
    segment.position.z += scrollSpeed * dt
    if (segment.position.z > 15) segment.position.z -= railLength
  }
  for (const pylon of pylons) {
    pylon.position.z += scrollSpeed * dt
    if (pylon.position.z > 15) pylon.position.z -= 242
  }
  for (const shard of shards) {
    shard.position.z += scrollSpeed * dt
    shard.rotation.x += shard.userData.spin.x * dt
    shard.rotation.y += shard.userData.spin.y * dt
    shard.rotation.z += shard.userData.spin.z * dt
    if (shard.position.z > 15) shard.position.z -= 216
  }
  stars.rotation.y += dt * 0.006
  sunHalo.material.opacity = 0.46 + Math.sin(performance.now() * 0.001) * 0.05
}

function spawnCourse(dt) {
  game.spawnTimer -= dt
  if (game.spawnTimer <= 0) {
    const interval = Math.max(0.58, 1.35 - game.elapsed * 0.013)
    game.spawnTimer = interval + Math.random() * 0.35
    const lanes = [0, 1, 2]
    const first = Math.floor(Math.random() * 3)
    addObstacle(LANES[first], SPAWN_Z - Math.random() * 18)
    if (game.elapsed > 24 && Math.random() < 0.34) {
      const remaining = lanes.filter((lane) => lane !== first)
      const second = remaining[Math.floor(Math.random() * remaining.length)]
      addObstacle(LANES[second], SPAWN_Z - 12 - Math.random() * 20)
    }
  }
  game.orbTimer -= dt
  if (game.orbTimer <= 0) {
    game.orbTimer = 3.6 + Math.random() * 2.6
    const lane = LANES[Math.floor(Math.random() * LANES.length)]
    const startZ = SPAWN_Z + 20 - Math.random() * 40
    for (let i = 0; i < 5; i += 1) addOrb(lane, startZ - i * 2.7)
  }
}

function updateCourse(dt) {
  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = obstacles[i]
    obstacle.position.z += game.speed * dt
    obstacle.rotation.y = Math.sin(performance.now() * 0.002 + i) * 0.04
    if (obstacle.position.z > DESPAWN_Z) {
      scene.remove(obstacle)
      obstacles.splice(i, 1)
      continue
    }
    if (
      game.mode === 'playing'
      && Math.abs(obstacle.position.z - ship.position.z) < 1.0
      && Math.abs(obstacle.position.x - ship.position.x) < 1.35
    ) {
      crash()
    }
  }
  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const orb = orbs[i]
    orb.position.z += game.speed * dt
    orb.userData.core.rotation.x += dt * 2.4
    orb.userData.core.rotation.y += dt * 3.1
    orb.position.y = 1.15 + Math.sin(performance.now() * 0.003 + i) * 0.08
    if (orb.position.z > DESPAWN_Z) {
      scene.remove(orb)
      orbs.splice(i, 1)
      continue
    }
    if (
      game.mode === 'playing'
      && Math.abs(orb.position.z - ship.position.z) < 1.15
      && Math.abs(orb.position.x - ship.position.x) < 1.15
    ) {
      game.shards += 1
      emitBurst(orb.position.clone(), 0x4ef2ff, 18, 6)
      scene.remove(orb)
      orbs.splice(i, 1)
    }
  }
}

function updateHud() {
  const key = `${game.score}|${game.shards}|${Math.round(game.speed * 10)}`
  if (key === game.lastHud) return
  game.lastHud = key
  ui.score.textContent = game.score.toLocaleString('en-US')
  ui.shards.textContent = String(game.shards)
  const ratio = (game.speed - START_SPEED) / 26
  ui.speedFill.style.width = `${Math.min(100, 8 + ratio * 92)}%`
  ui.speedLabel.textContent = `${(game.speed / START_SPEED).toFixed(1)}x`
}

let lastTime = performance.now()
let fpsSample = 0
let fpsFrames = 0
let lowPower = false

function tick() {
  const now = performance.now()
  const rawDt = (now - lastTime) / 1000
  const dt = Math.min(rawDt || 0.016, 0.05)
  lastTime = now

  fpsSample += rawDt
  fpsFrames += 1
  if (fpsSample > 2.5) {
    const fps = fpsFrames / fpsSample
    if (fps < 38 && !lowPower) {
      lowPower = true
      renderer.setPixelRatio(1)
      renderer.setSize(window.innerWidth, window.innerHeight, false)
    }
    fpsSample = 0
    fpsFrames = 0
  }

  const time = now / 1000
  const playing = game.mode === 'playing'

  if (playing) {
    game.elapsed += dt
    game.speed = START_SPEED + Math.min(25, game.elapsed * 0.58)
    game.distance += game.speed * dt
    game.score = Math.floor(game.distance * 0.85) + game.shards * 25
    spawnCourse(dt)
    updateCourse(dt)
    if (game.hintTimer > 0) {
      game.hintTimer -= dt
      if (game.hintTimer <= 0) ui.hint.classList.add('is-faded')
    }
  } else if (game.mode === 'menu') {
    updateCourse(dt)
  } else if (game.mode === 'over') {
    updateCourse(dt)
  }

  if (playing) updateShip(dt, time)
  else {
    ship.position.y = 1.15 + Math.sin(time * 1.7) * 0.09
    ship.rotation.z = lerp(ship.rotation.z, Math.sin(time * 0.9) * 0.06, Math.min(1, dt * 3))
    ship.rotation.x = lerp(ship.rotation.x, 0, Math.min(1, dt * 3))
    ship.rotation.y = lerp(ship.rotation.y, Math.sin(time * 0.7) * 0.08, Math.min(1, dt * 3))
    ship.userData.shadow.position.set(ship.position.x, 0.035, 0)
  }

  updateTrail(dt)
  updateBursts(dt)
  updateEnvironment(dt, playing ? game.speed : game.mode === 'menu' ? 7 : 4)

  if (game.mode === 'menu') {
    camera.position.x = lerp(camera.position.x, Math.sin(time * 0.35) * 1.1, Math.min(1, dt * 2))
    camera.position.y = 4.9 + Math.sin(time * 0.5) * 0.12
    camera.position.z = 9.8
    camera.lookAt(Math.sin(time * 0.3) * 0.6, 1.4, -20)
  } else {
    if (game.shake > 0) {
      game.shake = Math.max(0, game.shake - dt * 1.6)
    }
    const shakeAmount = game.shake * game.shake * 0.9
    const targetX = ship.position.x * 0.42
    camera.position.x = lerp(camera.position.x, targetX, Math.min(1, dt * 4.5))
    camera.position.y = lerp(camera.position.y, 4.8 + ship.position.y * 0.06, Math.min(1, dt * 4))
    camera.position.z = 9.6
    camera.lookAt(ship.position.x * 0.3, 1.15, -17)
    if (shakeAmount > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmount
      camera.position.y += (Math.random() - 0.5) * shakeAmount
    }
    const targetFov = 62 + (game.speed - START_SPEED) * 0.32
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt * 2))
      camera.updateProjectionMatrix()
    }
  }

  if (playing) updateHud()
  renderer.render(scene, camera)
  const api = window.__NEON_DRIFT__
  if (api) {
    api.frames += 1
    api.mode = game.mode
    if (!api.ready) {
      api.ready = true
      document.body.dataset.ready = '1'
    }
  }
  requestAnimationFrame(tick)
}

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : MAX_DPR))
  renderer.setSize(width, height, false)
  updateRotateNote()
}

function updateRotateNote() {
  const portraitPhone = window.innerHeight > window.innerWidth && window.innerWidth < 720
  ui.rotateNote.classList.toggle('is-visible', portraitPhone && game.mode === 'menu')
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', () => setTimeout(resize, 150))

window.__NEON_DRIFT__ = {
  frames: 0,
  ready: false,
  mode: 'menu',
  snapshot: () => ({
    mode: game.mode,
    speed: game.speed,
    elapsed: game.elapsed,
    ship: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
    obstacles: obstacles.map((obstacle) => ({ x: obstacle.position.x, z: obstacle.position.z })),
    orbs: orbs.length,
  }),
}

resize()
setMode('menu')
if (reduceMotion) {
  renderer.setPixelRatio(1)
}
requestAnimationFrame(tick)
