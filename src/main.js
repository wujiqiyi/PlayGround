import * as THREE from 'three'
import './style.css'

const canvas = document.getElementById('game-canvas')
const startScreen = document.getElementById('start-screen')
const overScreen = document.getElementById('over-screen')
const startButton = document.getElementById('start-button')
const againButton = document.getElementById('again-button')
const muteButton = document.getElementById('mute')
const scoreEl = document.getElementById('score')
const comboEl = document.getElementById('combo')
const speedEl = document.getElementById('speed')
const shieldPips = [...document.querySelectorAll('#shield-pips i')]
const menuBestEl = document.getElementById('menu-best')
const finalScoreEl = document.getElementById('final-score')
const finalBestEl = document.getElementById('final-best')
const newBestEl = document.getElementById('new-best')
const flashEl = document.getElementById('flash')
const toastEl = document.getElementById('toast')
const hintEl = document.getElementById('hint')

const PLAY_HALF = 3.2
const SHIP_Z = 0
const ORB_COLOR = 0x39ecff
const GOLD_COLOR = 0xffd166
const DANGER_COLOR = 0xff3c9c
const LANES = [-2.75, -1.38, 0, 1.38, 2.75]

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.2

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x03050e)
scene.fog = new THREE.FogExp2(0x050a18, 0.0125)

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 260)
camera.position.set(0, 2.7, 10)

const state = {
  mode: 'menu',
  score: 0,
  best: 0,
  combo: 0,
  multiplier: 1,
  shield: 3,
  elapsed: 0,
  distance: 0,
  speed: 26,
  targetX: 0,
  x: 0,
  spawnTimer: 0.45,
  shake: 0,
  hitCooldown: 0
}

try {
  state.best = Number(window.localStorage.getItem('starlight-drift-best')) || 0
} catch {
  state.best = 0
}
menuBestEl.textContent = String(state.best)

function glowTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const glowTex = glowTexture()
const softGlowTex = glowTexture(256, [[0, 'rgba(255,255,255,0.85)'], [0.42, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']])

function gridTexture() {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(74, 235, 255, 0.55)'
  ctx.lineWidth = 2
  ctx.shadowColor = 'rgba(74, 235, 255, 0.9)'
  ctx.shadowBlur = 9
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255, 79, 216, 0.25)'
  ctx.lineWidth = 5
  ctx.shadowColor = 'rgba(255, 79, 216, 0.6)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(size, 0)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(c)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 26)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

scene.add(new THREE.HemisphereLight(0x9be8ff, 0x150a30, 1.25))

const keyLight = new THREE.DirectionalLight(0xc9f4ff, 2.4)
keyLight.position.set(-6, 10, 9)
scene.add(keyLight)

const rimLight = new THREE.DirectionalLight(0xff4fd8, 1.15)
rimLight.position.set(8, -2, -12)
scene.add(rimLight)

const backLight = new THREE.DirectionalLight(0x3a7dff, 1.5)
backLight.position.set(0, 4, -18)
scene.add(backLight)

function makeStars(count, size, opacity, radius, depth) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const color = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = radius * (0.25 + Math.random() * 0.75)
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = Math.sin(a) * r * 0.62 + 16
    positions[i * 3 + 2] = -depth * Math.random() - 8
    const hue = 0.52 + Math.random() * 0.22
    color.setHSL(hue, 0.55 + Math.random() * 0.35, 0.6 + Math.random() * 0.35)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size,
    map: glowTex,
    transparent: true,
    opacity,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return points
}

const starLayer = makeStars(900, 0.5, 0.85, 130, 160)
const starLayerFine = makeStars(1400, 0.2, 0.6, 150, 190)
scene.add(starLayer, starLayerFine)

const nebula = new THREE.Group()
const nebulaSpecs = [
  [0x3c2bff, 120, 34, -120, 0.2],
  [0xff3fbf, 95, 26, -95, 0.14],
  [0x1ad5ff, 150, 40, -145, 0.12],
  [0x6c3bff, 84, 18, -75, 0.13],
  [0xff7a3d, 60, 12, -110, 0.08]
]
for (const [color, scale, y, z, opacity] of nebulaSpecs) {
  const material = new THREE.SpriteMaterial({
    map: softGlowTex,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(scale, scale * 0.62, 1)
  sprite.position.set((Math.random() - 0.5) * 80, y, z)
  nebula.add(sprite)
}
scene.add(nebula)

const planet = new THREE.Group()
const planetBody = new THREE.Mesh(
  new THREE.SphereGeometry(9, 48, 32),
  new THREE.MeshStandardMaterial({
    color: 0x5b4297,
    emissive: 0x1b1245,
    emissiveIntensity: 0.9,
    roughness: 0.82,
    metalness: 0.12
  })
)
planet.add(planetBody)

const planetRing = new THREE.Mesh(
  new THREE.RingGeometry(12.2, 17.5, 96),
  new THREE.MeshBasicMaterial({
    color: 0x9878ff,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
)
planetRing.rotation.x = -1.22
planetRing.rotation.z = 0.18
planet.add(planetRing)

const planetHalo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: softGlowTex,
    color: 0x5536ff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
)
planetHalo.scale.set(46, 46, 1)
planet.add(planetHalo)
planet.position.set(-19, 13, -64)
scene.add(planet)

const moon = new THREE.Mesh(
  new THREE.IcosahedronGeometry(2.1, 2),
  new THREE.MeshStandardMaterial({ color: 0x8890b5, roughness: 1, metalness: 0.08, flatShading: true })
)
moon.position.set(17, 20, -72)
scene.add(moon)

const distantRocks = new THREE.Group()
const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2338, roughness: 0.96, metalness: 0.25, flatShading: true })
for (let i = 0; i < 16; i++) {
  const radius = 0.45 + Math.random() * 1.7
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), rockMaterial)
  rock.position.set((Math.random() - 0.5) * 44, -2 + Math.random() * 26, -34 - Math.random() * 105)
  rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
  distantRocks.add(rock)
}
scene.add(distantRocks)

const floorTexture = gridTexture()
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(58, 240),
  new THREE.MeshBasicMaterial({
    map: floorTexture,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
)
floor.rotation.x = -Math.PI / 2
floor.position.set(0, -2.8, -88)
scene.add(floor)

for (const [x, color] of [[-4.7, ORB_COLOR], [4.7, DANGER_COLOR]]) {
  const railGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 236),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  )
  railGlow.rotation.x = -Math.PI / 2
  railGlow.position.set(x, -2.78, -88)
  scene.add(railGlow)

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.02, 236),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
  )
  rail.position.set(x, -2.78, -88)
  scene.add(rail)
}

const rings = []
const ringGeometry = new THREE.TorusGeometry(4.35, 0.028, 6, 80)
const ringGlowGeometry = new THREE.TorusGeometry(4.35, 0.12, 4, 80)
for (let i = 0; i < 10; i++) {
  const color = i % 3 === 0 ? DANGER_COLOR : ORB_COLOR
  const group = new THREE.Group()
  const ring = new THREE.Mesh(
    ringGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  const halo = new THREE.Mesh(
    ringGlowGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  group.add(ring, halo)
  group.position.set(0, 2.35, 9 - i * 17.5)
  group.rotation.z = (i % 2 ? 1 : -1) * 0.04
  scene.add(group)
  rings.push(group)
}

function updateRingFade(ring) {
  const fade = THREE.MathUtils.clamp((8.8 - ring.position.z) / 4.2, 0, 1)
  ring.children[0].material.opacity = 0.62 * fade
  ring.children[1].material.opacity = 0.1 * fade
}

const beacons = []
const beaconGeometry = new THREE.OctahedronGeometry(0.22, 0)
const beaconMaterials = [
  new THREE.MeshBasicMaterial({ color: ORB_COLOR }),
  new THREE.MeshBasicMaterial({ color: DANGER_COLOR })
]
for (let i = 0; i < 10; i++) {
  const side = i % 2 ? 1 : -1
  const group = new THREE.Group()
  const core = new THREE.Mesh(beaconGeometry, beaconMaterials[i % 3 === 0 ? 1 : 0])
  group.add(core)
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: i % 3 === 0 ? DANGER_COLOR : ORB_COLOR,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  glow.scale.set(1.5, 1.5, 1)
  group.add(glow)
  group.position.set(side * 5.5, 0.5 + (i % 4) * 0.6, 8 - i * 26)
  scene.add(group)
  beacons.push(group)
}

const ship = new THREE.Group()
const hullMaterial = new THREE.MeshStandardMaterial({
  color: 0xe5fbff,
  metalness: 0.86,
  roughness: 0.22,
  emissive: 0x09323d,
  emissiveIntensity: 0.9
})
const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x0e2230,
  metalness: 0.92,
  roughness: 0.28,
  emissive: 0x0e6d84,
  emissiveIntensity: 0.8
})
const accentMaterial = new THREE.MeshStandardMaterial({
  color: 0x0affff,
  emissive: 0x28f0ff,
  emissiveIntensity: 2.4,
  metalness: 0.4,
  roughness: 0.2
})
const cockpitMaterial = new THREE.MeshStandardMaterial({
  color: 0x07151f,
  metalness: 1,
  roughness: 0.05,
  emissive: 0x1a9fc3,
  emissiveIntensity: 1.2
})
const engineMaterial = new THREE.MeshBasicMaterial({ color: 0xa9feff })

const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.75, 4), hullMaterial)
fuselage.rotation.x = -Math.PI / 2
fuselage.rotation.y = Math.PI / 4
fuselage.position.z = -0.22
ship.add(fuselage)

const spine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 1.5), darkMaterial)
spine.position.set(0, 0.13, 0)
ship.add(spine)

for (const side of [-1, 1]) {
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.055, 0.46), hullMaterial)
  wing.position.set(side * 0.72, 0, 0.16)
  wing.rotation.y = side * 0.36
  wing.rotation.z = side * 0.1
  ship.add(wing)

  const wingTip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.075, 0.075), accentMaterial)
  wingTip.position.set(side * 1.33, 0.005, 0.34)
  wingTip.rotation.y = side * 0.36
  wingTip.rotation.z = side * 0.1
  ship.add(wingTip)

  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.145, 0.62, 12), darkMaterial)
  engine.rotation.x = Math.PI / 2
  engine.position.set(side * 0.27, -0.015, 0.66)
  ship.add(engine)

  const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12), engineMaterial)
  engineCore.rotation.x = Math.PI / 2
  engineCore.position.set(side * 0.27, -0.015, 0.98)
  ship.add(engineCore)

  const engineGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x63f6ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  engineGlow.scale.set(0.78, 0.78, 1)
  engineGlow.position.set(side * 0.27, -0.015, 1.02)
  ship.add(engineGlow)
}

const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), cockpitMaterial)
cockpit.scale.set(0.8, 0.55, 1.7)
cockpit.position.set(0, 0.18, -0.34)
ship.add(cockpit)

const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.46), darkMaterial)
tailFin.position.set(0, 0.26, 0.54)
tailFin.rotation.x = -0.24
ship.add(tailFin)

const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.3), accentMaterial)
tailTip.position.set(0, 0.46, 0.5)
tailTip.rotation.x = -0.24
ship.add(tailTip)

const spineLight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.72), accentMaterial)
spineLight.position.set(0, 0.19, -0.62)
ship.add(spineLight)

for (const side of [-1, 1]) {
  const inset = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.068, 0.26), darkMaterial)
  inset.position.set(side * 0.92, 0.012, 0.14)
  inset.rotation.y = side * 0.36
  inset.rotation.z = side * 0.1
  ship.add(inset)

  const canard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.2), accentMaterial)
  canard.position.set(side * 0.45, 0.03, -0.66)
  canard.rotation.y = side * 0.5
  ship.add(canard)
}

const noseLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), engineMaterial)
noseLight.position.set(0, 0.02, -1.12)
ship.add(noseLight)

const underGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: softGlowTex,
    color: 0x2bd8ff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
)
underGlow.scale.set(3.4, 3.4, 1)
underGlow.position.set(0, -0.28, 0.1)
ship.add(underGlow)

const shipLight = new THREE.PointLight(0x4df4ff, 16, 12, 2)
shipLight.position.set(0, 0.25, 0.4)
ship.add(shipLight)

ship.position.set(0, 1.15, SHIP_Z)
ship.scale.setScalar(1.08)
scene.add(ship)

const MAX_PARTICLES = 320
const particlePositions = new Float32Array(MAX_PARTICLES * 3)
const particleColors = new Float32Array(MAX_PARTICLES * 3)
const particleBase = new Float32Array(MAX_PARTICLES * 3)
const particleVelocities = new Float32Array(MAX_PARTICLES * 3)
const particleLife = new Float32Array(MAX_PARTICLES)
const particleMaxLife = new Float32Array(MAX_PARTICLES)
for (let i = 0; i < MAX_PARTICLES; i++) particlePositions[i * 3 + 1] = -999
let particleCursor = 0

const particleGeometry = new THREE.BufferGeometry()
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))
const particlePoints = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    size: 0.2,
    map: glowTex,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  })
)
particlePoints.frustumCulled = false
scene.add(particlePoints)

const tempColor = new THREE.Color()

function emitParticles(x, y, z, color, count, spread, lifecycle, forward = 0) {
  tempColor.set(color)
  for (let n = 0; n < count; n++) {
    const i = particleCursor
    particleCursor = (particleCursor + 1) % MAX_PARTICLES
    particlePositions[i * 3] = x + (Math.random() - 0.5) * 0.22
    particlePositions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.22
    particlePositions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.22
    particleVelocities[i * 3] = (Math.random() - 0.5) * spread
    particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * spread
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * spread + forward
    particleLife[i] = lifecycle * (0.65 + Math.random() * 0.45)
    particleMaxLife[i] = particleLife[i]
    const intensity = 0.7 + Math.random() * 0.3
    particleBase[i * 3] = tempColor.r * intensity
    particleBase[i * 3 + 1] = tempColor.g * intensity
    particleBase[i * 3 + 2] = tempColor.b * intensity
    particleColors[i * 3] = particleBase[i * 3]
    particleColors[i * 3 + 1] = particleBase[i * 3 + 1]
    particleColors[i * 3 + 2] = particleBase[i * 3 + 2]
  }
}

const orbCoreGeometry = new THREE.OctahedronGeometry(0.37, 0)
const orbCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0x9dffff,
  emissive: 0x2ce6ff,
  emissiveIntensity: 2.6,
  metalness: 0.35,
  roughness: 0.16
})
const orbRingGeometry = new THREE.TorusGeometry(0.63, 0.016, 6, 42)
const orbRingMaterial = new THREE.MeshBasicMaterial({
  color: 0xbdfdff,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
  depthWrite: false
})
const orbGlowMaterial = new THREE.SpriteMaterial({
  map: glowTex,
  color: ORB_COLOR,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: THREE.AdditiveBlending
})

function createOrb() {
  const group = new THREE.Group()
  const core = new THREE.Mesh(orbCoreGeometry, orbCoreMaterial)
  group.add(core)

  const ringA = new THREE.Mesh(orbRingGeometry, orbRingMaterial)
  ringA.rotation.x = 1.15
  group.add(ringA)

  const ringB = new THREE.Mesh(orbRingGeometry, orbRingMaterial)
  ringB.rotation.y = 1.15
  group.add(ringB)

  const glow = new THREE.Sprite(orbGlowMaterial)
  glow.scale.set(2.15, 2.15, 1)
  group.add(glow)

  group.userData.kind = 'orb'
  return group
}

const asteroidMaterial = new THREE.MeshStandardMaterial({
  color: 0x3d4869,
  roughness: 0.86,
  metalness: 0.42,
  flatShading: true,
  emissive: 0x1c102b,
  emissiveIntensity: 1.1
})
const asteroidEdgeMaterial = new THREE.LineBasicMaterial({
  color: 0xa8b9e8,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  blending: THREE.AdditiveBlending
})
const dangerCoreMaterial = new THREE.MeshStandardMaterial({
  color: 0xff7fd4,
  emissive: DANGER_COLOR,
  emissiveIntensity: 3,
  roughness: 0.25,
  metalness: 0.2
})
const dangerGlowMaterial = new THREE.SpriteMaterial({
  map: glowTex,
  color: DANGER_COLOR,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  blending: THREE.AdditiveBlending
})
const asteroidGeometries = [
  new THREE.IcosahedronGeometry(0.72, 1),
  new THREE.IcosahedronGeometry(0.9, 1),
  new THREE.IcosahedronGeometry(1.08, 1)
]

function createAsteroid(radius) {
  const group = new THREE.Group()
  const geometry = radius < 0.8 ? asteroidGeometries[0] : radius < 1 ? asteroidGeometries[1] : asteroidGeometries[2]
  const rock = new THREE.Mesh(geometry, asteroidMaterial)
  rock.scale.set(1, 0.82 + Math.random() * 0.3, 1)
  rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
  group.add(rock)

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), asteroidEdgeMaterial)
  rock.add(edges)

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), dangerCoreMaterial)
  core.position.set(0.18, 0.1, 0.42)
  group.add(core)

  const dangerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.06, 0.018, 4, 34),
    new THREE.MeshBasicMaterial({
      color: DANGER_COLOR,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  dangerRing.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2)
  group.add(dangerRing)

  const glow = new THREE.Sprite(dangerGlowMaterial)
  glow.scale.set(radius * 2.9, radius * 2.9, 1)
  group.add(glow)

  group.userData.kind = 'asteroid'
  return group
}

const objects = []

function addObject(type, x, z, radius = 0.9) {
  const mesh = type === 'orb' ? createOrb() : createAsteroid(radius)
  mesh.position.set(x, 1.15, z)
  scene.add(mesh)
  const object = {
    type,
    mesh,
    x,
    z,
    prevZ: z,
    radius,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.8
  }
  objects.push(object)
  return object
}

function removeObject(object) {
  scene.remove(object.mesh)
  object.mesh.traverse((child) => {
    const geometry = child.geometry
    if (!geometry || geometry === orbCoreGeometry || geometry === orbRingGeometry || asteroidGeometries.includes(geometry)) return
    geometry.dispose()
  })
  const index = objects.indexOf(object)
  if (index >= 0) objects.splice(index, 1)
}

function clearObjects() {
  while (objects.length) removeObject(objects[objects.length - 1])
}

const initialLayout = [
  ['asteroid', 2.7, -32, 0.9],
  ['orb', -2.45, -30],
  ['orb', 2.5, -40],
  ['asteroid', -2.7, -42, 1.0],
  ['orb', 0, -50],
  ['asteroid', 1.9, -56, 0.78],
  ['orb', -1.5, -60],
  ['orb', 2.6, -68],
  ['orb', -2.4, -76],
  ['asteroid', 0, -82, 1.0]
]

function resetWorld() {
  clearObjects()
  for (const [type, x, z, radius] of initialLayout) addObject(type, x, z, radius)
  for (let i = 0; i < rings.length; i++) {
    rings[i].position.z = 9 - i * 17.5
    updateRingFade(rings[i])
  }
  for (let i = 0; i < beacons.length; i++) {
    beacons[i].position.z = 8 - i * 26
  }
  floorTexture.offset.y = 0
}

resetWorld()

let spawnClock = 0

function spawnWave() {
  const roll = Math.random()
  if (roll < 0.4) {
    addObject('orb', LANES[Math.floor(Math.random() * LANES.length)], -98)
  } else if (roll < 0.52) {
    const center = LANES[Math.floor(Math.random() * 3) + 1]
    addObject('orb', center - 1.38, -98)
    addObject('orb', center, -98)
    addObject('orb', center + 1.38, -98)
  } else if (roll < 0.8) {
    const x = LANES[Math.floor(Math.random() * LANES.length)]
    addObject('asteroid', x, -100, 0.75 + Math.random() * 0.32)
  } else {
    const left = Math.random() > 0.5
    addObject('asteroid', left ? -2.45 : 2.45, -100, 0.85 + Math.random() * 0.22)
    addObject('orb', left ? 1.55 : -1.55, -94)
  }
}

function showToast(text, variant = '') {
  toastEl.textContent = text
  toastEl.className = `toast show ${variant}`.trim()
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => {
    toastEl.className = 'toast'
  }, 900)
}

let audio = null

function ensureAudio() {
  if (audio) return audio
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  try {
    audio = { context: new AudioContextClass(), muted: false }
  } catch {
    audio = null
  }
  return audio
}

function tone(frequency, duration, type = 'sine', volume = 0.08, slide = 0) {
  if (!audio || audio.muted) return
  const context = audio.context
  if (context.state === 'suspended') context.resume().catch(() => {})
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration)
  gain.gain.setValueAtTime(Math.max(0.0001, volume), now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function collectTone() {
  tone(760, 0.16, 'triangle', 0.075, 380)
  window.setTimeout(() => tone(1180, 0.12, 'sine', 0.045, 260), 45)
}

function hitTone() {
  tone(120, 0.34, 'sawtooth', 0.11, -70)
  tone(58, 0.4, 'square', 0.05, -18)
}

function startTone() {
  tone(320, 0.24, 'triangle', 0.06, 420)
  window.setTimeout(() => tone(640, 0.28, 'sine', 0.05, 280), 120)
}

function gameOverTone() {
  tone(420, 0.4, 'triangle', 0.09, -280)
  window.setTimeout(() => tone(210, 0.6, 'sawtooth', 0.07, -150), 180)
}

muteButton.addEventListener('click', () => {
  const instance = ensureAudio()
  if (!instance) return
  instance.muted = !instance.muted
  muteButton.setAttribute('aria-pressed', instance.muted ? 'true' : 'false')
  muteButton.setAttribute('aria-label', instance.muted ? 'Unmute audio' : 'Mute audio')
})

function updateHud(force = false) {
  const scoreText = String(Math.floor(state.score)).padStart(5, '0')
  if (force || scoreEl.textContent !== scoreText) scoreEl.textContent = scoreText
  const multiplierText = `x${state.multiplier}`
  if (force || comboEl.textContent !== multiplierText) comboEl.textContent = multiplierText
  comboEl.classList.toggle('active', state.multiplier > 1)
  const speedText = String(Math.round(state.speed * 7.2)).padStart(3, '0')
  if (force || speedEl.textContent !== speedText) speedEl.textContent = speedText
  shieldPips.forEach((pip, index) => pip.classList.toggle('lost', index >= state.shield))
}

function startGame() {
  ensureAudio()
  if (audio?.context.state === 'suspended') audio.context.resume().catch(() => {})
  state.mode = 'playing'
  state.score = 0
  state.combo = 0
  state.multiplier = 1
  state.shield = 3
  state.elapsed = 0
  state.distance = 0
  state.speed = 26
  state.targetX = 0
  state.x = 0
  state.spawnTimer = 0.5
  state.shake = 0
  state.hitCooldown = 0
  ship.position.x = 0
  ship.rotation.set(0, 0, 0)
  resetWorld()
  updateHud(true)
  startScreen.classList.add('hidden')
  overScreen.classList.add('hidden')
  document.body.dataset.playing = 'true'
  document.body.dataset.hint = 'on'
  window.clearTimeout(startGame.hintTimer)
  startGame.hintTimer = window.setTimeout(() => {
    if (state.mode === 'playing') document.body.dataset.hint = 'off'
  }, 6500)
  window.__gameState = { mode: 'playing', score: 0, shield: 3 }
  startTone()
}

function endGame() {
  state.mode = 'over'
  document.body.dataset.playing = 'false'
  const finalScore = Math.floor(state.score)
  const isBest = finalScore > state.best
  if (isBest) {
    state.best = finalScore
    try {
      window.localStorage.setItem('starlight-drift-best', String(state.best))
    } catch {
      state.best = finalScore
    }
  }
  finalScoreEl.textContent = String(finalScore)
  finalBestEl.textContent = String(state.best)
  menuBestEl.textContent = String(state.best)
  newBestEl.classList.toggle('hidden', !isBest)
  overScreen.classList.remove('hidden')
  window.__gameState = { mode: 'over', score: finalScore, best: state.best, shield: 0 }
  gameOverTone()
}

startButton.addEventListener('click', startGame)
againButton.addEventListener('click', startGame)

function damage() {
  if (state.hitCooldown > 0) return
  state.shield = Math.max(0, state.shield - 1)
  state.combo = 0
  state.multiplier = 1
  state.hitCooldown = 0.7
  state.shake = 0.65
  flashEl.classList.add('active')
  window.setTimeout(() => flashEl.classList.remove('active'), 120)
  showToast('Hull damaged', 'danger')
  hitTone()
  updateHud(true)
  if (state.shield <= 0) endGame()
}

function collect(object) {
  state.combo += 1
  state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 4))
  const points = 25 * state.multiplier
  state.score += points
  emitParticles(object.x, object.mesh.position.y, 0, ORB_COLOR, 20, 3.4, 0.65, 1.2)
  emitParticles(object.x, object.mesh.position.y, 0, 0xffffff, 6, 1.7, 0.4, 0.6)
  collectTone()
  if (state.combo > 0 && state.combo % 8 === 0) {
    showToast(`Combo x${state.multiplier}`, 'gold')
  }
  updateHud(true)
}

function nearMiss(object) {
  state.score += 5
  emitParticles(object.x, object.mesh.position.y, 0, GOLD_COLOR, 3, 0.8, 0.28, 0.3)
}

function updateGame(dt, time) {
  state.elapsed += dt
  state.speed = 26 + Math.min(30, state.elapsed * 0.62)
  state.distance += state.speed * dt
  if (state.hitCooldown > 0) state.hitCooldown -= dt

  const keyboardSteer = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
  if (keyboardSteer !== 0) {
    state.targetX = THREE.MathUtils.clamp(state.targetX + keyboardSteer * 6.4 * dt, -PLAY_HALF, PLAY_HALF)
  }

  const previousX = state.x
  state.x += (state.targetX - state.x) * Math.min(1, dt * 10)
  const velocity = (state.x - previousX) / Math.max(dt, 0.001)
  ship.position.x = state.x
  ship.position.y = 1.15 + Math.sin(time * 2.1) * 0.055
  ship.rotation.z = THREE.MathUtils.clamp(-velocity * 0.055, -0.34, 0.34)
  ship.rotation.y = THREE.MathUtils.clamp(velocity * 0.018, -0.14, 0.14)
  ship.rotation.x = Math.sin(time * 1.7) * 0.018

  if (Math.random() < 0.85) {
    emitParticles(state.x + (Math.random() - 0.5) * 0.28, ship.position.y - 0.02, 0.98, 0x6bf6ff, 1, 0.35, 0.42, 1.8)
  }

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    spawnWave()
    state.spawnTimer = Math.max(0.34, 0.68 - state.elapsed * 0.004)
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i]
    object.prevZ = object.z
    object.z += state.speed * dt
    object.mesh.position.z = object.z
    object.mesh.position.y = 1.15 + Math.sin(time * 1.8 + object.phase) * 0.16
    object.mesh.rotation.y += object.spin * dt
    if (object.type === 'orb') {
      object.mesh.rotation.x += dt * 1.4
      object.mesh.rotation.z += dt * 0.7
    } else {
      object.mesh.rotation.x += dt * 0.5
    }

    if (object.prevZ < SHIP_Z && object.z >= SHIP_Z) {
      const distance = Math.abs(object.x - state.x)
      if (object.type === 'orb' && distance < 0.95) {
        collect(object)
        removeObject(object)
        continue
      }
      if (object.type === 'asteroid') {
        const threshold = object.radius * 0.58 + 0.34
        if (distance < threshold) {
          damage()
          emitParticles(object.x, object.mesh.position.y, 0, DANGER_COLOR, 22, 4, 0.5, 1)
          removeObject(object)
          if (state.mode !== 'playing') return
          continue
        }
        if (distance < threshold + 0.6) nearMiss(object)
      }
    }

    if (object.z > 13) removeObject(object)
  }

  if (state.mode !== 'playing') return

  const floorOffset = (state.distance * 0.013) % 1
  floorTexture.offset.y = -floorOffset

  for (const ring of rings) {
    ring.position.z += state.speed * dt
    if (ring.position.z > 10.5) ring.position.z -= 175
    updateRingFade(ring)
    ring.rotation.z += dt * 0.08
  }

  for (const beacon of beacons) {
    beacon.position.z += state.speed * dt
    if (beacon.position.z > 16) beacon.position.z -= 260
    beacon.rotation.y += dt * 1.1
    beacon.rotation.x += dt * 0.4
  }

  state.score += dt * 1.5
  updateHud()
}

function updateIdle(dt, time) {
  ship.position.x += (0 - ship.position.x) * Math.min(1, dt * 2)
  ship.position.y = 1.15 + Math.sin(time * 1.35) * 0.08
  ship.rotation.z = Math.sin(time * 0.8) * 0.045
  ship.rotation.y = Math.sin(time * 0.55) * 0.11
  ship.rotation.x = Math.sin(time * 1.1) * 0.02

  for (const ring of rings) {
    ring.position.z += 4 * dt
    if (ring.position.z > 10.5) ring.position.z -= 175
    updateRingFade(ring)
    ring.rotation.z += dt * 0.05
  }
  for (const beacon of beacons) {
    beacon.position.z += 4 * dt
    if (beacon.position.z > 16) beacon.position.z -= 260
    beacon.rotation.y += dt * 0.5
  }
  floorTexture.offset.y = (floorTexture.offset.y - dt * 0.012) % 1

  for (const object of objects) {
    object.mesh.rotation.y += dt * 0.5
    if (object.type === 'orb') object.mesh.rotation.x += dt * 0.8
  }

  if (Math.random() < 0.35) {
    emitParticles(state.x + (Math.random() - 0.5) * 0.25, ship.position.y - 0.02, 0.98, 0x6bf6ff, 1, 0.3, 0.4, 0.8)
  }
}

function updateParticles(dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (particleLife[i] <= 0) continue
    particleLife[i] -= dt
    if (particleLife[i] <= 0) {
      particlePositions[i * 3 + 1] = -999
      particleColors[i * 3] = 0
      particleColors[i * 3 + 1] = 0
      particleColors[i * 3 + 2] = 0
      continue
    }
    particlePositions[i * 3] += particleVelocities[i * 3] * dt
    particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * dt
    particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * dt
    const fade = Math.pow(particleLife[i] / Math.max(particleMaxLife[i], 0.001), 1.4)
    particleColors[i * 3] = particleBase[i * 3] * fade
    particleColors[i * 3 + 1] = particleBase[i * 3 + 1] * fade
    particleColors[i * 3 + 2] = particleBase[i * 3 + 2] * fade
  }
  particleGeometry.attributes.position.needsUpdate = true
  particleGeometry.attributes.color.needsUpdate = true
}

let baseCameraY = 3.35
let baseCameraZ = 10

function updateCamera(dt, time) {
  const shakeAmount = state.shake
  if (shakeAmount > 0) state.shake = Math.max(0, shakeAmount - dt * 2.4)
  const shakeX = (Math.random() - 0.5) * shakeAmount * 0.55
  const shakeY = (Math.random() - 0.5) * shakeAmount * 0.4
  const targetX = ship.position.x * 0.2 + Math.sin(time * 0.4) * 0.08
  camera.position.x += (targetX + shakeX - camera.position.x) * Math.min(1, dt * 3.2)
  camera.position.y += (baseCameraY + shakeY - camera.position.y) * Math.min(1, dt * 3.2)
  camera.position.z = baseCameraZ
  camera.lookAt(ship.position.x * 0.42, 1.24, -6.5)
  camera.rotation.z += -ship.rotation.z * 0.09 + (Math.random() - 0.5) * shakeAmount * 0.03
}

function updateBackground(time, dt) {
  starLayer.rotation.z = time * 0.003
  starLayerFine.rotation.z = -time * 0.002
  nebula.rotation.z = Math.sin(time * 0.02) * 0.03
  planet.rotation.y = time * 0.014
  planetRing.rotation.z += dt * 0.008
  moon.rotation.y += dt * 0.025
  distantRocks.rotation.y = Math.sin(time * 0.015) * 0.03
}

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  const aspect = width / height
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height, false)
  camera.aspect = aspect
  if (aspect < 0.8) {
    camera.fov = 74
    baseCameraY = 3.26
    baseCameraZ = 12.1
  } else if (aspect < 1.25) {
    camera.fov = 68
    baseCameraY = 3.3
    baseCameraZ = 10.8
  } else {
    camera.fov = 60
    baseCameraY = 3.35
    baseCameraZ = 9.9
  }
  camera.position.y = baseCameraY
  camera.position.z = baseCameraZ
  camera.updateProjectionMatrix()
}

window.addEventListener('resize', resize)
resize()

const keys = new Set()
window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'].includes(event.code)) event.preventDefault()
  keys.add(event.code)
  if ((event.code === 'Enter' || event.code === 'Space') && state.mode !== 'playing') {
    startGame()
  }
})
window.addEventListener('keyup', (event) => keys.delete(event.code))
window.addEventListener('blur', () => keys.clear())

let pointerActive = false

function steerTo(clientX) {
  const normalized = (clientX / window.innerWidth) * 2 - 1
  state.targetX = THREE.MathUtils.clamp(normalized * PLAY_HALF * 1.12, -PLAY_HALF, PLAY_HALF)
}

canvas.addEventListener('pointerdown', (event) => {
  if (state.mode !== 'playing') return
  pointerActive = true
  canvas.setPointerCapture?.(event.pointerId)
  steerTo(event.clientX)
})

canvas.addEventListener('pointermove', (event) => {
  if (!pointerActive || state.mode !== 'playing') return
  steerTo(event.clientX)
})

function releasePointer() {
  pointerActive = false
}

canvas.addEventListener('pointerup', releasePointer)
canvas.addEventListener('pointercancel', releasePointer)
canvas.addEventListener('lostpointercapture', releasePointer)

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.mode === 'playing') {
    state.hitCooldown = Math.max(state.hitCooldown, 0.3)
  }
})

document.addEventListener('contextmenu', (event) => event.preventDefault())

const clock = new THREE.Clock()
let hudAccumulator = 0
let firstFrame = true

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)
  const time = clock.elapsedTime

  updateBackground(time, dt)
  if (state.mode === 'playing') updateGame(dt, time)
  else updateIdle(dt, time)
  updateParticles(dt)
  updateCamera(dt, time)
  renderer.render(scene, camera)

  hudAccumulator += dt
  if (hudAccumulator > 0.12) {
    hudAccumulator = 0
    if (state.mode === 'playing') {
      updateHud()
      window.__gameState = {
        mode: 'playing',
        score: Math.floor(state.score),
        best: state.best,
        shield: state.shield,
        distance: Math.floor(state.distance)
      }
    }
  }

  if (firstFrame) {
    firstFrame = false
    window.__gameReady = true
    document.body.dataset.ready = 'true'
  }
  requestAnimationFrame(frame)
}

window.__gameReady = false
window.__gameState = { mode: 'menu', score: 0, best: state.best, shield: 3 }
window.__scene = { renderer: 'webgl', mode: state.mode }

requestAnimationFrame(frame)
