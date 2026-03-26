import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  allocateSpawnSlots,
  createProjectile,
  createSimulationState,
  explodeBlocks,
  resolveProjectileImpact,
  stepProjectile,
  stepSimulation,
} from "@tntwars/shared";

const PLAYER_IDS = ["bot-1", "bot-2", "bot-3", "bot-4", "you", "bot-5", "bot-6", "bot-7", "bot-8"];
const LOCAL_PLAYER_ID = "you";
const BOT_PLAYER_IDS = PLAYER_IDS.filter((playerId) => playerId.startsWith("bot-"));
const PLAYER_COLORS = {
  you: "#ff9b54",
  "bot-1": "#59d6ff",
  "bot-2": "#7dff9d",
  "bot-3": "#ff5f87",
  "bot-4": "#ffd166",
  "bot-5": "#8fbcff",
  "bot-6": "#6ef2d4",
  "bot-7": "#f29e6e",
  "bot-8": "#caa6ff",
};
const SPAWN_CONFIG = {
  pileSize: 7,
  pileHeight: 3,
  spacing: 17,
  baseY: 0,
  maxJumpDistance: 4,
};
const SIMULATION_CONFIG = {
  fixedDeltaSeconds: 1 / 60,
  moveSpeed: 7,
  jumpVelocity: 8.5,
  gravity: 20,
  chasmY: -8,
  aiPileMotionEnabled: true,
  aiPileMotionStepIntervalTicks: 22,
  aiPileMotionMaxOffset: 1,
  aiPileMotionExcludePlayerId: LOCAL_PLAYER_ID,
  aiPileMotionMinDistanceToExcludedAnchor: 14,
  aiPileMotionPlayerIds: BOT_PLAYER_IDS,
};
const TNT_COOLDOWN_SECONDS = 0;
const PROJECTILE_LIFETIME_TICKS = 240;
const MIN_SHOT_POWER = 14;
const MAX_SHOT_POWER = 28;
const MIN_SHOT_ANGLE = Math.PI * 0.17;
const MAX_SHOT_ANGLE = Math.PI * 0.36;
const DEFAULT_ARC_CONTROL = 0.46;
const PLAYER_SHOT_JITTER_DEGREES = 1.7;
const HOLD_FIRE_INTERVAL_SECONDS = 0.11;
const MAX_PREVIEW_STEPS = 120;
const SHOT_PREVIEW_RECOMPUTE_INTERVAL_SECONDS = 1 / 30;
const MAX_FIXED_STEPS_PER_FRAME = 4;
const HUD_UPDATE_INTERVAL_SECONDS = 1 / 12;
const AIM_POINT_UPDATE_INTERVAL_SECONDS = 1 / 30;
const BOT_OPENING_GRACE_SECONDS = 1.2;
const BOT_COOLDOWN_MIN_SECONDS = 1.0;
const BOT_COOLDOWN_MAX_SECONDS = 2.25;
const LEVEL_BOT_COUNT_CAP = 8;
const LEVEL_FIRE_RATE_BASELINE = 8;
const LEVEL_FIRE_RATE_SCALE_PER_LEVEL = 0.9;
const LEVEL_FIRE_RATE_SCALE_FLOOR = 0.35;
const LEVEL_LABEL_FADE_IN_SECONDS = 0.7;
const LEVEL_LABEL_HOLD_SECONDS = 2.2;
const LEVEL_LABEL_FADE_OUT_SECONDS = 0.64;
const BOT_MOVE_RETARGET_MIN_SECONDS = 1.4;
const BOT_MOVE_RETARGET_MAX_SECONDS = 2.4;
const BOT_MOVE_TARGET_REACHED_DISTANCE = 0.4;
const BOT_MOVE_DEADZONE_DISTANCE = 0.22;
const BOT_TOP_CENTER_HOLD_RADIUS = 0.55;
const MIN_CAMERA_PITCH = 0.12;
const MAX_CAMERA_PITCH = 1.48;
const WORLD_SCALE = 2;
const CINEMATIC_ORBIT_SPAN_RADIANS = Math.PI * 1.35;
const CINEMATIC_START_RADIUS = 58 * WORLD_SCALE;
const CINEMATIC_START_HEIGHT = 20 * WORLD_SCALE;
const INTRO_CINEMATIC_ORBIT_SPAN_RADIANS = Math.PI * 2;
const INTRO_CINEMATIC_START_RADIUS = 96 * WORLD_SCALE;
const INTRO_CINEMATIC_START_HEIGHT = 36 * WORLD_SCALE;
const INTRO_ENEMY_FOCUS_DISTANCE = 8.5 * WORLD_SCALE;
const INTRO_ENEMY_FOCUS_HEIGHT = 7.2 * WORLD_SCALE;
const MASTER_DEFAULT_VOLUME = 1;
const MUSIC_DEFAULT_VOLUME = 1;
const SFX_DEFAULT_VOLUME = 1;
const MASTER_BASE_GAIN = 0.42;
const AUDIO_SETTINGS_STORAGE_KEY = "tntwars-audio-settings-v1";
const MUSIC_MAX_GAIN_MULTIPLIER = 2.2;
const MUSIC_TEMPO_BPM = 136;
const BLOCK_MOTION_EASE_SPEED = 3.4;
const DEAD_PLATFORM_DISSOLVE_SECONDS = 3.6;
const DEAD_PLATFORM_SINK_DISTANCE = 1.8;
const HIGH_SCORE_STORAGE_KEY = "tntwars-high-score";
const LEADERBOARD_MAX_ENTRIES = 10;
const LEADERBOARD_INITIALS_MAX_LENGTH = 4;
const LEADERBOARD_REFRESH_INTERVAL_MS = 45_000;
const LEADERBOARD_REQUEST_TIMEOUT_MS = 8_000;
const LEADERBOARD_SCORE_UPDATE_MAX_DELTA = 8;
const LEADERBOARD_SCORE_UPDATE_MAX_PER_SECOND = 30;
const TNT_RED = "#cf1f2e";
const PROJECTILE_BLAST_RADIUS = 1.65;
const LEADERBOARD_BLOCKED_INITIALS = new Set([
  "ARSE",
  "ASS",
  "BSTD",
  "COCK",
  "CRAP",
  "CUNT",
  "DICK",
  "FART",
  "FCK",
  "FUCK",
  "PISS",
  "SHIT",
  "SLUT",
  "TWAT",
  "WANK",
]);
const SCORE_POPUP_DURATION_SECONDS = 0.55;
const SCORE_POPUP_RISE_DISTANCE = 2.45;
const SCORE_POPUP_FADE_DELAY_PROGRESS = 0.28;
const MAX_ACTIVE_SCORE_POPUPS = 90;
const NORMAL_EXPLOSION_PARTICLE_COUNT = 46;
const ENEMY_EXPLOSION_PARTICLE_COUNT = 72;
const GRID_CELL_SIZE = 3 * WORLD_SCALE;
const GRID_TRAVEL_SPEED_PRIMARY = 25;
const GRID_TRAVEL_SPEED_SECONDARY = 9;
const GRID_PULSE_SPEED = 5.8;
const GRID_SECONDARY_DEPTH_OFFSET = -0.72;
const GRID_SECONDARY_SIDE_OFFSET_FACTOR = 0.7;
const GRID_SECONDARY_BACK_OFFSET_FACTOR = 0.32;
const GRID_PARALLAX_MIN_INTENSITY = 0.42;
const ATMOSPHERIC_PARTICLE_FIELD_RADIUS = 110;
const ATMOSPHERIC_PARTICLE_DRIFT_SPEED = GRID_TRAVEL_SPEED_PRIMARY;
const ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN = 34;
const ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MAX = 72;
const ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_NEAR = 1.8;
const ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_FAR = 140;
const ATMOSPHERIC_PARTICLE_PRESTART_LATERAL_SPREAD = 72;
const ATMOSPHERIC_PARTICLE_PRESTART_VERTICAL_SPREAD = 42;
const FOG_NEAR_DISTANCE = 20;
const FOG_FAR_DISTANCE = 96;
const DIR_SHADOW_MAP_SIZE = 2048;
const DIR_SHADOW_MARGIN = 12 * WORLD_SCALE;
const DIR_SHADOW_NEAR = 0.5;
const DIR_SHADOW_FAR = 420;
const DIR_LIGHT_OFFSET_X = 28 * WORLD_SCALE;
const DIR_LIGHT_OFFSET_Y = 48 * WORLD_SCALE;
const DIR_LIGHT_OFFSET_Z = 20 * WORLD_SCALE;
const ENEMY_MODEL_ID = "axOSBJbWaa";
const ENEMY_MODEL_TARGET_HEIGHT = 1.8 * WORLD_SCALE;
const LOCAL_MODEL_FILENAMES = [
  "enemy-ai.glb",
  "enemy-ai.gltf",
  `${ENEMY_MODEL_ID}.glb`,
  `${ENEMY_MODEL_ID}.gltf`,
  "poly-pizza-green-spiky-blob.glb",
  "poly-pizza-zombie.glb",
  "poly-pizza-glub-evolved.glb",
];
const ENEMY_MODEL_REMOTE_URL_CANDIDATES = [
  "https://raw.githubusercontent.com/SimonJamesOdell/vibequake/master/public/models/poly-pizza-green-spiky-blob.glb",
  "https://raw.githubusercontent.com/SimonJamesOdell/vibequake/master/public/models/poly-pizza-zombie.glb",
  "https://raw.githubusercontent.com/SimonJamesOdell/vibequake/master/public/models/poly-pizza-glub-evolved.glb",
  `https://models.poly.pizza/${ENEMY_MODEL_ID}.glb`,
  `https://poly.pizza/m/${ENEMY_MODEL_ID}.glb`,
  `https://cdn.poly.pizza/models/${ENEMY_MODEL_ID}.glb`,
];
const ENEMY_MODEL_BASE_URL = import.meta.env?.BASE_URL ?? "/";
const USE_ENEMY_MODEL_VISUALS = false;
const ENV_LEADERBOARD_API_BASE_URL = (import.meta.env?.VITE_LEADERBOARD_API_BASE_URL ?? "").trim();
const LEADERBOARD_API_BASE_URL_QUERY = new URLSearchParams(window.location.search).get("leaderboardApiBase")?.trim() ?? "";
const LEADERBOARD_API_BASE_URL_FALLBACK =
  window.location.hostname
    ? `http://${window.location.hostname}:5200`
    : "";
const LEADERBOARD_API_BASE_URL =
  LEADERBOARD_API_BASE_URL_QUERY
  || ENV_LEADERBOARD_API_BASE_URL
  || (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:5200"
    : LEADERBOARD_API_BASE_URL_FALLBACK);
const LEADERBOARD_TEST_SHORTCUT_ENABLED = false;

function withBaseUrl(path) {
  return `${ENEMY_MODEL_BASE_URL}${path.replace(/^\/+/, "")}`;
}

const ENEMY_MODEL_URL_CANDIDATES = Array.from(
  new Set([
    ...LOCAL_MODEL_FILENAMES.map((filename) => withBaseUrl(`models/${filename}`)),
    ...LOCAL_MODEL_FILENAMES.map((filename) => `/models/${filename}`),
    ...ENEMY_MODEL_REMOTE_URL_CANDIDATES,
  ]),
);
const ENEMY_MODEL_LOCAL_PATH = withBaseUrl("models/enemy-ai.glb");
const CRITICAL_HIT_CHANCE = 0.16;
const CRITICAL_HIT_MIN_BLOCKS = 3;
const CRITICAL_HIT_MAX_BLOCKS = 5;
const RETICLE = new THREE.Vector2(0, 0.22);
const EMPTY_BLOCKS = [];

const app = document.getElementById("app");
const statusLine = document.getElementById("status-line");
const scoreValue = document.getElementById("score-value");
const highScoreValue = document.getElementById("high-score-value");
const cooldownLine = document.getElementById("cooldown-line");
const modeLine = document.getElementById("mode-line");
const banner = document.getElementById("banner");
const bannerTitle = document.getElementById("banner-title");
const bannerText = document.getElementById("banner-text");
const bannerAction = document.getElementById("banner-action");
const leaderboardStatus = document.getElementById("leaderboard-status");
const leaderboardList = document.getElementById("leaderboard-list");
const initialsForm = document.getElementById("initials-form");
const initialsInput = document.getElementById("initials-input");
const initialsSubmit = document.getElementById("initials-submit");
const initialsFeedback = document.getElementById("initials-feedback");
const allVolume = document.getElementById("all-volume");
const musicVolume = document.getElementById("music-volume");
const sfxVolume = document.getElementById("sfx-volume");
const musicMute = document.getElementById("music-mute");
const volumeToggle = document.getElementById("volume-toggle");
const volumeControls = document.getElementById("volume-controls");
const infoToggle = document.getElementById("info-toggle");
const infoModal = document.getElementById("info-modal");
const infoModalClose = document.getElementById("info-modal-close");
const musicState = document.getElementById("music-state");
const fpsCounter = document.getElementById("fps-counter");
const levelOverlay = document.getElementById("level-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const pauseAction = document.getElementById("pause-action");

function setInfoModalOpen(open) {
  if (!infoToggle || !infoModal) {
    return;
  }

  infoToggle.setAttribute("aria-expanded", open ? "true" : "false");
  infoToggle.setAttribute("aria-label", open ? "Hide project information" : "Show project information");
  infoModal.classList.toggle("hidden", !open);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#040404");
scene.fog = new THREE.Fog("#050505", FOG_NEAR_DISTANCE, FOG_FAR_DISTANCE);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 240);

const hemi = new THREE.HemisphereLight(0xaedfff, 0x12070a, 1.25);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(14, 24, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(DIR_SHADOW_MAP_SIZE, DIR_SHADOW_MAP_SIZE);
dir.shadow.bias = -0.00018;
dir.shadow.normalBias = 0.028;
dir.shadow.camera.near = DIR_SHADOW_NEAR;
dir.shadow.camera.far = DIR_SHADOW_FAR;
scene.add(dir);
scene.add(dir.target);

const rim = new THREE.PointLight(0xff8a3d, 15, 60, 2);
rim.position.set(10, 8, 10);
scene.add(rim);

function createFloorGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;
  const maxRadius = canvas.width * 0.5;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offsetX = x + 0.5 - centerX;
      const offsetY = y + 0.5 - centerY;
      const normalizedDistance = Math.min(1, Math.hypot(offsetX, offsetY) / maxRadius);
      const easedDistance = 1 - normalizedDistance;
      const alpha = Math.pow(Math.max(0, easedDistance), 2.6) * 0.34;
      const noise = (Math.random() - 0.5) * 0.025;
      const blue = THREE.MathUtils.clamp(0.28 + easedDistance * 0.16 + noise, 0, 1);
      const green = THREE.MathUtils.clamp(0.18 + easedDistance * 0.1 + noise, 0, 1);
      const red = THREE.MathUtils.clamp(0.08 + easedDistance * 0.05 + noise * 0.5, 0, 1);
      const index = (y * canvas.width + x) * 4;

      data[index] = Math.round(red * 255);
      data[index + 1] = Math.round(green * 255);
      data[index + 2] = Math.round(blue * 255);
      data[index + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const floorGlowTexture = createFloorGlowTexture();

const chasm = new THREE.Mesh(
  new THREE.CylinderGeometry(52, 58, 10, 48, 1, true),
  new THREE.MeshBasicMaterial({
    color: "#04080c",
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
chasm.position.set(8, -6.8, 8);
scene.add(chasm);

const floorGlow = new THREE.Mesh(
  new THREE.CircleGeometry(40, 64),
  new THREE.MeshBasicMaterial({
    map: floorGlowTexture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: true,
  }),
);
floorGlow.rotation.x = -Math.PI / 2;
floorGlow.position.y = -7.8;
floorGlow.renderOrder = -3;
scene.add(floorGlow);

const grid = new THREE.GridHelper(420, 140, 0x122632, 0x122632);
const gridSecondary = new THREE.GridHelper(500, 92, 0x0a171f, 0x0a171f);

function setGridOpacity(gridHelper, opacity) {
  const materials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];

  for (const material of materials) {
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.opacity = opacity;
  }
}

setGridOpacity(grid, 0.3);
setGridOpacity(gridSecondary, 0.09);
grid.position.y = -6;
gridSecondary.position.y = grid.position.y + GRID_SECONDARY_DEPTH_OFFSET;
grid.renderOrder = -2;
gridSecondary.renderOrder = -1;
scene.add(grid, gridSecondary);

const blockGroup = new THREE.Group();
const playerGroup = new THREE.Group();
const projectileGroup = new THREE.Group();
const explosionGroup = new THREE.Group();
const explosionLightGroup = new THREE.Group();
const explosionParticleGroup = new THREE.Group();
const scorePopupGroup = new THREE.Group();
const decorationGroup = new THREE.Group();
const previewGroup = new THREE.Group();
scene.add(
  blockGroup,
  playerGroup,
  projectileGroup,
  explosionGroup,
  explosionLightGroup,
  explosionParticleGroup,
  scorePopupGroup,
  decorationGroup,
  previewGroup,
);

const blockGeometry = new THREE.BoxGeometry(1 * WORLD_SCALE, 1 * WORLD_SCALE, 1 * WORLD_SCALE);
const playerGeometry = new THREE.BoxGeometry(0.8 * WORLD_SCALE, 1.8 * WORLD_SCALE, 0.8 * WORLD_SCALE);
const PLAYER_VISUAL_Y_OFFSET = 1.46;
const projectileGeometry = new THREE.BoxGeometry(0.66 * WORLD_SCALE, 0.66 * WORLD_SCALE, 0.66 * WORLD_SCALE);
const explosionGeometry = new THREE.SphereGeometry(1 * WORLD_SCALE, 20, 20);
const starfieldTNTGeometry = new THREE.BoxGeometry(1, 1, 1);
const explosionFragmentGeometry = new THREE.SphereGeometry(0.07 * WORLD_SCALE, 6, 6);
const landingMarkerGeometry = new THREE.RingGeometry(0.45 * WORLD_SCALE, 0.72 * WORLD_SCALE, 32);
const previewDotGeometry = new THREE.SphereGeometry(0.11 * WORLD_SCALE, 10, 10);

function createTntLabelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = TNT_RED;
  context.fillRect(0, 0, canvas.width, 42);
  context.fillRect(0, canvas.height - 42, canvas.width, 42);

  context.strokeStyle = TNT_RED;
  context.lineWidth = 12;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  context.fillStyle = TNT_RED;
  context.font = "900 108px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("TNT", canvas.width / 2, canvas.height / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const tntLabelTexture = createTntLabelTexture();
const projectileSideMaterial = new THREE.MeshStandardMaterial({
  map: tntLabelTexture,
  roughness: 0.58,
  metalness: 0.02,
});
const projectileCapMaterial = new THREE.MeshStandardMaterial({
  color: TNT_RED,
  roughness: 0.62,
  metalness: 0.04,
});
const projectileMaterials = [
  projectileSideMaterial,
  projectileSideMaterial,
  projectileCapMaterial,
  projectileCapMaterial,
  projectileSideMaterial,
  projectileSideMaterial,
];

function createScorePopupTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "900 78px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 12;
  context.strokeStyle = "rgba(76, 44, 7, 0.75)";
  context.strokeText("+1", canvas.width / 2, canvas.height / 2);
  context.fillStyle = "#ffd166";
  context.fillText("+1", canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const scorePopupTexture = createScorePopupTexture();
const baseScorePopupMaterial = new THREE.SpriteMaterial({
  map: scorePopupTexture,
  transparent: true,
  depthWrite: false,
  depthTest: true,
});

function createProceduralBlockTexture(baseColorHex, options = {}) {
  const {
    noiseCells = 520,
    panelInset = 12,
    panelStrokeAlpha = 0.22,
  } = options;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  const base = new THREE.Color(baseColorHex);
  const light = base.clone().offsetHSL(0, -0.03, 0.08);
  const dark = base.clone().offsetHSL(0, 0.03, -0.1);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, `#${light.getHexString()}`);
  gradient.addColorStop(1, `#${dark.getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < noiseCells; index += 1) {
    const x = Math.floor(Math.random() * canvas.width);
    const y = Math.floor(Math.random() * canvas.height);
    const size = Math.floor(Math.random() * 2) + 1;
    const alpha = Math.random() * 0.12;
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.fillRect(x, y, size, size);
  }

  context.strokeStyle = `rgba(255,255,255,${panelStrokeAlpha})`;
  context.lineWidth = 3;
  context.strokeRect(panelInset, panelInset, canvas.width - panelInset * 2, canvas.height - panelInset * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createTNTStarfieldTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  // White background
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Red border stripes (top and bottom)
  context.fillStyle = TNT_RED;
  context.fillRect(0, 0, canvas.width, 20);
  context.fillRect(0, canvas.height - 20, canvas.width, 20);

  // Red border frame
  context.strokeStyle = TNT_RED;
  context.lineWidth = 10;
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  // TNT text
  context.fillStyle = TNT_RED;
  context.font = "bold 60px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("TNT", canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const blockMaterialCache = new Map();
const destroyableBlockMaterialCache = new Map();
const blockPreviewMaterialCache = new Map();
const deadDissolveMaterialCache = new Map();
const deadBlockMaterial = new THREE.MeshStandardMaterial({
  color: "#7e8892",
  map: createProceduralBlockTexture("#7e8892", { noiseCells: 440 }),
  roughness: 0.62,
  metalness: 0.04,
});
const deadDestroyableBlockMaterial = new THREE.MeshStandardMaterial({
  color: "#9aa5af",
  map: createProceduralBlockTexture("#9aa5af", { noiseCells: 460, panelStrokeAlpha: 0.28 }),
  roughness: 0.58,
  metalness: 0.05,
});
const playerMaterialCache = new Map();
const blockMeshes = new Map();
const playerMeshes = new Map();
const projectileMeshes = new Map();
const explosionVisuals = new Map();
const explosionVisualPool = {
  normal: [],
  enemy: [],
};
const previewDestroyedBlockKeys = new Set();
let renderedBlocks = [];
let renderedDestroyableKeys = new Set();
let blockRenderDirty = true;
let blockMaterialDirty = true;
let lastAlivePlayerSignature = "";
const blockOwnerVisualOffsets = new Map();
const lastPileOffsetsByOwner = new Map();
let hasActiveBlockVisualOffsets = false;
const deadOwnerDissolveStartById = new Map();
const ownerTopTargetInfoById = new Map();
let ownerTopTargetInfoDirty = true;

const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
const shotTargetPoint = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraGoal = new THREE.Vector3();
const arenaCenter = new THREE.Vector3();
const playerVisualTarget = new THREE.Vector3();
const zeroVector = new THREE.Vector3();
const atmosphericForward = new THREE.Vector3();
const atmosphericRight = new THREE.Vector3();
const atmosphericUp = new THREE.Vector3();
const atmosphericOffset = new THREE.Vector3();
const atmosphericParticles = [];
const enemyModelLoader = new GLTFLoader();

const cameraState = {
  yaw: -0.78,
  pitch: 1.15,
  distance: 15 * WORLD_SCALE,
};

const shotState = {
  charging: false,
  power: MIN_SHOT_POWER,
  angle: THREE.MathUtils.lerp(MIN_SHOT_ANGLE, MAX_SHOT_ANGLE, DEFAULT_ARC_CONTROL),
  arcControl: DEFAULT_ARC_CONTROL,
};

const shotPreviewLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: "#ffd089", transparent: true, opacity: 0.75 }),
);
shotPreviewLine.visible = false;
previewGroup.add(shotPreviewLine);

const previewDots = Array.from({ length: 40 }, () => {
  const dot = new THREE.Mesh(
    previewDotGeometry,
    new THREE.MeshBasicMaterial({ color: "#ffd089", transparent: true, opacity: 0.9 }),
  );
  dot.visible = false;
  previewGroup.add(dot);
  return dot;
});

const landingMarker = new THREE.Mesh(
  landingMarkerGeometry,
  new THREE.MeshBasicMaterial({ color: "#ffd089", transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
);
landingMarker.rotation.x = -Math.PI / 2;
landingMarker.visible = false;
previewGroup.add(landingMarker);

const atmosphericTNTParticles = [];

for (let index = 0; index < 180; index += 1) {
  // Create regular stars only (no TNT blocks in gameplay starfield)
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(Math.random() * 0.08 + 0.04, 8, 8),
    new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? "#c7efff" : "#ffbc83" }),
  );

  particle.position.set(
    (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
    Math.random() * 24 + 16,
    (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
  );
  particle.userData.prestartSpeed = THREE.MathUtils.lerp(
    ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN,
    ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MAX,
    Math.random(),
  );
  decorationGroup.add(particle);
  atmosphericParticles.push(particle);
}

// Create TNT blocks separately for pregame starfield
for (let index = 0; index < 35; index += 1) {
  const tntScale = 0.5;
  const tntTexture = createTNTStarfieldTexture();
  const particle = new THREE.Mesh(
    starfieldTNTGeometry,
    new THREE.MeshBasicMaterial({
      map: tntTexture,
    }),
  );
  particle.scale.set(tntScale, tntScale, tntScale);
  particle.userData.isTNTBlock = true;
  particle.visible = false;

  particle.position.set(
    (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
    Math.random() * 24 + 16,
    (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
  );
  particle.userData.prestartSpeed = THREE.MathUtils.lerp(
    ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN,
    ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MAX,
    Math.random(),
  );
  decorationGroup.add(particle);
  atmosphericTNTParticles.push(particle);
}

const inputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jumpQueued: false,
};

let world = null;
let projectiles = [];
let explosions = [];
let scorePopups = [];
let scorePopupPool = [];
let enemyModelTemplate = null;
let enemyModelLoadingStarted = false;
let enemyModelLoadFailed = false;
let enemyModelLoadFailures = [];
let pendingEnemyVisualRefresh = false;
const liveExplosionOptions = Object.freeze({
  criticalHitChance: CRITICAL_HIT_CHANCE,
  criticalHitMinBlocks: CRITICAL_HIT_MIN_BLOCKS,
  criticalHitMaxBlocks: CRITICAL_HIT_MAX_BLOCKS,
});
let nextProjectileId = 1;
let nextExplosionId = 1;
let nextTntTime = 0;
let holdFireActive = false;
let nextHoldFireTime = 0;
let nextShotPreviewRecomputeAt = 0;
let nextAimPointUpdateAt = 0;
let botNextThrow = {};
let botMoveStateById = {};
let blockBucketsByOwner = new Map();
let blockBucketsTick = -1;
let blockBucketsSource = null;
let roundStartedAt = 0;
let playerHasFired = false;
let currentLevel = 1;
let levelSequenceState = null;
let gamePaused = true;
let gameHasStarted = false;
let lastFrameTime = performance.now();
let accumulator = 0;
let fpsSampleSeconds = 0;
let fpsSampleFrames = 0;
let gridScrollPrimaryX = 0;
let gridScrollPrimaryZ = 0;
let gridScrollSecondaryX = 0;
let gridScrollSecondaryZ = 0;
let lastStatusHtml = "";
let lastScoreText = "";
let lastHighScoreText = "";
let lastModeHtml = "";
let lastCooldownHtml = "";
let nextHudUpdateAtSeconds = 0;
let lastLeaderboardMarkup = "";
let lastLeaderboardStatusText = "";
let currentScore = 0;
let highScore = 0;
let leaderboardEntries = [];
let leaderboardFetchInFlight = false;
let leaderboardSubmitInFlight = false;
let leaderboardStatusText = "Loading leaderboard...";
let leaderboardFeedbackText = "";
let leaderboardQualifyingScore = null;
let leaderboardSubmittedScore = null;
let nextLeaderboardRefreshAt = 0;
// Session state as a single replaceable object; null means no active session.
// Shape when active: { id, token, trackedScore, startedAtMs, syncQueue }
let leaderboardSession = null;
let leaderboardPendingScoreDelta = 0;
let leaderboardSessionStartInFlight = null;
let leaderboardSessionStartRetryAtMs = 0;
let audioContext = null;
let masterGainNode = null;
let sfxGainNode = null;
let noiseBuffer = null;
let bgmGainNode = null;
let bgmStarted = false;
let bgmStep = 0;
let bgmNextTime = 0;
let bgmMuted = false;
let masterVolumeLevel = MASTER_DEFAULT_VOLUME;
let bgmVolumeLevel = MUSIC_DEFAULT_VOLUME;
let sfxVolumeLevel = SFX_DEFAULT_VOLUME;
const bgmBassSemitones = [0, 3, 7, 10, 0, 5, 7, 10, 0, 3, 8, 10, 0, 5, 8, 12];
const bgmLeadSemitones = [12, 10, 8, 10, 12, 15, 14, 12, 10, 8, 10, 12, 14, 15, 17, 15];

function loadAudioSettings() {
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed.masterVolumeLevel)) {
      masterVolumeLevel = THREE.MathUtils.clamp(parsed.masterVolumeLevel, 0, 1);
    }
    if (Number.isFinite(parsed.bgmVolumeLevel)) {
      bgmVolumeLevel = THREE.MathUtils.clamp(parsed.bgmVolumeLevel, 0, 1);
    }
    if (Number.isFinite(parsed.sfxVolumeLevel)) {
      sfxVolumeLevel = THREE.MathUtils.clamp(parsed.sfxVolumeLevel, 0, 1);
    }
    if (typeof parsed.bgmMuted === "boolean") {
      bgmMuted = parsed.bgmMuted;
    }
  } catch {
    // Ignore corrupt/blocked storage.
  }
}

function persistAudioSettings() {
  try {
    window.localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        masterVolumeLevel,
        bgmVolumeLevel,
        sfxVolumeLevel,
        bgmMuted,
      }),
    );
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }

  audioContext = new AudioCtx();
  masterGainNode = audioContext.createGain();
  masterGainNode.gain.value = MASTER_BASE_GAIN * masterVolumeLevel;
  masterGainNode.connect(audioContext.destination);

  sfxGainNode = audioContext.createGain();
  sfxGainNode.gain.value = sfxVolumeLevel;
  sfxGainNode.connect(masterGainNode);

  bgmGainNode = audioContext.createGain();
  bgmGainNode.gain.value = 0;
  bgmGainNode.connect(masterGainNode);
  return audioContext;
}

function loadHighScore() {
  try {
    const stored = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const value = Number(stored);
    highScore = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    highScore = 0;
  }
}

function persistHighScore() {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(highScore));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

function getLeaderboardApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = LEADERBOARD_API_BASE_URL.replace(/\/+$/, "");
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function normalizeInitials(rawValue) {
  return String(rawValue ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, LEADERBOARD_INITIALS_MAX_LENGTH);
}

function isInitialsAllowed(initials) {
  return initials.length >= 1 && initials.length <= LEADERBOARD_INITIALS_MAX_LENGTH && !LEADERBOARD_BLOCKED_INITIALS.has(initials);
}

function scoreQualifiesForLeaderboard(score) {
  if (!Number.isFinite(score) || score <= 0) {
    return false;
  }

  if (leaderboardEntries.length < LEADERBOARD_MAX_ENTRIES) {
    return true;
  }

  const cutoffScore = leaderboardEntries[leaderboardEntries.length - 1]?.score ?? 0;
  return score >= cutoffScore;
}

function clearLeaderboardSession() {
  leaderboardSession = null;
  leaderboardPendingScoreDelta = 0;
  leaderboardSessionStartInFlight = null;
  leaderboardSessionStartRetryAtMs = 0;
}

function waitMilliseconds(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = LEADERBOARD_REQUEST_TIMEOUT_MS) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: abortController.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Leaderboard request timed out. Check server/network and retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function startLeaderboardSession() {
  if (leaderboardSessionStartInFlight) {
    return leaderboardSessionStartInFlight;
  }

  const startPromise = (async () => {
    leaderboardSession = null;

    const { response, payload } = await fetchJsonWithTimeout(getLeaderboardApiUrl("/api/leaderboard/session/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error ?? "Unable to start score session.");
    }

    if (typeof payload?.sessionId !== "string" || typeof payload?.token !== "string") {
      throw new Error("Invalid score session response.");
    }

    leaderboardSession = {
      id: payload.sessionId,
      token: payload.token,
      trackedScore: 0,
      startedAtMs: Date.now(),
      syncQueue: Promise.resolve(),
    };

    if (leaderboardPendingScoreDelta > 0) {
      const pendingDelta = leaderboardPendingScoreDelta;
      leaderboardPendingScoreDelta = 0;
      queueLeaderboardScoreDelta(pendingDelta);
    }
  })();

  leaderboardSessionStartInFlight = startPromise;

  try {
    await startPromise;
  } finally {
    leaderboardSessionStartInFlight = null;
  }
}

function queueLeaderboardScoreDelta(delta) {
  const normalizedDelta = Math.floor(Number(delta));
  if (!Number.isFinite(normalizedDelta) || normalizedDelta <= 0) {
    return;
  }

  if (!leaderboardSession) {
    leaderboardPendingScoreDelta += normalizedDelta;
    if (Date.now() < leaderboardSessionStartRetryAtMs) {
      return;
    }
    void startLeaderboardSession().catch(() => {
      leaderboardSessionStartRetryAtMs = Date.now() + 3000;
      // Session startup failures are surfaced later if score submission is attempted.
    });
    return;
  }

  // Capture the current session object so the async chain below can detect staleness
  // even if leaderboardSession is replaced concurrently (e.g. due to a reset).
  const session = leaderboardSession;
  const isCurrentSession = () => leaderboardSession === session;
  const chunks = [];
  let remaining = normalizedDelta;

  while (remaining > 0) {
    const chunk = Math.min(LEADERBOARD_SCORE_UPDATE_MAX_DELTA, remaining);
    chunks.push(chunk);
    remaining -= chunk;
  }

  session.syncQueue = session.syncQueue
    .then(async () => {
      for (const chunk of chunks) {
        if (!isCurrentSession()) {
          return;
        }

        const expectedScoreAfterChunk = session.trackedScore + chunk;
        const minElapsedMs = Math.ceil((expectedScoreAfterChunk / LEADERBOARD_SCORE_UPDATE_MAX_PER_SECOND) * 1000);
        const elapsedMs = Date.now() - session.startedAtMs;
        if (elapsedMs < minElapsedMs) {
          await waitMilliseconds(minElapsedMs - elapsedMs + 6);
        }

        let chunkSynced = false;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const { response, payload } = await fetchJsonWithTimeout(getLeaderboardApiUrl("/api/leaderboard/session/update"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: session.id,
              token: session.token,
              delta: chunk,
            }),
          });

          if (response.ok && payload?.ok !== false) {
            if (Number.isFinite(Number(payload?.trackedScore))) {
              session.trackedScore = Math.floor(Number(payload.trackedScore));
            } else {
              session.trackedScore = expectedScoreAfterChunk;
            }
            chunkSynced = true;
            break;
          }

          const serverError = String(payload?.error ?? "");
          const isGrowthLimitError = /score growth exceeded gameplay limits/i.test(serverError);
          if (!isGrowthLimitError || attempt >= 1) {
            throw new Error(serverError || "Failed to sync score update.");
          }

          await waitMilliseconds(120);
        }

        if (!chunkSynced) {
          throw new Error("Failed to sync score update.");
        }
      }
    })
    .catch(() => {
      if (isCurrentSession()) {
        clearLeaderboardSession();
      }
    });
}

function renderLeaderboard() {
  if (leaderboardStatus && leaderboardStatusText !== lastLeaderboardStatusText) {
    leaderboardStatus.textContent = leaderboardStatusText;
    lastLeaderboardStatusText = leaderboardStatusText;
  }

  if (!leaderboardList) {
    return;
  }

  const leaderboardMarkup = leaderboardEntries
    .map(
      (entry, index) => `<li><span class="leaderboard-rank">${index + 1}.</span><strong>${entry.initials}</strong><span class="leaderboard-score">${entry.score}</span><span class="leaderboard-level">${entry.level ?? "&mdash;"}</span></li>`,
    )
    .join("");

  if (leaderboardMarkup !== lastLeaderboardMarkup) {
    leaderboardList.innerHTML = leaderboardMarkup;
    lastLeaderboardMarkup = leaderboardMarkup;
  }
}

function setInitialsFeedback(message) {
  leaderboardFeedbackText = message;
  if (initialsFeedback) {
    initialsFeedback.textContent = message;
  }
}

function hideInitialsForm() {
  if (initialsForm) {
    initialsForm.classList.add("hidden");
  }
}

function showInitialsForm() {
  if (initialsForm) {
    initialsForm.classList.remove("hidden");
  }
}

function parseLeaderboardPayload(payload) {
  if (!Array.isArray(payload?.entries)) {
    return [];
  }

  return payload.entries
    .map((entry) => ({
      initials: normalizeInitials(entry?.initials),
      score: Number.isFinite(Number(entry?.score)) ? Math.floor(Number(entry.score)) : null,
      level: Number.isFinite(Number(entry?.level)) && Number(entry.level) >= 1
        ? Math.floor(Number(entry.level))
        : null,
    }))
    .filter((entry) => entry.initials.length > 0 && entry.score != null && entry.score >= 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

async function fetchLeaderboard() {
  if (leaderboardFetchInFlight) {
    return;
  }

  leaderboardFetchInFlight = true;

  try {
    const { response, payload } = await fetchJsonWithTimeout(getLeaderboardApiUrl("/api/leaderboard"));
    if (!response.ok) {
      throw new Error(`Leaderboard request failed with ${response.status}`);
    }

    leaderboardEntries = parseLeaderboardPayload(payload);
    leaderboardStatusText = leaderboardEntries.length > 0
      ? "Top pilots this season"
      : "No scores yet. Be the first.";
    // Do NOT reset leaderboardQualifyingScore here — that would cause updateMatchBanner()
    // to wipe the initials input mid-entry on the next animation frame.
  } catch {
    leaderboardStatusText = "Leaderboard unavailable";
  } finally {
    leaderboardFetchInFlight = false;
    nextLeaderboardRefreshAt = performance.now() + LEADERBOARD_REFRESH_INTERVAL_MS;
    renderLeaderboard();
  }
}

async function submitLeaderboardEntry(initials, score, level) {
  if (leaderboardSubmitInFlight) {
    return;
  }

  leaderboardSubmitInFlight = true;
  if (initialsSubmit) {
    initialsSubmit.disabled = true;
  }
  if (bannerAction) {
    bannerAction.disabled = true;
  }
  setInitialsFeedback("Submitting score...");

  const targetScore = Math.max(0, Math.floor(Number(score) || 0));
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));

  const ensureSessionAndTrackedScore = async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (leaderboardSession) {
        await leaderboardSession.syncQueue;
      }

      if (!leaderboardSession) {
        try {
          await startLeaderboardSession();
          // startLeaderboardSession drains leaderboardPendingScoreDelta onto session.syncQueue
          // but returns before those updates resolve. Await the queue now so trackedScore
          // reflects reality before we do the equality check below.
          if (leaderboardSession) {
            await leaderboardSession.syncQueue;
          }
        } catch {
          continue;
        }
      }

      if (!leaderboardSession) {
        continue;
      }

      if (leaderboardPendingScoreDelta > 0) {
        const pendingDelta = leaderboardPendingScoreDelta;
        leaderboardPendingScoreDelta = 0;
        queueLeaderboardScoreDelta(pendingDelta);
        if (leaderboardSession) {
          await leaderboardSession.syncQueue;
        }
      }

      if (!leaderboardSession) {
        continue;
      }

      if (leaderboardSession.trackedScore < targetScore) {
        queueLeaderboardScoreDelta(targetScore - leaderboardSession.trackedScore);
        if (leaderboardSession) {
          await leaderboardSession.syncQueue;
        }
      }

      if (leaderboardSession && leaderboardSession.trackedScore === targetScore) {
        return true;
      }
    }

    return false;
  };

  const sessionReady = await ensureSessionAndTrackedScore();
  if (!sessionReady || !leaderboardSession) {
    setInitialsFeedback("Score session expired. Press submit again or start a new run.");
    leaderboardSubmitInFlight = false;
    if (initialsSubmit) {
      initialsSubmit.disabled = false;
    }
    if (bannerAction) {
      bannerAction.disabled = false;
    }
    return;
  }

  // Capture session reference for the submit call; use targetScore (normalized) to match tracked score.
  const sessionForSubmit = leaderboardSession;

  try {
    const { response, payload } = await fetchJsonWithTimeout(getLeaderboardApiUrl("/api/leaderboard/submit"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initials,
        score: targetScore,
        level: targetLevel,
        sessionId: sessionForSubmit.id,
        token: sessionForSubmit.token,
      }),
    });

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error ?? "Failed to submit score.");
    }

    leaderboardEntries = parseLeaderboardPayload(payload);
    leaderboardStatusText = leaderboardEntries.length > 0
      ? "Top pilots this season"
      : "No scores yet. Be the first.";
    if (payload?.qualified === false) {
      // Score no longer qualifies — the form should vanish and not return.
      // Set qualifyingScore to currentScore (not null) so updateMatchBanner's
      // staleness guard doesn't fire and immediately wipe our feedback message.
      leaderboardQualifyingScore = currentScore;
      leaderboardSubmittedScore = currentScore;
      hideInitialsForm();
      setInitialsFeedback("Score no longer qualifies for top 10.");
      renderLeaderboard();
      void fetchLeaderboard();
      return;
    }

    leaderboardSubmittedScore = targetScore;
    // Do NOT set leaderboardQualifyingScore = null here. It should remain at currentScore
    // so updateMatchBanner's staleness guard does NOT fire and wipe the feedback on the
    // very next animation frame. eligibleForLeaderboard will be false because
    // leaderboardSubmittedScore === currentScore, keeping the form hidden.
    clearLeaderboardSession(); // Server marks session consumed; clear so future attempts start fresh.
    hideInitialsForm();
    setInitialsFeedback("");
    renderLeaderboard();
    void fetchLeaderboard();
  } catch (error) {
    setInitialsFeedback(error instanceof Error ? error.message : "Failed to submit score.");
  } finally {
    leaderboardSubmitInFlight = false;
    if (initialsSubmit) {
      initialsSubmit.disabled = false;
    }
    if (bannerAction) {
      setTimeout(() => {
        if (bannerAction) {
          bannerAction.disabled = false;
        }
      }, 350);
    }
  }
}

function triggerLeaderboardTestShortcut() {
  if (!LEADERBOARD_TEST_SHORTCUT_ENABLED || !world) {
    return;
  }

  if (world.match.status === "finished") {
    resetGame({ preserveLevel: true });
  }

  const cutoffScore = leaderboardEntries.length < LEADERBOARD_MAX_ENTRIES
    ? 1
    : (leaderboardEntries[leaderboardEntries.length - 1]?.score ?? 0) + 1;
  const targetScore = Math.max(1, cutoffScore);
  const scoreDelta = Math.max(0, targetScore - currentScore);

  if (scoreDelta > 0) {
    currentScore += scoreDelta;
    queueLeaderboardScoreDelta(scoreDelta);
    if (currentScore > highScore) {
      highScore = currentScore;
      persistHighScore();
    }
  }

  const localPlayer = getLocalPlayer();
  if (!localPlayer) {
    return;
  }

  localPlayer.alive = false;
  gameHasStarted = true;
  gamePaused = true;
  levelSequenceState = null;
  leaderboardSubmittedScore = null;
  setInitialsFeedback("Test shortcut active: enter initials to verify leaderboard submit.");
  updateMatchBanner();
  setInteractionMode();
}

function releaseScorePopup(popup) {
  scorePopupGroup.remove(popup.sprite);
  popup.sprite.material.opacity = 0;
  scorePopupPool.push(popup.sprite);
}

function acquireScorePopupSprite() {
  const sprite = scorePopupPool.pop() ?? new THREE.Sprite(baseScorePopupMaterial.clone());
  sprite.scale.set(1.9 * WORLD_SCALE, 0.96 * WORLD_SCALE, 1);
  sprite.material.opacity = 1;
  return sprite;
}

function spawnScorePopup(position) {
  if (scorePopups.length >= MAX_ACTIVE_SCORE_POPUPS) {
    const oldestPopup = scorePopups.shift();
    if (oldestPopup) {
      releaseScorePopup(oldestPopup);
    }
  }

  const sprite = acquireScorePopupSprite();
  sprite.position.set(
    toRenderUnits(position.x),
    toRenderUnits(position.y + 0.9),
    toRenderUnits(position.z),
  );
  scorePopupGroup.add(sprite);
  scorePopups.push({
    sprite,
    age: 0,
    startY: sprite.position.y,
  });
}

function updateScorePopups(deltaSeconds) {
  for (let index = scorePopups.length - 1; index >= 0; index -= 1) {
    const popup = scorePopups[index];
    popup.age += deltaSeconds;
    const progress = popup.age / SCORE_POPUP_DURATION_SECONDS;

    if (progress >= 1) {
      releaseScorePopup(popup);
      scorePopups.splice(index, 1);
      continue;
    }

    const riseProgress = 1 - Math.pow(1 - progress, 1.8);
    const fadeProgress = Math.max(
      0,
      (progress - SCORE_POPUP_FADE_DELAY_PROGRESS) / (1 - SCORE_POPUP_FADE_DELAY_PROGRESS),
    );
    popup.sprite.position.y = popup.startY + toRenderUnits(SCORE_POPUP_RISE_DISTANCE * riseProgress);
    popup.sprite.material.opacity = 1 - fadeProgress;
  }
}

function awardDestroyedBlocksScore(ownerId, destroyedBlocks) {
  if (ownerId !== LOCAL_PLAYER_ID || !Array.isArray(destroyedBlocks) || destroyedBlocks.length === 0) {
    return;
  }

  for (const block of destroyedBlocks) {
    spawnScorePopup(block);
  }

  currentScore += destroyedBlocks.length;
  queueLeaderboardScoreDelta(destroyedBlocks.length);

  if (currentScore > highScore) {
    highScore = currentScore;
    persistHighScore();
  }
}

function getEffectiveMusicGain() {
  return bgmMuted ? 0 : bgmVolumeLevel * MUSIC_MAX_GAIN_MULTIPLIER;
}

function applyMasterGain(time = null) {
  if (!masterGainNode || !audioContext) {
    return;
  }

  const at = time ?? audioContext.currentTime;
  masterGainNode.gain.cancelScheduledValues(at);
  masterGainNode.gain.setTargetAtTime(MASTER_BASE_GAIN * masterVolumeLevel, at, 0.03);
}

function applyMusicGain(time = null) {
  if (!bgmGainNode || !audioContext) {
    return;
  }

  const at = time ?? audioContext.currentTime;
  bgmGainNode.gain.cancelScheduledValues(at);
  bgmGainNode.gain.setTargetAtTime(getEffectiveMusicGain(), at, 0.03);
}

function applySfxGain(time = null) {
  if (!sfxGainNode || !audioContext) {
    return;
  }

  const at = time ?? audioContext.currentTime;
  sfxGainNode.gain.cancelScheduledValues(at);
  sfxGainNode.gain.setTargetAtTime(bgmMuted ? 0 : sfxVolumeLevel, at, 0.03);
}

function updateMusicUi() {
  if (allVolume) {
    allVolume.value = String(Math.round(masterVolumeLevel * 100));
  }
  if (musicVolume) {
    musicVolume.value = String(Math.round(bgmVolumeLevel * 100));
  }
  if (sfxVolume) {
    sfxVolume.value = String(Math.round(sfxVolumeLevel * 100));
  }
  if (musicMute) {
    musicMute.textContent = bgmMuted ? "🔇" : "🔊";
    musicMute.setAttribute("aria-label", bgmMuted ? "Unmute audio" : "Mute audio");
  }
  if (musicState) {
    if (!bgmStarted) {
      musicState.textContent = "Psytrance bed ready · press any key/click to start audio";
    } else if (bgmMuted) {
      musicState.textContent = "Music muted";
    } else {
      musicState.textContent = `Music playing · volume ${Math.round(bgmVolumeLevel * 100)}%`;
    }
  }
}

function setMusicMuted(nextMuted) {
  bgmMuted = nextMuted;
  applyMusicGain();
  applySfxGain();
  persistAudioSettings();
  updateMusicUi();
}

function setMasterVolume(nextVolume) {
  masterVolumeLevel = THREE.MathUtils.clamp(nextVolume, 0, 1);
  applyMasterGain();
  persistAudioSettings();
  updateMusicUi();
}

function setMusicVolume(nextVolume) {
  bgmVolumeLevel = THREE.MathUtils.clamp(nextVolume, 0, 1);
  applyMusicGain();
  persistAudioSettings();
  updateMusicUi();
}

function setSfxVolume(nextVolume) {
  sfxVolumeLevel = THREE.MathUtils.clamp(nextVolume, 0, 1);
  applySfxGain();
  persistAudioSettings();
  updateMusicUi();
}

function midiToFrequency(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function playKickAt(time) {
  if (!audioContext || !bgmGainNode) {
    return;
  }

  const osc = audioContext.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(148, time);
  osc.frequency.exponentialRampToValueAtTime(44, time + 0.09);

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.7, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

  osc.connect(gain);
  gain.connect(bgmGainNode);
  osc.start(time);
  osc.stop(time + 0.16);
}

function playHatAt(time) {
  if (!audioContext || !bgmGainNode) {
    return;
  }

  const buffer = getNoiseBuffer();
  if (!buffer) {
    return;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const bandPass = audioContext.createBiquadFilter();
  bandPass.type = "highpass";
  bandPass.frequency.setValueAtTime(6200, time);

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.12, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

  source.connect(bandPass);
  bandPass.connect(gain);
  gain.connect(bgmGainNode);
  source.start(time);
  source.stop(time + 0.05);
}

function playClapAt(time) {
  if (!audioContext || !bgmGainNode) {
    return;
  }

  const buffer = getNoiseBuffer();
  if (!buffer) {
    return;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const bandPass = audioContext.createBiquadFilter();
  bandPass.type = "bandpass";
  bandPass.frequency.setValueAtTime(1700, time);
  bandPass.Q.value = 0.9;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.2, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

  source.connect(bandPass);
  bandPass.connect(gain);
  gain.connect(bgmGainNode);
  source.start(time);
  source.stop(time + 0.16);
}

function playBassAt(time, frequency, duration) {
  if (!audioContext || !bgmGainNode) {
    return;
  }

  const osc = audioContext.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(frequency, time);

  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(380, time);
  filter.frequency.exponentialRampToValueAtTime(980, time + 0.05);
  filter.frequency.exponentialRampToValueAtTime(300, time + duration);
  filter.Q.value = 8;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.16, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGainNode);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playLeadAt(time, frequency, duration) {
  if (!audioContext || !bgmGainNode) {
    return;
  }

  const osc = audioContext.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, time);

  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1400, time);
  filter.Q.value = 4;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.08, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bgmGainNode);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduleBackgroundMusic() {
  if (!audioContext || !bgmStarted) {
    return;
  }

  const stepDuration = 60 / MUSIC_TEMPO_BPM / 4;
  const scheduleAhead = audioContext.currentTime + 0.2;
  const maxStepsPerFrame = 24;

  // If we ever fall too far behind (tab throttling, debugger pauses, frame hitch),
  // skip backlog instead of generating hundreds/thousands of queued nodes in one frame.
  if (bgmNextTime < audioContext.currentTime - 1) {
    bgmNextTime = audioContext.currentTime + 0.02;
  }

  let scheduledSteps = 0;

  while (bgmNextTime < scheduleAhead && scheduledSteps < maxStepsPerFrame) {
    const stepInBar = bgmStep % 16;

    if (stepInBar % 4 === 0) {
      playKickAt(bgmNextTime);
    }

    if (stepInBar % 2 === 1) {
      playHatAt(bgmNextTime);
    }

    if (stepInBar === 4 || stepInBar === 12) {
      playClapAt(bgmNextTime);
    }

    const bassRootMidi = 38;
    const bassMidi = bassRootMidi + bgmBassSemitones[stepInBar % bgmBassSemitones.length];
    playBassAt(bgmNextTime, midiToFrequency(bassMidi), stepDuration * 1.55);

    if (stepInBar % 2 === 0) {
      const leadRootMidi = 50;
      const leadMidi = leadRootMidi + bgmLeadSemitones[stepInBar % bgmLeadSemitones.length];
      playLeadAt(bgmNextTime, midiToFrequency(leadMidi), stepDuration * 1.2);
    }

    bgmStep += 1;
    bgmNextTime += stepDuration;
    scheduledSteps += 1;
  }
}

function startBackgroundMusic() {
  if (!audioContext || bgmStarted) {
    return;
  }

  bgmStarted = true;
  bgmStep = 0;
  bgmNextTime = audioContext.currentTime + 0.05;
  applyMasterGain(audioContext.currentTime);
  applySfxGain(audioContext.currentTime);
  applyMusicGain(audioContext.currentTime);
  updateMusicUi();
}

function ensureAudioUnlocked() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startIfReady = () => {
    startBackgroundMusic();
    applyMasterGain();
    applySfxGain();
    applyMusicGain();
    updateMusicUi();
  };

  if (context.state === "suspended") {
    context.resume().then(startIfReady).catch(() => {});
    return;
  }

  startIfReady();
}

function getNoiseBuffer() {
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) {
    return noiseBuffer;
  }

  const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  noiseBuffer = buffer;
  return noiseBuffer;
}

function playShotSound() {
  const context = getAudioContext();
  if (!context || !sfxGainNode) {
    return;
  }

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.23, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
  gain.connect(sfxGainNode);

  const osc = context.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(340 + Math.random() * 60, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.15);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.18);

  const transient = context.createOscillator();
  transient.type = "triangle";
  transient.frequency.setValueAtTime(760 + Math.random() * 120, now);
  transient.frequency.exponentialRampToValueAtTime(210, now + 0.06);

  const transientGain = context.createGain();
  transientGain.gain.setValueAtTime(0.0001, now);
  transientGain.gain.exponentialRampToValueAtTime(0.16, now + 0.005);
  transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  transient.connect(transientGain);
  transientGain.connect(sfxGainNode);
  transient.start(now);
  transient.stop(now + 0.09);
}

function playExplosionSound(intensity = 1) {
  const context = getAudioContext();
  const buffer = getNoiseBuffer();
  if (!context || !buffer || !sfxGainNode) {
    return;
  }

  const now = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800 * intensity, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + 0.3);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.34 * intensity, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGainNode);
  source.start(now);
  source.stop(now + 0.4);

  const boom = context.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(90, now);
  boom.frequency.exponentialRampToValueAtTime(42, now + 0.24);

  const boomGain = context.createGain();
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.exponentialRampToValueAtTime(0.2 * intensity, now + 0.015);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  boom.connect(boomGain);
  boomGain.connect(sfxGainNode);
  boom.start(now);
  boom.stop(now + 0.3);
}

function getBlockMaterial(ownerId) {
  if (!blockMaterialCache.has(ownerId)) {
    const baseColor = PLAYER_COLORS[ownerId] ?? "#aaaaaa";
    blockMaterialCache.set(
      ownerId,
      new THREE.MeshStandardMaterial({
        color: baseColor,
        map: createProceduralBlockTexture(baseColor),
        roughness: 0.55,
        metalness: 0.12,
      }),
    );
  }

  return blockMaterialCache.get(ownerId);
}

function getDestroyableBlockMaterial(ownerId) {
  if (!destroyableBlockMaterialCache.has(ownerId)) {
    const base = new THREE.Color(PLAYER_COLORS[ownerId] ?? "#aaaaaa");
    const tinted = base.clone().offsetHSL(0, -0.03, 0.08);
    destroyableBlockMaterialCache.set(
      ownerId,
      new THREE.MeshStandardMaterial({
        color: tinted,
        map: createProceduralBlockTexture(`#${tinted.getHexString()}`, { panelStrokeAlpha: 0.28 }),
        roughness: 0.5,
        metalness: 0.14,
      }),
    );
  }

  return destroyableBlockMaterialCache.get(ownerId);
}

function toRenderUnits(value) {
  return value * WORLD_SCALE;
}

function toSimulationUnits(value) {
  return value / WORLD_SCALE;
}

function getPreviewBlockMaterial(ownerId) {
  if (!blockPreviewMaterialCache.has(ownerId)) {
    const baseColor = PLAYER_COLORS[ownerId] ?? "#aaaaaa";
    blockPreviewMaterialCache.set(
      ownerId,
      new THREE.MeshStandardMaterial({
        color: baseColor,
        map: createProceduralBlockTexture(baseColor, { noiseCells: 360 }),
        emissive: "#ffd089",
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.58,
        roughness: 0.45,
        metalness: 0.08,
      }),
    );
  }

  return blockPreviewMaterialCache.get(ownerId);
}

function getDeadDissolveMaterial(ownerId, isDestroyable) {
  const key = `${ownerId}:${isDestroyable ? 1 : 0}`;

  if (!deadDissolveMaterialCache.has(key)) {
    const material = (isDestroyable ? deadDestroyableBlockMaterial : deadBlockMaterial).clone();
    material.transparent = true;
    material.depthWrite = true;
    material.depthTest = true;
    material.alphaTest = 0.02;
    material.opacity = 1;
    deadDissolveMaterialCache.set(key, material);
  }

  return deadDissolveMaterialCache.get(key);
}

function markBlocksDirty() {
  blockRenderDirty = true;
  blockMaterialDirty = true;
  ownerTopTargetInfoDirty = true;
}

function markBlockMaterialsDirty() {
  blockMaterialDirty = true;
}

function analyzeRenderableBlocks(blocks) {
  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const blockKeys = new Set(blocks.map((block) => getBlockKey(block.x, block.y, block.z)));
  const visibleKeys = new Set();
  const destroyableKeys = new Set();
  const visibleBlocks = [];

  for (const block of blocks) {
    let exposedFaces = 0;

    for (const [dx, dy, dz] of neighbors) {
      if (!blockKeys.has(getBlockKey(block.x + dx, block.y + dy, block.z + dz))) {
        exposedFaces += 1;
      }
    }

    if (exposedFaces > 0) {
      visibleKeys.add(getBlockKey(block.x, block.y, block.z));
      visibleBlocks.push(block);
    }

    if (exposedFaces >= 2) {
      destroyableKeys.add(getBlockKey(block.x, block.y, block.z));
    }
  }

  return {
    visibleBlocks,
    visibleKeys,
    destroyableKeys,
  };
}

function rebuildOwnerTopTargetInfoCache() {
  ownerTopTargetInfoById.clear();

  for (const block of world.blocks) {
    const existing = ownerTopTargetInfoById.get(block.ownerId);

    if (!existing) {
      ownerTopTargetInfoById.set(block.ownerId, {
        highestY: block.y,
        topBlocks: [block],
      });
      continue;
    }

    if (block.y > existing.highestY) {
      existing.highestY = block.y;
      existing.topBlocks = [block];
      continue;
    }

    if (block.y === existing.highestY) {
      existing.topBlocks.push(block);
    }
  }

  for (const info of ownerTopTargetInfoById.values()) {
    const topCenterX = info.topBlocks.reduce((sum, block) => sum + block.x, 0) / info.topBlocks.length;
    const topCenterZ = info.topBlocks.reduce((sum, block) => sum + block.z, 0) / info.topBlocks.length;
    const coreTopBlocks = info.topBlocks.filter(
      (block) =>
        Math.abs(block.x - topCenterX) <= 1 &&
        Math.abs(block.z - topCenterZ) <= 1,
    );

    info.topCenterX = topCenterX;
    info.topCenterZ = topCenterZ;
    info.coreTopBlocks = coreTopBlocks.length > 0 ? coreTopBlocks : info.topBlocks;
  }

  ownerTopTargetInfoDirty = false;
}

function getAlivePlayerSignature() {
  return world.players.map((player) => (player.alive ? player.playerId : "")).join("|");
}

function didPileMotionStepOccur() {
  const interval = world?.config.aiPileMotionStepIntervalTicks;

  return Boolean(
    world?.config.aiPileMotionEnabled &&
    Number.isFinite(interval) &&
    interval > 0 &&
    world.tick % interval === 0,
  );
}

function clearPreviewDestroyedBlocks() {
  previewDestroyedBlockKeys.clear();
  markBlockMaterialsDirty();
}

function setPreviewDestroyedBlocks(blocks) {
  previewDestroyedBlockKeys.clear();

  for (const block of blocks) {
    previewDestroyedBlockKeys.add(`${block.x}:${block.y}:${block.z}`);
  }

  markBlockMaterialsDirty();
}

function getPlayerMaterial(ownerId) {
  if (!playerMaterialCache.has(ownerId)) {
    playerMaterialCache.set(
      ownerId,
      new THREE.MeshStandardMaterial({
        color: PLAYER_COLORS[ownerId] ?? "#ffffff",
        emissive: PLAYER_COLORS[ownerId] ?? "#ffffff",
        emissiveIntensity: ownerId === LOCAL_PLAYER_ID ? 0.18 : 0.08,
      }),
    );
  }

  return playerMaterialCache.get(ownerId);
}

function createFallbackPlayerVisual(playerId) {
  const mesh = new THREE.Mesh(playerGeometry, getPlayerMaterial(playerId));
  mesh.castShadow = true;
  return mesh;
}

function createEnemyModelVisual() {
  if (!enemyModelTemplate) {
    return null;
  }

  const model = cloneSkeleton(enemyModelTemplate);
  model.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = false;
  });

  return model;
}

function createPlayerVisual(playerId) {
  if (playerId === LOCAL_PLAYER_ID) {
    return createFallbackPlayerVisual(playerId);
  }

  if (!USE_ENEMY_MODEL_VISUALS) {
    return createFallbackPlayerVisual(playerId);
  }

  return createEnemyModelVisual() ?? createFallbackPlayerVisual(playerId);
}

function refreshEnemyPlayerVisuals() {
  if (!world) {
    return;
  }

  for (const player of world.players) {
    if (!BOT_PLAYER_IDS.includes(player.playerId)) {
      continue;
    }

    const existingVisual = playerMeshes.get(player.playerId);
    if (!existingVisual) {
      continue;
    }

    playerGroup.remove(existingVisual);
    playerMeshes.delete(player.playerId);
  }
}

function createEnemyModelTemplate(gltf) {
  const root = gltf?.scene;

  if (!root) {
    return null;
  }

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -bounds.min.y, -center.z);

  const container = new THREE.Group();
  const scale = ENEMY_MODEL_TARGET_HEIGHT / Math.max(size.y, 0.001);
  container.scale.setScalar(scale);

  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = false;
  });

  container.add(root);
  return container;
}

function loadEnemyModelCandidate(index) {
  if (index >= ENEMY_MODEL_URL_CANDIDATES.length) {
    enemyModelLoadFailed = true;
    const failureSummary = enemyModelLoadFailures
      .map((entry) => `${entry.url} (${entry.error})`)
      .join("; ");
    console.warn(
      "Enemy AI model failed to load from all configured URLs. " +
        `Place a model under ${withBaseUrl("models/")} (for example enemy-ai.glb) or provide a working direct .glb URL for model ${ENEMY_MODEL_ID}. ` +
        `Attempts: ${failureSummary}`,
    );
    return;
  }

  const candidateUrl = ENEMY_MODEL_URL_CANDIDATES[index];
  enemyModelLoader.load(
    candidateUrl,
    (gltf) => {
      const root = createEnemyModelTemplate(gltf);

      if (!root) {
        loadEnemyModelCandidate(index + 1);
        return;
      }

      enemyModelTemplate = root;
      if (levelSequenceState) {
        pendingEnemyVisualRefresh = true;
      } else {
        refreshEnemyPlayerVisuals();
      }
    },
    undefined,
    (error) => {
      const errorMessage = error?.message || error?.type || "unknown error";
      enemyModelLoadFailures.push({ url: candidateUrl, error: errorMessage });
      loadEnemyModelCandidate(index + 1);
    },
  );
}

function ensureEnemyModelLoading() {
  if (enemyModelLoadingStarted || enemyModelTemplate || enemyModelLoadFailed) {
    return;
  }

  enemyModelLoadingStarted = true;
  enemyModelLoadFailures = [];
  loadEnemyModelCandidate(0);
}

function getBlockOwnerVisualOffset(ownerId) {
  if (!blockOwnerVisualOffsets.has(ownerId)) {
    blockOwnerVisualOffsets.set(ownerId, new THREE.Vector3());
  }

  return blockOwnerVisualOffsets.get(ownerId);
}

function updateVisualOffsetsFromPileMotion() {
  const pileMotion = world?.pileMotion;

  if (!pileMotion) {
    return;
  }

  for (const [ownerId, motion] of Object.entries(pileMotion)) {
    const previous = lastPileOffsetsByOwner.get(ownerId) ?? { x: motion.offsetX, z: motion.offsetZ };
    const deltaX = motion.offsetX - previous.x;
    const deltaZ = motion.offsetZ - previous.z;

    if (deltaX !== 0 || deltaZ !== 0) {
      const visualOffset = getBlockOwnerVisualOffset(ownerId);
      visualOffset.x -= toRenderUnits(deltaX);
      visualOffset.z -= toRenderUnits(deltaZ);
      hasActiveBlockVisualOffsets = true;
    }

    lastPileOffsetsByOwner.set(ownerId, { x: motion.offsetX, z: motion.offsetZ });
  }
}

function easeBlockOwnerVisualOffsets(deltaSeconds) {
  const blend = Math.min(1, deltaSeconds * BLOCK_MOTION_EASE_SPEED);
  let stillActive = false;

  for (const offset of blockOwnerVisualOffsets.values()) {
    offset.lerp(zeroVector, blend);

    if (offset.lengthSq() < 0.0001) {
      offset.set(0, 0, 0);
      continue;
    }

    stillActive = true;
  }

  hasActiveBlockVisualOffsets = stillActive;
}

function prewarmRenderMaterials() {
  for (const playerId of PLAYER_IDS) {
    getBlockMaterial(playerId);
    getDestroyableBlockMaterial(playerId);
    getPreviewBlockMaterial(playerId);
    getPlayerMaterial(playerId);
  }

  if (explosionVisualPool.normal.length === 0) {
    explosionVisualPool.normal.push(createExplosionVisual(false));
  }
  if (explosionVisualPool.enemy.length === 0) {
    explosionVisualPool.enemy.push(createExplosionVisual(true));
  }
}

function warmRenderFrame() {
  const nowSeconds = performance.now() / 1000;

  prewarmRenderMaterials();
  syncBlocks(nowSeconds);
  syncPlayers(1 / 60);
  syncProjectiles();
  syncExplosions();
  updateCamera(1 / 60, nowSeconds);
  updateFloorGrid(1 / 60, nowSeconds);
  updateHud(nowSeconds);

  renderer.compile(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
}

function warmLevelSequenceFrames(sampleCount = 6) {
  if (!levelSequenceState) {
    return;
  }

  const totalDuration = getLevelSequenceTotalDuration(levelSequenceState);
  if (!(totalDuration > 0)) {
    warmRenderFrame();
    return;
  }

  const originalCameraPosition = camera.position.clone();
  const originalCameraTarget = cameraTarget.clone();
  const originalYaw = cameraState.yaw;
  const originalPitch = cameraState.pitch;
  const nowSeconds = performance.now() / 1000;

  prewarmRenderMaterials();
  syncBlocks(nowSeconds);
  syncPlayers(1 / 60);
  syncProjectiles();
  syncExplosions();
  updateFloorGrid(1 / 60, nowSeconds);
  updateHud(nowSeconds);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const sampleNowSeconds = levelSequenceState.startedAt + totalDuration * progress;
    updateCamera(1 / 60, sampleNowSeconds);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
  }

  camera.position.copy(originalCameraPosition);
  cameraTarget.copy(originalCameraTarget);
  cameraState.yaw = originalYaw;
  cameraState.pitch = originalPitch;
  camera.lookAt(cameraTarget);
  renderer.shadowMap.needsUpdate = true;
}

function isPointerLocked() {
  return document.pointerLockElement === renderer.domElement;
}

function isGameplayPlayable() {
  const localPlayer = getLocalPlayer();
  return world?.match.status === "running" && Boolean(localPlayer?.alive);
}

function isGameplayActive() {
  return isGameplayPlayable() && !gamePaused && isPointerLocked();
}

function setInteractionMode() {
  const active = isGameplayActive();
  document.body.classList.toggle("game-active", active);
  document.body.classList.toggle("game-stopped", !active);

  if (!active && isPointerLocked()) {
    document.exitPointerLock?.();
  }

  updatePauseOverlay();
}

function requestPointerLock() {
  if (isPointerLocked() || !isGameplayPlayable() || gamePaused) {
    return;
  }

  try {
    const pointerLockRequest = renderer.domElement.requestPointerLock?.({ unadjustedMovement: true });

    if (pointerLockRequest?.catch) {
      pointerLockRequest.catch(() => {
        renderer.domElement.requestPointerLock?.();
      });
    }
  } catch {
    renderer.domElement.requestPointerLock?.();
  }
}

function updatePauseOverlay() {
  if (!pauseOverlay || !pauseAction) {
    return;
  }

  const shouldShow = gamePaused && isGameplayPlayable() && !levelSequenceState;
  pauseOverlay.classList.toggle("visible", shouldShow);
  pauseAction.textContent = gameHasStarted ? "Resume Game" : "Start Game";
}

function beginOrResumeGame() {
  if (!isGameplayPlayable()) {
    return;
  }

  const firstStart = !gameHasStarted;

  ensureAudioUnlocked();
  gameHasStarted = true;
  gamePaused = false;

  if (firstStart && !levelSequenceState) {
    startLevelSequence(performance.now() / 1000, {
      targetLevel: currentLevel,
      includeRoundCleared: false,
      sequenceType: "intro",
    });
    warmLevelSequenceFrames();
  }

  setInteractionMode();
  requestPointerLock();
}

function setCameraToIntroStartPosition() {
  const localPlayer = getLocalPlayer();
  const focusedEnemy = getPrimaryAliveEnemyPlayer();
  const openingAimTarget = focusedEnemy
    ? getNearestDestructibleTargetPoint(focusedEnemy.playerId, localPlayer)
    : null;
  const openingShotPose = createOpeningShotCameraPose(localPlayer, openingAimTarget);
  const centerX = toRenderUnits(arenaCenter.x);
  const centerY = toRenderUnits(2.8);
  const centerZ = toRenderUnits(arenaCenter.z);
  const endOffsetX = (openingShotPose?.position.x ?? camera.position.x) - centerX;
  const endOffsetZ = (openingShotPose?.position.z ?? camera.position.z) - centerZ;
  const rawEndAngle = Math.atan2(endOffsetZ, endOffsetX);
  const endAngle = rawEndAngle;
  const startAngle = endAngle - INTRO_CINEMATIC_ORBIT_SPAN_RADIANS;
  const startY = centerY + INTRO_CINEMATIC_START_HEIGHT;

  camera.position.set(
    centerX + Math.cos(startAngle) * INTRO_CINEMATIC_START_RADIUS,
    startY,
    centerZ + Math.sin(startAngle) * INTRO_CINEMATIC_START_RADIUS,
  );
  cameraTarget.set(centerX, centerY, centerZ);
  camera.lookAt(cameraTarget);
}

function getLocalPlayer() {
  return world.players.find((player) => player.playerId === LOCAL_PLAYER_ID);
}

function getAlivePlayers() {
  return world.players.filter((player) => player.alive);
}

function getEnemyPileCountForLevel(level) {
  return THREE.MathUtils.clamp(level, 1, LEVEL_BOT_COUNT_CAP);
}

function getActivePlayerIdsForLevel(level) {
  return [LOCAL_PLAYER_ID, ...BOT_PLAYER_IDS.slice(0, getEnemyPileCountForLevel(level))];
}

function getBotCooldownRangeForLevel(level) {
  const extraLevels = Math.max(0, level - LEVEL_FIRE_RATE_BASELINE);
  const scale = Math.max(
    LEVEL_FIRE_RATE_SCALE_FLOOR,
    Math.pow(LEVEL_FIRE_RATE_SCALE_PER_LEVEL, extraLevels),
  );

  return {
    min: BOT_COOLDOWN_MIN_SECONDS * scale,
    max: BOT_COOLDOWN_MAX_SECONDS * scale,
  };
}

function updateDirectionalShadowBounds(minX, maxX, minZ, maxZ) {
  const minRenderX = toRenderUnits(minX);
  const maxRenderX = toRenderUnits(maxX);
  const minRenderZ = toRenderUnits(minZ);
  const maxRenderZ = toRenderUnits(maxZ);
  const halfSpanX = Math.max(10 * WORLD_SCALE, (maxRenderX - minRenderX) * 0.5 + DIR_SHADOW_MARGIN);
  const halfSpanZ = Math.max(10 * WORLD_SCALE, (maxRenderZ - minRenderZ) * 0.5 + DIR_SHADOW_MARGIN);
  const halfSpan = Math.max(halfSpanX, halfSpanZ);
  const centerX = (minRenderX + maxRenderX) * 0.5;
  const centerZ = (minRenderZ + maxRenderZ) * 0.5;

  dir.position.set(
    centerX + DIR_LIGHT_OFFSET_X,
    toRenderUnits(0) + DIR_LIGHT_OFFSET_Y,
    centerZ + DIR_LIGHT_OFFSET_Z,
  );
  dir.target.position.set(centerX, toRenderUnits(0), centerZ);
  dir.target.updateMatrixWorld();
  dir.shadow.camera.left = -halfSpan;
  dir.shadow.camera.right = halfSpan;
  dir.shadow.camera.top = halfSpan;
  dir.shadow.camera.bottom = -halfSpan;
  dir.shadow.camera.updateProjectionMatrix();
  dir.shadow.needsUpdate = true;
}

function showLevelOverlay(text, opacity) {
  if (!levelOverlay) {
    return;
  }

  levelOverlay.classList.toggle("round-cleared", text === "ROUND CLEARED");
  levelOverlay.textContent = text;
  levelOverlay.style.opacity = String(opacity);
}

function clearTransientCombatEffects() {
  projectiles = [];
  explosions = [];

  for (const popup of scorePopups) {
    releaseScorePopup(popup);
  }
  scorePopups = [];

  holdFireActive = false;
  shotState.charging = false;
  shotPreviewLine.visible = false;
  landingMarker.visible = false;
  clearPreviewDestroyedBlocks();
  for (const dot of previewDots) {
    dot.visible = false;
  }
}

function getPrimaryAliveEnemyPlayer() {
  for (const enemyId of BOT_PLAYER_IDS) {
    const enemy = world.players.find((player) => player.playerId === enemyId && player.alive);
    if (enemy) {
      return enemy;
    }
  }

  return null;
}

function getBlocksForOwner(ownerId) {
  if (!world) {
    return EMPTY_BLOCKS;
  }

  // Rebuild once per simulation tick or if world.blocks array identity changes.
  if (blockBucketsTick !== world.tick || blockBucketsSource !== world.blocks) {
    blockBucketsByOwner = new Map();
    for (const block of world.blocks) {
      if (!blockBucketsByOwner.has(block.ownerId)) {
        blockBucketsByOwner.set(block.ownerId, []);
      }
      blockBucketsByOwner.get(block.ownerId).push(block);
    }
    blockBucketsTick = world.tick;
    blockBucketsSource = world.blocks;
  }

  return blockBucketsByOwner.get(ownerId) ?? EMPTY_BLOCKS;
}

function getDestructibleBlocksForOwner(ownerId) {
  const ownerBlocks = getBlocksForOwner(ownerId);
  if (ownerBlocks.length === 0) {
    return EMPTY_BLOCKS;
  }

  const occupiedBlocks = new Set(world.blocks.map((block) => getBlockKey(block.x, block.y, block.z)));
  const faceOffsets = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  return ownerBlocks.filter((block) => {
    let exposedFaces = 0;
    for (const [offsetX, offsetY, offsetZ] of faceOffsets) {
      const neighborKey = getBlockKey(block.x + offsetX, block.y + offsetY, block.z + offsetZ);
      if (!occupiedBlocks.has(neighborKey)) {
        exposedFaces += 1;
        if (exposedFaces >= 2) {
          return true;
        }
      }
    }

    return false;
  });
}

function getNearestDestructibleTargetPoint(enemyPlayerId, localPlayer) {
  if (!localPlayer) {
    return null;
  }

  const enemyBlocks = getBlocksForOwner(enemyPlayerId);
  const destructibleBlocks = getDestructibleBlocksForOwner(enemyPlayerId);
  if (enemyBlocks.length === 0) {
    return null;
  }

  let nearestExposedBlock = null;
  let nearestExposedDistanceSquared = Number.POSITIVE_INFINITY;
  let nearestAnyBlock = null;
  let nearestAnyDistanceSquared = Number.POSITIVE_INFINITY;

  for (const block of enemyBlocks) {
    const distanceSquared =
      (block.x - localPlayer.x) * (block.x - localPlayer.x) +
      (block.y - localPlayer.y) * (block.y - localPlayer.y) +
      (block.z - localPlayer.z) * (block.z - localPlayer.z);

    if (distanceSquared < nearestAnyDistanceSquared) {
      nearestAnyDistanceSquared = distanceSquared;
      nearestAnyBlock = block;
    }

    const exposed = destructibleBlocks.includes(block);

    if (!exposed || distanceSquared >= nearestExposedDistanceSquared) {
      continue;
    }

    nearestExposedDistanceSquared = distanceSquared;
    nearestExposedBlock = block;
  }

  const targetBlock = nearestExposedBlock ?? nearestAnyBlock;
  if (!targetBlock) {
    return null;
  }

  return {
    x: targetBlock.x,
    y: targetBlock.y + 0.35,
    z: targetBlock.z,
  };
}

function createOpeningShotCameraPose(localPlayer, targetPoint) {
  if (!localPlayer || !targetPoint) {
    return null;
  }

  const localX = toRenderUnits(localPlayer.x);
  const localY = toRenderUnits(localPlayer.y + 2.3);
  const localZ = toRenderUnits(localPlayer.z);
  const targetX = toRenderUnits(targetPoint.x);
  const targetY = toRenderUnits(targetPoint.y);
  const targetZ = toRenderUnits(targetPoint.z);
  const toTargetX = targetX - localX;
  const toTargetZ = targetZ - localZ;
  const toTargetLength = Math.max(0.001, Math.hypot(toTargetX, toTargetZ));
  const toTargetNormX = toTargetX / toTargetLength;
  const toTargetNormZ = toTargetZ / toTargetLength;

  return {
    position: {
      x: localX - toTargetNormX * INTRO_ENEMY_FOCUS_DISTANCE,
      y: localY + INTRO_ENEMY_FOCUS_HEIGHT,
      z: localZ - toTargetNormZ * INTRO_ENEMY_FOCUS_DISTANCE,
    },
    target: {
      x: targetX,
      y: targetY,
      z: targetZ,
    },
  };
}

function getOrbitEndAngle(startAngle, rawEndAngle, desiredSpan, introSequence) {
  const tau = Math.PI * 2;
  let bestAngle = rawEndAngle;
  let bestDifference = Number.POSITIVE_INFINITY;
  const minimumTurns = introSequence ? 1 : 0;

  for (let turns = minimumTurns; turns <= minimumTurns + 2; turns += 1) {
    const candidate = rawEndAngle + turns * tau;
    const travelled = candidate - startAngle;
    if (travelled <= 0) {
      continue;
    }

    const difference = Math.abs(travelled - desiredSpan);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestAngle = candidate;
    }
  }

  if (bestAngle <= startAngle) {
    bestAngle += tau;
  }

  return bestAngle;
}

function alignCameraForOpeningShot(targetPoint) {
  const localPlayer = getLocalPlayer();
  if (!localPlayer || !targetPoint) {
    return;
  }

  const deltaX = targetPoint.x - localPlayer.x;
  const deltaZ = targetPoint.z - localPlayer.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);
  if (horizontalDistance < 0.001) {
    return;
  }

  const facingX = deltaX / horizontalDistance;
  const facingZ = deltaZ / horizontalDistance;
  cameraState.yaw = Math.atan2(-facingX, -facingZ);

  const desiredPitch = THREE.MathUtils.clamp(1.03, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
  cameraState.pitch = desiredPitch;
}

function startLevelSequence(
  nowSeconds,
  { targetLevel, includeRoundCleared, onComplete = null, sequenceType = "transition" },
) {
  if (includeRoundCleared) {
    clearTransientCombatEffects();
  }

  const steps = [];
  if (includeRoundCleared) {
    steps.push("ROUND CLEARED");
  }
  steps.push(`LEVEL ${targetLevel}`);
  steps.push("READY");

  const localPlayer = getLocalPlayer();
  const focusedEnemy = getPrimaryAliveEnemyPlayer();
  const openingAimTarget = focusedEnemy
    ? getNearestDestructibleTargetPoint(focusedEnemy.playerId, localPlayer)
    : null;
  const openingShotPose = createOpeningShotCameraPose(localPlayer, openingAimTarget);
  const introSequence = sequenceType === "intro";
  const centerX = toRenderUnits(arenaCenter.x);
  const centerY = toRenderUnits(2.8);
  const centerZ = toRenderUnits(arenaCenter.z);
  const endOffsetX = (openingShotPose?.position.x ?? camera.position.x) - centerX;
  const endOffsetZ = (openingShotPose?.position.z ?? camera.position.z) - centerZ;
  const desiredOrbitSpan = introSequence ? INTRO_CINEMATIC_ORBIT_SPAN_RADIANS : CINEMATIC_ORBIT_SPAN_RADIANS;
  const rawEndAngle = Math.atan2(endOffsetZ, endOffsetX);
  const endAngle = rawEndAngle;
  const startAngle = endAngle - desiredOrbitSpan;
  const startRadius = introSequence ? INTRO_CINEMATIC_START_RADIUS : CINEMATIC_START_RADIUS;
  const endRadius = Math.max(0.001, Math.hypot(endOffsetX, endOffsetZ));
  const startY = centerY + (introSequence ? INTRO_CINEMATIC_START_HEIGHT : CINEMATIC_START_HEIGHT);
  const startCameraPose = {
    position: {
      x: centerX + Math.cos(startAngle) * startRadius,
      y: startY,
      z: centerZ + Math.sin(startAngle) * startRadius,
    },
    target: {
      x: centerX,
      y: centerY,
      z: centerZ,
    },
  };

  camera.position.set(startCameraPose.position.x, startCameraPose.position.y, startCameraPose.position.z);
  cameraTarget.set(startCameraPose.target.x, startCameraPose.target.y, startCameraPose.target.z);
  camera.lookAt(cameraTarget);

  levelSequenceState = {
    steps,
    stepIndex: 0,
    phase: "fade-in",
    phaseStartedAt: nowSeconds,
    startedAt: nowSeconds,
    sequenceType,
    focusEnemyId: focusedEnemy?.playerId ?? null,
    openingAimTarget,
    openingShotPose,
    orbitalPath: {
      centerX,
      centerZ,
      startAngle,
      endAngle,
      startRadius,
      endRadius,
      startY,
      endY: openingShotPose?.position.y ?? camera.position.y,
    },
    startCameraPose,
    onComplete,
  };
  showLevelOverlay(steps[0], 0);
}

function getLevelSequenceTotalDuration(sequenceState) {
  if (!sequenceState) {
    return 0;
  }

  return sequenceState.steps.length * (
    LEVEL_LABEL_FADE_IN_SECONDS + LEVEL_LABEL_HOLD_SECONDS + LEVEL_LABEL_FADE_OUT_SECONDS
  );
}

function updateCinematicCamera(nowSeconds) {
  if (!levelSequenceState) {
    return false;
  }

  const localPlayer = getLocalPlayer();
  const focusedEnemy = levelSequenceState.focusEnemyId
    ? world.players.find((player) => player.playerId === levelSequenceState.focusEnemyId && player.alive)
    : world.players.find((player) => player.playerId !== LOCAL_PLAYER_ID && player.alive);
  const totalDuration = Math.max(0.001, getLevelSequenceTotalDuration(levelSequenceState));
  const elapsed = Math.max(0, nowSeconds - levelSequenceState.startedAt);
  const progress = THREE.MathUtils.clamp(elapsed / totalDuration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const introSequence = levelSequenceState.sequenceType === "intro";
  const centerX = levelSequenceState.orbitalPath?.centerX ?? toRenderUnits(arenaCenter.x);
  const centerY = toRenderUnits(2.8);
  const centerZ = levelSequenceState.orbitalPath?.centerZ ?? toRenderUnits(arenaCenter.z);
  const playerTargetX = toRenderUnits(localPlayer?.x ?? arenaCenter.x);
  const playerTargetY = toRenderUnits((localPlayer?.y ?? 0) + 2.3);
  const playerTargetZ = toRenderUnits(localPlayer?.z ?? arenaCenter.z);
  const openingShotPose = levelSequenceState.openingShotPose;
  const startCameraPose = levelSequenceState.startCameraPose;
  const orbitalPath = levelSequenceState.orbitalPath;
  const orbitAngle = THREE.MathUtils.lerp(orbitalPath?.startAngle ?? 0, orbitalPath?.endAngle ?? 0, eased);
  const orbitRadius = THREE.MathUtils.lerp(orbitalPath?.startRadius ?? 0, orbitalPath?.endRadius ?? 0, eased);
  const pathPositionX = centerX + Math.cos(orbitAngle) * orbitRadius;
  const pathPositionY = THREE.MathUtils.lerp(orbitalPath?.startY ?? camera.position.y, orbitalPath?.endY ?? camera.position.y, eased);
  const pathPositionZ = centerZ + Math.sin(orbitAngle) * orbitRadius;
  const endPositionX = openingShotPose?.position.x ?? pathPositionX;
  const endPositionY = openingShotPose?.position.y ?? pathPositionY;
  const endPositionZ = openingShotPose?.position.z ?? pathPositionZ;
  const endTargetX = openingShotPose?.target.x ?? toRenderUnits(focusedEnemy?.x ?? arenaCenter.x);
  const endTargetY = openingShotPose?.target.y ?? toRenderUnits((focusedEnemy?.y ?? 0) + 2.3);
  const endTargetZ = openingShotPose?.target.z ?? toRenderUnits(focusedEnemy?.z ?? arenaCenter.z);
  const baseTargetBlend = introSequence ? 0.4 + 0.5 * eased : 0.2 + 0.7 * eased;
  const baseTargetX = THREE.MathUtils.lerp(centerX, playerTargetX, baseTargetBlend);
  const baseTargetY = THREE.MathUtils.lerp(centerY, playerTargetY, baseTargetBlend);
  const baseTargetZ = THREE.MathUtils.lerp(centerZ, playerTargetZ, baseTargetBlend);
  const pathTargetX = THREE.MathUtils.lerp(baseTargetX, endTargetX, eased);
  const pathTargetY = THREE.MathUtils.lerp(baseTargetY, endTargetY, eased);
  const pathTargetZ = THREE.MathUtils.lerp(baseTargetZ, endTargetZ, eased);
  const startBlend = 1 - Math.pow(1 - eased, 1.6);

  camera.position.set(
    THREE.MathUtils.lerp(startCameraPose?.position.x ?? pathPositionX, pathPositionX, startBlend),
    THREE.MathUtils.lerp(startCameraPose?.position.y ?? pathPositionY, pathPositionY, startBlend),
    THREE.MathUtils.lerp(startCameraPose?.position.z ?? pathPositionZ, pathPositionZ, startBlend),
  );
  cameraTarget.set(
    THREE.MathUtils.lerp(startCameraPose?.target.x ?? pathTargetX, pathTargetX, startBlend),
    THREE.MathUtils.lerp(startCameraPose?.target.y ?? pathTargetY, pathTargetY, startBlend),
    THREE.MathUtils.lerp(startCameraPose?.target.z ?? pathTargetZ, pathTargetZ, startBlend),
  );

  camera.lookAt(cameraTarget);

  const headingX = cameraTarget.x - camera.position.x;
  const headingZ = cameraTarget.z - camera.position.z;
  cameraState.yaw = Math.atan2(-headingX, -headingZ);
  const horizontalDistance = Math.hypot(headingX, headingZ);
  const relativeHeight = camera.position.y - cameraTarget.y;
  cameraState.pitch = THREE.MathUtils.clamp(
    Math.atan2(Math.max(0.001, relativeHeight), Math.max(0.001, horizontalDistance)),
    MIN_CAMERA_PITCH,
    MAX_CAMERA_PITCH,
  );

  return true;
}

function updateLevelSequence(nowSeconds) {
  if (!levelSequenceState) {
    return;
  }

  const state = levelSequenceState;
  const elapsed = nowSeconds - state.phaseStartedAt;

  if (state.phase === "fade-in") {
    const progress = Math.min(1, elapsed / LEVEL_LABEL_FADE_IN_SECONDS);
    showLevelOverlay(state.steps[state.stepIndex], progress);
    if (progress >= 1) {
      state.phase = "hold";
      state.phaseStartedAt = nowSeconds;
    }
    return;
  }

  if (state.phase === "hold") {
    showLevelOverlay(state.steps[state.stepIndex], 1);
    if (elapsed >= LEVEL_LABEL_HOLD_SECONDS) {
      state.phase = "fade-out";
      state.phaseStartedAt = nowSeconds;
    }
    return;
  }

  const progress = Math.min(1, elapsed / LEVEL_LABEL_FADE_OUT_SECONDS);
  showLevelOverlay(state.steps[state.stepIndex], 1 - progress);

  if (progress < 1) {
    return;
  }

  state.stepIndex += 1;
  if (state.stepIndex < state.steps.length) {
    state.phase = "fade-in";
    state.phaseStartedAt = nowSeconds;
    return;
  }

  const onComplete = state.onComplete;
  levelSequenceState = null;
  showLevelOverlay("", 0);
  if (pendingEnemyVisualRefresh) {
    pendingEnemyVisualRefresh = false;
    refreshEnemyPlayerVisuals();
    warmRenderFrame();
  }
  if (onComplete) {
    onComplete();
  }
}

function getFacingVector() {
  return {
    x: -Math.sin(cameraState.yaw),
    z: -Math.cos(cameraState.yaw),
  };
}

function getProjectileStart(player) {
  return {
    x: player.x,
    y: player.y + 1.15,
    z: player.z,
  };
}

function getShotArcControlFromPitch() {
  const normalizedPitch = THREE.MathUtils.inverseLerp(MIN_CAMERA_PITCH, MAX_CAMERA_PITCH, cameraState.pitch);
  return THREE.MathUtils.clamp(normalizedPitch, 0, 1);
}

function getAimDirection() {
  const facingVector = getFacingVector();
  return new THREE.Vector3(facingVector.x, 0, facingVector.z).normalize();
}

function solveTargetedLaunch(start, target, arcControl) {
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  const deltaZ = target.z - start.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);

  if (horizontalDistance < 0.05) {
    return null;
  }

  const horizontalSpeed = THREE.MathUtils.lerp(28, 11, arcControl);
  const time = Math.max(0.12, horizontalDistance / horizontalSpeed);
  const gravity = world.config.gravity;
  const velocity = {
    x: deltaX / time,
    y: (deltaY + 0.5 * gravity * time * time) / time,
    z: deltaZ / time,
  };
  const power = Math.hypot(velocity.x, velocity.y, velocity.z);
  const angle = Math.atan2(velocity.y, Math.hypot(velocity.x, velocity.z));

  return {
    velocity,
    power,
    angle,
  };
}

function resetGame(options = {}) {
  const { preserveScore = false, preserveLevel = false } = options;

  if (!preserveLevel) {
    currentLevel = 1;
  }

  const nowSeconds = performance.now() / 1000;
  const activePlayerIds = getActivePlayerIdsForLevel(currentLevel);
  const spawnSlots = allocateSpawnSlots(activePlayerIds, SPAWN_CONFIG);
  world = createSimulationState(activePlayerIds, spawnSlots, SIMULATION_CONFIG);

  const xValues = spawnSlots.map((slot) => slot.x);
  const zValues = spawnSlots.map((slot) => slot.z);
  arenaCenter.set(
    (Math.min(...xValues) + Math.max(...xValues)) / 2,
    0,
    (Math.min(...zValues) + Math.max(...zValues)) / 2,
  );
  updateDirectionalShadowBounds(Math.min(...xValues), Math.max(...xValues), Math.min(...zValues), Math.max(...zValues));

  chasm.position.set(toRenderUnits(arenaCenter.x), toRenderUnits(-6.8), toRenderUnits(arenaCenter.z));
  floorGlow.position.set(toRenderUnits(arenaCenter.x), toRenderUnits(-7.8), toRenderUnits(arenaCenter.z));
  rim.position.set(toRenderUnits(arenaCenter.x + 8), toRenderUnits(8), toRenderUnits(arenaCenter.z + 8));

  projectiles = [];
  explosions = [];
  for (const mesh of playerMeshes.values()) {
    playerGroup.remove(mesh);
  }
  playerMeshes.clear();
  for (const popup of scorePopups) {
    releaseScorePopup(popup);
  }
  scorePopups = [];
  const { min: botCooldownMin } = getBotCooldownRangeForLevel(currentLevel);
  botNextThrow = Object.fromEntries(
    activePlayerIds.filter((playerId) => playerId !== LOCAL_PLAYER_ID).map((playerId, index) => [
      playerId,
      nowSeconds + BOT_OPENING_GRACE_SECONDS + index * Math.max(0.45, botCooldownMin * 0.28),
    ]),
  );
  botMoveStateById = {};
  nextProjectileId = 1;
  nextExplosionId = 1;
  nextTntTime = 0;
  if (!preserveScore) {
    clearLeaderboardSession();
    void startLeaderboardSession().catch(() => {
      // Session startup failures are surfaced later if score submission is attempted.
    });
    currentScore = 0;
    leaderboardQualifyingScore = null;
    leaderboardSubmittedScore = null;
    setInitialsFeedback("");
    hideInitialsForm();
    if (initialsInput) {
      initialsInput.value = "";
    }
  }
  holdFireActive = false;
  nextHoldFireTime = 0;
  nextAimPointUpdateAt = 0;
  roundStartedAt = nowSeconds;
  playerHasFired = false;
  renderedBlocks = [];
  renderedDestroyableKeys = new Set();
  lastAlivePlayerSignature = "";
  blockOwnerVisualOffsets.clear();
  lastPileOffsetsByOwner.clear();
  hasActiveBlockVisualOffsets = false;
  ownerTopTargetInfoById.clear();
  ownerTopTargetInfoDirty = true;
  deadOwnerDissolveStartById.clear();
  shotState.charging = false;
  shotState.power = MIN_SHOT_POWER;
  shotState.angle = THREE.MathUtils.lerp(MIN_SHOT_ANGLE, MAX_SHOT_ANGLE, DEFAULT_ARC_CONTROL);
  shotState.arcControl = DEFAULT_ARC_CONTROL;
  banner.classList.remove("visible");
  shotPreviewLine.visible = false;
  landingMarker.visible = false;
  clearPreviewDestroyedBlocks();
  markBlocksDirty();
  setInteractionMode();
  warmRenderFrame();
}

function getMovementIntent() {
  const strafe = Number(inputState.right) - Number(inputState.left);
  const forwardAxis = Number(inputState.forward) - Number(inputState.backward);
  const forwardVector = getFacingVector();
  const rightVector = {
    x: Math.cos(cameraState.yaw),
    z: -Math.sin(cameraState.yaw),
  };
  const moveX = rightVector.x * strafe + forwardVector.x * forwardAxis;
  const moveZ = rightVector.z * strafe + forwardVector.z * forwardAxis;

  return {
    moveX,
    moveZ,
    jump: inputState.jumpQueued,
  };
}

function updateAimPoint(nowSeconds) {
  if (!isGameplayActive()) {
    return;
  }

  if (nowSeconds < nextAimPointUpdateAt) {
    return;
  }
  nextAimPointUpdateAt = nowSeconds + AIM_POINT_UPDATE_INTERVAL_SECONDS;

  const player = getLocalPlayer();
  aimPlane.constant = -toRenderUnits(player?.y ?? SPAWN_CONFIG.baseY);
  raycaster.setFromCamera(RETICLE, camera);

  const blockIntersections = raycaster.intersectObjects(blockGroup.children, false);
  if (blockIntersections.length > 0) {
    shotTargetPoint.set(
      toSimulationUnits(blockIntersections[0].point.x),
      toSimulationUnits(blockIntersections[0].point.y),
      toSimulationUnits(blockIntersections[0].point.z),
    );
  } else if (raycaster.ray.intersectPlane(aimPlane, shotTargetPoint)) {
    // Fallback for open air aiming: project onto the current play height plane.
    shotTargetPoint.set(
      toSimulationUnits(shotTargetPoint.x),
      toSimulationUnits(shotTargetPoint.y),
      toSimulationUnits(shotTargetPoint.z),
    );
  }
}

function getPlayerShotParameters() {
  const arcControl = getShotArcControlFromPitch();
  const player = getLocalPlayer();
  const start = player ? getProjectileStart(player) : null;
  const target = shotTargetPoint;
  const launch = start ? solveTargetedLaunch(start, target, arcControl) : null;

  return {
    arcControl,
    power: launch?.power ?? THREE.MathUtils.lerp(MAX_SHOT_POWER, MIN_SHOT_POWER, arcControl),
    angle: launch?.angle ?? THREE.MathUtils.lerp(MIN_SHOT_ANGLE, MAX_SHOT_ANGLE, arcControl),
    velocity: launch?.velocity ?? null,
  };
}

function createLaunchVelocity(direction, power, angle) {
  const horizontalSpeed = power * Math.cos(angle);
  const verticalSpeed = power * Math.sin(angle);

  return {
    x: direction.x * horizontalSpeed,
    z: direction.z * horizontalSpeed,
    y: verticalSpeed,
  };
}

function addAngularJitterToVelocity(velocity, maxDegrees) {
  const vector = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
  const speed = vector.length();

  if (speed <= 0) {
    return velocity;
  }

  const direction = vector.clone().normalize();
  const maxRadians = THREE.MathUtils.degToRad(maxDegrees);

  // Randomly rotate the shot direction by a very small angle around a random axis.
  const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  const jitterAngle = (Math.random() * 2 - 1) * maxRadians;
  direction.applyAxisAngle(axis, jitterAngle).normalize();

  return {
    x: direction.x * speed,
    y: direction.y * speed,
    z: direction.z * speed,
  };
}

function solveLaunchPower(start, target) {
  const horizontalDistance = Math.hypot(target.x - start.x, target.z - start.z);
  const verticalDistance = target.y - start.y;
  const botAngle = THREE.MathUtils.lerp(MIN_SHOT_ANGLE, MAX_SHOT_ANGLE, 0.58);
  const cosAngle = Math.cos(botAngle);
  const tanAngle = Math.tan(botAngle);
  const denominator = 2 * cosAngle * cosAngle * (horizontalDistance * tanAngle - verticalDistance);

  if (horizontalDistance < 0.1 || denominator <= 0) {
    return MAX_SHOT_POWER;
  }

  const squaredVelocity = (world.config.gravity * horizontalDistance * horizontalDistance) / denominator;
  if (squaredVelocity <= 0) {
    return MAX_SHOT_POWER;
  }

  return THREE.MathUtils.clamp(Math.sqrt(squaredVelocity), MIN_SHOT_POWER, MAX_SHOT_POWER);
}

function pickBotTopTargetInfo(playerId) {
  if (ownerTopTargetInfoDirty) {
    rebuildOwnerTopTargetInfoCache();
  }

  return ownerTopTargetInfoById.get(playerId) ?? null;
}

function pickNearestBlock(blocks, x, z) {
  let nearestBlock = blocks[0] ?? null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const block of blocks) {
    const distance = Math.hypot(block.x - x, block.z - z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestBlock = block;
    }
  }

  return nearestBlock;
}

function getBotMovementIntent(player, nowSeconds) {
  const topInfo = pickBotTopTargetInfo(player.playerId);
  if (!topInfo) {
    return { moveX: 0, moveZ: 0, jump: false };
  }

  const { highestY, topBlocks, coreTopBlocks, topCenterX, topCenterZ } = topInfo;
  const centerDistance = Math.hypot(player.x - topCenterX, player.z - topCenterZ);
  const alreadyTopAndCentered = player.y >= highestY - 0.05 && centerDistance <= BOT_TOP_CENTER_HOLD_RADIUS;

  if (alreadyTopAndCentered) {
    botMoveStateById[player.playerId] = {
      targetX: topCenterX,
      targetZ: topCenterZ,
      nextRetargetAt: nowSeconds + BOT_MOVE_RETARGET_MIN_SECONDS,
    };
    return { moveX: 0, moveZ: 0, jump: false };
  }

  const previousState = botMoveStateById[player.playerId] ?? {};
  const previousTargetDistance = Math.hypot(
    (previousState.targetX ?? player.x) - player.x,
    (previousState.targetZ ?? player.z) - player.z,
  );
  const shouldRetarget =
    nowSeconds >= (previousState.nextRetargetAt ?? 0) ||
    previousTargetDistance <= BOT_MOVE_TARGET_REACHED_DISTANCE;

  const nextState = { ...previousState };

  if (shouldRetarget) {
    const targetBlock = coreTopBlocks[Math.floor(Math.random() * coreTopBlocks.length)] ?? coreTopBlocks[0];
    nextState.targetX = targetBlock.x;
    nextState.targetZ = targetBlock.z;
    nextState.nextRetargetAt =
      nowSeconds + BOT_MOVE_RETARGET_MIN_SECONDS + Math.random() * (BOT_MOVE_RETARGET_MAX_SECONDS - BOT_MOVE_RETARGET_MIN_SECONDS);
  }

  let targetX = nextState.targetX ?? player.x;
  let targetZ = nextState.targetZ ?? player.z;

  if (player.y < highestY - 0.05) {
    const nearestTopBlock = pickNearestBlock(topBlocks, player.x, player.z);
    if (nearestTopBlock) {
      targetX = nearestTopBlock.x;
      targetZ = nearestTopBlock.z;
      nextState.targetX = targetX;
      nextState.targetZ = targetZ;
    }
  }

  botMoveStateById[player.playerId] = nextState;

  const deltaX = targetX - player.x;
  const deltaZ = targetZ - player.z;
  const horizontalDistance = Math.hypot(deltaX, deltaZ);
  const shouldMove = horizontalDistance > BOT_MOVE_DEADZONE_DISTANCE;
  const jump = player.grounded && player.y < highestY - 0.05 && horizontalDistance <= 1.4;

  if (!shouldMove) {
    return { moveX: 0, moveZ: 0, jump };
  }

  return {
    moveX: deltaX / horizontalDistance,
    moveZ: deltaZ / horizontalDistance,
    jump,
  };
}

function getBotMovementIntents(nowSeconds) {
  const intents = {};

  for (const player of world.players) {
    if (player.playerId === LOCAL_PLAYER_ID || !player.alive) {
      continue;
    }

    intents[player.playerId] = getBotMovementIntent(player, nowSeconds);
  }

  return intents;
}

function createProjectileFromVelocity(ownerId, start, velocity) {
  const projectile = createProjectile({
    ownerId,
    position: start,
    velocity,
    blastRadius: PROJECTILE_BLAST_RADIUS,
  });

  projectile.id = `projectile-${nextProjectileId}`;
  nextProjectileId += 1;
  projectiles.push(projectile);
}

function sampleShotTrajectory(start, velocity) {
  const projectile = createProjectile({
    ownerId: LOCAL_PLAYER_ID,
    position: start,
    velocity,
    blastRadius: PROJECTILE_BLAST_RADIUS,
  });
  const points = [new THREE.Vector3(start.x, start.y, start.z)];

  for (let step = 0; step < MAX_PREVIEW_STEPS; step += 1) {
    stepProjectile(projectile, world.config);
    points.push(new THREE.Vector3(projectile.position.x, projectile.position.y, projectile.position.z));

    const impact = resolveProjectileImpact(projectile, world.blocks);
    if (impact.exploded) {
      return {
        points,
        landingPoint: { ...projectile.position },
        destroyedBlocks: impact.destroyedBlocks,
      };
    }

    if (projectile.position.y <= world.config.baseY - 0.4 || projectile.ageTicks >= PROJECTILE_LIFETIME_TICKS) {
      return {
        points,
        landingPoint: { ...projectile.position },
        destroyedBlocks: explodeBlocks(world.blocks, projectile.position, projectile.blastRadius).destroyedBlocks,
      };
    }
  }

  return {
    points,
    landingPoint: { ...projectile.position },
    destroyedBlocks: explodeBlocks(world.blocks, projectile.position, projectile.blastRadius).destroyedBlocks,
  };
}

function simulateBotShotHitsDestructibleBlock(start, velocity, targetOwnerId) {
  const projectile = createProjectile({
    ownerId: "bot-preview",
    position: start,
    velocity,
    blastRadius: PROJECTILE_BLAST_RADIUS,
  });

  for (let step = 0; step < MAX_PREVIEW_STEPS; step += 1) {
    stepProjectile(projectile, world.config);
    const impact = resolveProjectileImpact(projectile, world.blocks);
    if (impact.exploded) {
      return Boolean(impact.impactedBlock && impact.impactedBlock.ownerId === targetOwnerId);
    }

    if (projectile.position.y <= world.config.baseY - 0.4 || projectile.ageTicks >= PROJECTILE_LIFETIME_TICKS) {
      return false;
    }
  }

  return false;
}

function startChargeShot(nowSeconds) {
  const player = getLocalPlayer();
  if (!player?.alive || world.match.status !== "running" || nowSeconds < nextTntTime) {
    return;
  }

  shotState.charging = true;
  holdFireActive = true;
  nextHoldFireTime = nowSeconds;
  nextShotPreviewRecomputeAt = 0;
}

function releaseChargeShot() {
  holdFireActive = false;
  shotState.charging = false;
  shotPreviewLine.visible = false;
  landingMarker.visible = false;
  clearPreviewDestroyedBlocks();
  for (const dot of previewDots) {
    dot.visible = false;
  }
}

function firePlayerShot(nowSeconds) {
  const player = getLocalPlayer();

  if (!player?.alive || world.match.status !== "running" || nowSeconds < nextTntTime) {
    return false;
  }

  const start = getProjectileStart(player);
  const shotParameters = getPlayerShotParameters();
  const velocity = shotParameters.velocity;

  if (!velocity) {
    return false;
  }

  shotState.arcControl = shotParameters.arcControl;
  shotState.power = shotParameters.power;
  shotState.angle = shotParameters.angle;
  const jitteredVelocity = addAngularJitterToVelocity(velocity, PLAYER_SHOT_JITTER_DEGREES);
  createProjectileFromVelocity(LOCAL_PLAYER_ID, start, jitteredVelocity);
  playShotSound();
  nextTntTime = nowSeconds + TNT_COOLDOWN_SECONDS;
  playerHasFired = true;
  return true;
}

function processHoldFire(nowSeconds) {
  if (!holdFireActive || !isGameplayActive() || nowSeconds < nextHoldFireTime) {
    return;
  }

  if (firePlayerShot(nowSeconds)) {
    nextHoldFireTime = nowSeconds + HOLD_FIRE_INTERVAL_SECONDS;
    return;
  }

  nextHoldFireTime = nowSeconds + 0.02;
}

function updateShotPreview(nowSeconds) {
  shotPreviewLine.visible = false;
  for (const dot of previewDots) {
    dot.visible = false;
  }

  if (!shotState.charging) {
    landingMarker.visible = false;
    clearPreviewDestroyedBlocks();
    return;
  }

  const player = getLocalPlayer();
  if (!player?.alive) {
    shotState.charging = false;
    landingMarker.visible = false;
    clearPreviewDestroyedBlocks();
    return;
  }

  const shotParameters = getPlayerShotParameters();
  shotState.arcControl = shotParameters.arcControl;
  shotState.power = shotParameters.power;
  shotState.angle = shotParameters.angle;

  if (!shotParameters.velocity) {
    landingMarker.visible = false;
    clearPreviewDestroyedBlocks();
    return;
  }

  if (nowSeconds < nextShotPreviewRecomputeAt) {
    return;
  }

  nextShotPreviewRecomputeAt = nowSeconds + SHOT_PREVIEW_RECOMPUTE_INTERVAL_SECONDS;

  const start = getProjectileStart(player);
  const preview = sampleShotTrajectory(start, shotParameters.velocity);

  landingMarker.visible = true;
  landingMarker.position.set(
    toRenderUnits(preview.landingPoint.x),
    toRenderUnits(preview.landingPoint.y + 0.06),
    toRenderUnits(preview.landingPoint.z),
  );
  setPreviewDestroyedBlocks(preview.destroyedBlocks);
}

function spawnExplosion(position, options = {}) {
  const enemyHit = Boolean(options.enemyHit);
  playExplosionSound(enemyHit ? 1.15 : 0.92);
  const explosion = {
    id: `explosion-${nextExplosionId}`,
    position: { ...position },
    age: 0,
    duration: enemyHit ? 0.52 : 0.35,
    enemyHit,
  };

  nextExplosionId += 1;
  explosions.push(explosion);
}

function resetExplosionParticle(fragment, enemyHit) {
  const directionX = Math.random() * 2 - 1;
  const directionY = Math.random() * 2 - 1 + 0.18;
  const directionZ = Math.random() * 2 - 1;
  const inverseLength = 1 / Math.hypot(directionX, directionY, directionZ);

  fragment.userData.direction.set(
    directionX * inverseLength,
    directionY * inverseLength,
    directionZ * inverseLength,
  );
  fragment.userData.speed = (enemyHit ? 6.8 : 5.4) + Math.random() * 3.8;
  fragment.userData.spin.set(
    (Math.random() - 0.5) * 0.38,
    (Math.random() - 0.5) * 0.38,
    (Math.random() - 0.5) * 0.38,
  );
}

function createExplosionVisual(enemyHit) {
  const material = new THREE.MeshBasicMaterial({
    color: enemyHit ? "#ff5b3d" : "#ffb366",
    transparent: true,
    opacity: enemyHit ? 0.78 : 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(explosionGeometry, material);
  const particleMaterial = new THREE.MeshBasicMaterial({
    color: enemyHit ? "#ffd6a1" : "#ffc27a",
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particleCount = enemyHit ? ENEMY_EXPLOSION_PARTICLE_COUNT : NORMAL_EXPLOSION_PARTICLE_COUNT;
  const particles = [];

  for (let index = 0; index < particleCount; index += 1) {
    const fragment = new THREE.Mesh(explosionFragmentGeometry, particleMaterial);
    fragment.userData.direction = new THREE.Vector3();
    fragment.userData.spin = new THREE.Vector3();
    fragment.visible = false;
    particles.push(fragment);
  }

  const light = enemyHit ? new THREE.PointLight("#ff6a4a", 24, 18 * WORLD_SCALE, 2) : null;

  return {
    enemyHit,
    mesh,
    particles,
    particleMaterial,
    light,
  };
}

function acquireExplosionVisual(enemyHit) {
  const pool = enemyHit ? explosionVisualPool.enemy : explosionVisualPool.normal;
  const visual = pool.pop() ?? createExplosionVisual(enemyHit);

  explosionGroup.add(visual.mesh);
  for (const fragment of visual.particles) {
    fragment.visible = true;
    explosionParticleGroup.add(fragment);
    resetExplosionParticle(fragment, enemyHit);
  }
  if (visual.light) {
    explosionLightGroup.add(visual.light);
  }

  return visual;
}

function releaseExplosionVisual(visual) {
  explosionGroup.remove(visual.mesh);
  for (const fragment of visual.particles) {
    fragment.visible = false;
    explosionParticleGroup.remove(fragment);
  }
  if (visual.light) {
    explosionLightGroup.remove(visual.light);
  }

  const pool = visual.enemyHit ? explosionVisualPool.enemy : explosionVisualPool.normal;
  pool.push(visual);
}

function stepProjectiles() {
  const nextProjectiles = [];

  for (const projectile of projectiles) {
    if (!projectile.alive) {
      continue;
    }

    stepProjectile(projectile, world.config);
    const impact = resolveProjectileImpact(projectile, world.blocks, liveExplosionOptions);

    if (impact.exploded) {
      awardDestroyedBlocksScore(projectile.ownerId, impact.destroyedBlocks);
      world.blocks = impact.remainingBlocks;
      markBlocksDirty();
      const enemyHit = impact.impactedBlock && impact.impactedBlock.ownerId !== projectile.ownerId;
      const impactPosition = impact.impactedBlock
        ? { x: impact.impactedBlock.x, y: impact.impactedBlock.y + 0.2, z: impact.impactedBlock.z }
        : projectile.position;
      spawnExplosion(impactPosition, { enemyHit });
      continue;
    }

    if (projectile.position.y <= world.config.baseY - 0.4 || projectile.ageTicks >= PROJECTILE_LIFETIME_TICKS) {
      projectile.alive = false;
      const groundExplosion = explodeBlocks(
        world.blocks,
        projectile.position,
        projectile.blastRadius,
        liveExplosionOptions,
      );
      awardDestroyedBlocksScore(projectile.ownerId, groundExplosion.destroyedBlocks);
      world.blocks = groundExplosion.remainingBlocks;
      markBlocksDirty();
      spawnExplosion(projectile.position);
      continue;
    }

    nextProjectiles.push(projectile);
  }

  projectiles = nextProjectiles;
}

function updateExplosions(deltaSeconds) {
  explosions = explosions.filter((explosion) => {
    explosion.age += deltaSeconds;
    return explosion.age < explosion.duration;
  });
}

function updateBots(nowSeconds) {
  const localPlayer = getLocalPlayer();
  if (!localPlayer?.alive || world.match.status !== "running") {
    return;
  }

  if (!playerHasFired && nowSeconds < roundStartedAt + BOT_OPENING_GRACE_SECONDS) {
    return;
  }

  const { min: botCooldownMin, max: botCooldownMax } = getBotCooldownRangeForLevel(currentLevel);

  for (const player of world.players) {
    if (player.playerId === LOCAL_PLAYER_ID || !player.alive) {
      continue;
    }

    if (nowSeconds < botNextThrow[player.playerId]) {
      continue;
    }

    if (!localPlayer?.alive) {
      continue;
    }
    const targetBlocks = getDestructibleBlocksForOwner(localPlayer.playerId);
    if (targetBlocks.length === 0) {
      botNextThrow[player.playerId] = nowSeconds + Math.min(0.35, botCooldownMin);
      continue;
    }

    let fired = false;
    const start = getProjectileStart(player);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const targetBlock = targetBlocks[Math.floor(Math.random() * targetBlocks.length)];
      const target = {
        x: targetBlock.x + (Math.random() - 0.5) * 0.1,
        y: targetBlock.y,
        z: targetBlock.z + (Math.random() - 0.5) * 0.1,
      };

      const launch = solveTargetedLaunch(start, target, 0.58);
      if (!launch) {
        continue;
      }

      const launchVelocity = {
        x: launch.velocity.x,
        y: launch.velocity.y,
        z: launch.velocity.z,
      };

      if (!simulateBotShotHitsDestructibleBlock(start, launchVelocity, localPlayer.playerId)) {
        continue;
      }

      createProjectileFromVelocity(player.playerId, start, launchVelocity);
      playShotSound();
      botNextThrow[player.playerId] =
        nowSeconds + botCooldownMin + Math.random() * (botCooldownMax - botCooldownMin);
      fired = true;
      break;
    }

    if (!fired) {
      botNextThrow[player.playerId] = nowSeconds + Math.min(0.3, botCooldownMin);
    }
  }
}

function updateMatchBanner() {
  const localPlayer = getLocalPlayer();

  const hideBannerAction = () => {
    if (!bannerAction) {
      return;
    }

    bannerAction.classList.add("hidden");
  };

  const showBannerAction = () => {
    if (!bannerAction) {
      return;
    }

    bannerAction.classList.remove("hidden");
  };

  const showGameOverBanner = () => {
    banner.classList.add("visible");
    banner.classList.add("game-over");
    bannerTitle.textContent = "Game Over";

    if (leaderboardQualifyingScore !== currentScore) {
      leaderboardQualifyingScore = currentScore;
      setInitialsFeedback("");
      if (initialsInput) {
        initialsInput.value = "";
      }
    }

    const eligibleForLeaderboard =
      currentScore > 0 &&
      scoreQualifiesForLeaderboard(currentScore) &&
      leaderboardSubmittedScore !== currentScore;

    if (eligibleForLeaderboard) {
      bannerText.textContent = `Score ${currentScore}. Top 10 reached. Enter up to 4 letters.`;
      showInitialsForm();
    } else {
      bannerText.textContent = `Final score: ${currentScore}`;
      hideInitialsForm();
    }

    showBannerAction();
  };

  setInteractionMode();

  if (levelSequenceState) {
    banner.classList.remove("visible");
    banner.classList.remove("game-over");
    hideBannerAction();
    hideInitialsForm();
    setInitialsFeedback("");
    return;
  }

  if (world.match.status === "finished") {
    if (!localPlayer?.alive) {
      showGameOverBanner();
      return;
    }

    banner.classList.add("visible");
    banner.classList.remove("game-over");
    hideBannerAction();
    hideInitialsForm();
    setInitialsFeedback("");

    if (world.match.winnerId === LOCAL_PLAYER_ID) {
      bannerTitle.textContent = "You Win";
      bannerText.textContent = "All enemy piles have collapsed. Press R to restart.";
      return;
    }

    if (world.match.winnerId === null) {
      bannerTitle.textContent = "Draw";
      bannerText.textContent = "Everyone fell. Press R to restart the round.";
      return;
    }

    bannerTitle.textContent = localPlayer?.alive ? "Defeat" : "You Fell";
    bannerText.textContent = "A rival survived the chasm. Press R to restart.";
    return;
  }

  if (!localPlayer?.alive) {
    showGameOverBanner();
    return;
  }

  banner.classList.remove("visible");
  banner.classList.remove("game-over");
  hideBannerAction();
  hideInitialsForm();
}

function getBlockKey(x, y, z) {
  return `${x}:${y}:${z}`;
}

function syncBlocks(nowSeconds) {
  const deadPlayerIds = world.players.filter((player) => !player.alive).map((player) => player.playerId);

  for (const ownerId of deadPlayerIds) {
    if (!deadOwnerDissolveStartById.has(ownerId)) {
      deadOwnerDissolveStartById.set(ownerId, nowSeconds);
      blockMaterialDirty = true;
    }
  }

  const finishedOwnerIds = [];
  for (const [ownerId, startTime] of deadOwnerDissolveStartById.entries()) {
    if (nowSeconds - startTime >= DEAD_PLATFORM_DISSOLVE_SECONDS) {
      finishedOwnerIds.push(ownerId);
    }
  }

  if (finishedOwnerIds.length > 0) {
    const finishedOwners = new Set(finishedOwnerIds);
    world.blocks = world.blocks.filter((block) => !finishedOwners.has(block.ownerId));
    for (const ownerId of finishedOwnerIds) {
      deadOwnerDissolveStartById.delete(ownerId);
    }
    markBlocksDirty();
  }

  let positionsNeedUpdate = hasActiveBlockVisualOffsets || deadOwnerDissolveStartById.size > 0;

  if (blockRenderDirty) {
    const { visibleBlocks, visibleKeys, destroyableKeys } = analyzeRenderableBlocks(world.blocks);
    renderedBlocks = visibleBlocks;
    renderedDestroyableKeys = destroyableKeys;
    positionsNeedUpdate = true;

    for (const block of renderedBlocks) {
      const key = getBlockKey(block.x, block.y, block.z);
      const visualOffset = getBlockOwnerVisualOffset(block.ownerId);

      if (!blockMeshes.has(key)) {
        const mesh = new THREE.Mesh(blockGeometry, getBlockMaterial(block.ownerId));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        blockMeshes.set(key, mesh);
        blockGroup.add(mesh);
      }

      blockMeshes.get(key).position.set(
        toRenderUnits(block.x) + visualOffset.x,
        toRenderUnits(block.y),
        toRenderUnits(block.z) + visualOffset.z,
      );
    }

    for (const [key, mesh] of blockMeshes) {
      if (visibleKeys.has(key)) {
        continue;
      }

      blockGroup.remove(mesh);
      blockMeshes.delete(key);
    }

    blockRenderDirty = false;
    blockMaterialDirty = true;
  }

  const aliveSignature = getAlivePlayerSignature();
  const shouldUpdateMaterials = blockMaterialDirty || aliveSignature !== lastAlivePlayerSignature;
  if (!positionsNeedUpdate && !shouldUpdateMaterials) {
    return;
  }

  const alivePlayerIds = shouldUpdateMaterials
    ? new Set(world.players.filter((player) => player.alive).map((player) => player.playerId))
    : null;

  for (const block of renderedBlocks) {
    const key = getBlockKey(block.x, block.y, block.z);
    const mesh = blockMeshes.get(key);
    if (!mesh) {
      continue;
    }

    const dissolveStart = deadOwnerDissolveStartById.get(block.ownerId);
    const dissolveProgress = dissolveStart == null
      ? 0
      : THREE.MathUtils.clamp((nowSeconds - dissolveStart) / DEAD_PLATFORM_DISSOLVE_SECONDS, 0, 1);

    if (shouldUpdateMaterials) {
      if (dissolveStart != null) {
        const dissolveMaterial = getDeadDissolveMaterial(block.ownerId, renderedDestroyableKeys.has(key));
        dissolveMaterial.opacity = Math.max(0, 1 - dissolveProgress);
        mesh.material = dissolveMaterial;
      } else if (previewDestroyedBlockKeys.has(key)) {
        mesh.material = getPreviewBlockMaterial(block.ownerId);
      } else if (renderedDestroyableKeys.has(key)) {
        mesh.material = alivePlayerIds.has(block.ownerId)
          ? getDestroyableBlockMaterial(block.ownerId)
          : deadDestroyableBlockMaterial;
      } else {
        mesh.material = alivePlayerIds.has(block.ownerId) ? getBlockMaterial(block.ownerId) : deadBlockMaterial;
      }
    }

    if (!positionsNeedUpdate) {
      continue;
    }

    const visualOffset = getBlockOwnerVisualOffset(block.ownerId);
    const sinkOffset = dissolveStart == null ? 0 : toRenderUnits(DEAD_PLATFORM_SINK_DISTANCE * dissolveProgress);
    mesh.position.set(
      toRenderUnits(block.x) + visualOffset.x,
      toRenderUnits(block.y) - sinkOffset,
      toRenderUnits(block.z) + visualOffset.z,
    );
  }

  if (shouldUpdateMaterials) {
    blockMaterialDirty = false;
    lastAlivePlayerSignature = aliveSignature;
  }
}

function syncPlayers(deltaSeconds) {
  for (const player of world.players) {
    if (!playerMeshes.has(player.playerId)) {
      const visual = createPlayerVisual(player.playerId);
      playerMeshes.set(player.playerId, visual);
      playerGroup.add(visual);
    }

    const visual = playerMeshes.get(player.playerId);
    visual.visible = player.alive;
    if (visual.isMesh) {
      visual.material = getPlayerMaterial(player.playerId);
    }

    if (!player.alive) {
      continue;
    }

    const targetY = player.y + PLAYER_VISUAL_Y_OFFSET;
    const visualOffset = getBlockOwnerVisualOffset(player.playerId);
    playerVisualTarget.set(
      toRenderUnits(player.x) + visualOffset.x,
      toRenderUnits(targetY),
      toRenderUnits(player.z) + visualOffset.z,
    );
    visual.position.lerp(playerVisualTarget, Math.min(1, deltaSeconds * 18));
  }
}

function syncProjectiles() {
  const nextIds = new Set();

  for (const projectile of projectiles) {
    nextIds.add(projectile.id);

    if (!projectileMeshes.has(projectile.id)) {
      const mesh = new THREE.Mesh(projectileGeometry, projectileMaterials);
      mesh.castShadow = true;
      projectileMeshes.set(projectile.id, mesh);
      projectileGroup.add(mesh);
    }

    projectileMeshes.get(projectile.id).position.set(
      toRenderUnits(projectile.position.x),
      toRenderUnits(projectile.position.y),
      toRenderUnits(projectile.position.z),
    );
  }

  for (const [id, mesh] of projectileMeshes) {
    if (nextIds.has(id)) {
      continue;
    }

    projectileGroup.remove(mesh);
    projectileMeshes.delete(id);
  }
}

function syncExplosions() {
  const nextIds = new Set();

  for (const explosion of explosions) {
    nextIds.add(explosion.id);

    if (!explosionVisuals.has(explosion.id)) {
      explosionVisuals.set(explosion.id, acquireExplosionVisual(explosion.enemyHit));
    }

    const visual = explosionVisuals.get(explosion.id);
    const mesh = visual.mesh;
    const progress = explosion.age / explosion.duration;
    const scale = explosion.enemyHit ? 0.55 + progress * 3.2 : 0.35 + progress * 2.2;
    mesh.position.set(
      toRenderUnits(explosion.position.x),
      toRenderUnits(explosion.position.y),
      toRenderUnits(explosion.position.z),
    );
    mesh.scale.setScalar(scale);
    mesh.material.opacity = explosion.enemyHit
      ? Math.max(0, 0.8 - progress * 0.8)
      : Math.max(0, 0.55 - progress * 0.55);

    const drag = 1 - progress * 0.34;
    for (const fragment of visual.particles) {
      const travel = fragment.userData.speed * progress * drag;
      const drift = 1.05 * progress * progress;
      fragment.position.set(
        toRenderUnits(explosion.position.x) + fragment.userData.direction.x * toRenderUnits(travel),
        toRenderUnits(explosion.position.y) + fragment.userData.direction.y * toRenderUnits(travel) - toRenderUnits(drift),
        toRenderUnits(explosion.position.z) + fragment.userData.direction.z * toRenderUnits(travel),
      );
      fragment.rotation.x += fragment.userData.spin.x;
      fragment.rotation.y += fragment.userData.spin.y;
      fragment.rotation.z += fragment.userData.spin.z;
    }
    visual.particleMaterial.opacity = Math.max(0, 1.0 - progress * 0.9);

    if (visual.light) {
      const flash = visual.light;
      flash.position.set(
        toRenderUnits(explosion.position.x),
        toRenderUnits(explosion.position.y + 0.4),
        toRenderUnits(explosion.position.z),
      );
      flash.intensity = Math.max(0, 22 * (1 - progress));
    }
  }

  for (const [id, visual] of explosionVisuals) {
    if (nextIds.has(id)) {
      continue;
    }

    releaseExplosionVisual(visual);
    explosionVisuals.delete(id);
  }
}

function updateHud(nowSeconds) {
  if (nowSeconds < nextHudUpdateAtSeconds) {
    return;
  }
  nextHudUpdateAtSeconds = nowSeconds + HUD_UPDATE_INTERVAL_SECONDS;

  const localPlayer = getLocalPlayer();
  const aliveCount = getAlivePlayers().length;
  const tntReadyIn = Math.max(0, nextTntTime - nowSeconds);
  const active = isGameplayActive();

  if (shotState.charging) {
    const shotParameters = getPlayerShotParameters();
    shotState.arcControl = shotParameters.arcControl;
    shotState.power = shotParameters.power;
    shotState.angle = shotParameters.angle;
  }

  const arcPercent = Math.round(shotState.arcControl * 100);
  const chargeText = shotState.charging
    ? ` | Arc <strong>${arcPercent}%</strong> | Power <strong>${shotState.power.toFixed(0)}</strong>`
    : active
      ? " | Reticle sets landing point"
      : " | Mouse released";
  const statusHtml = `Alive: <strong>${aliveCount}</strong> | You: <strong>${localPlayer?.alive ? "in" : "out"}</strong>`;
  const scoreText = String(currentScore);
  const highScoreText = String(highScore);
  const modeHtml = `Mode: <strong>${active ? "playing" : "stopped"}</strong>`;
  const cooldownHtml = `TNT ${tntReadyIn === 0 ? "<strong>ready</strong>" : `${tntReadyIn.toFixed(1)}s`}${chargeText}`;

  if (statusLine && statusHtml !== lastStatusHtml) {
    statusLine.innerHTML = statusHtml;
    lastStatusHtml = statusHtml;
  }
  if (scoreValue && scoreText !== lastScoreText) {
    scoreValue.textContent = scoreText;
    lastScoreText = scoreText;
  }
  if (highScoreValue && highScoreText !== lastHighScoreText) {
    highScoreValue.textContent = highScoreText;
    lastHighScoreText = highScoreText;
  }
  if (modeLine && modeHtml !== lastModeHtml) {
    modeLine.innerHTML = modeHtml;
    lastModeHtml = modeHtml;
  }
  if (cooldownLine && cooldownHtml !== lastCooldownHtml) {
    cooldownLine.innerHTML = cooldownHtml;
    lastCooldownHtml = cooldownHtml;
  }
}

function initMusicControls() {
  if (volumeToggle && volumeControls) {
    volumeToggle.addEventListener("click", () => {
      const expanded = volumeToggle.getAttribute("aria-expanded") !== "true";
      volumeToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      volumeControls.classList.toggle("collapsed", !expanded);
      volumeToggle.textContent = "🎚";
      volumeToggle.setAttribute("aria-label", expanded ? "Hide volume sliders" : "Show volume sliders");
    });
  }

  if (allVolume) {
    allVolume.addEventListener("input", () => {
      const value = Number(allVolume.value);
      if (Number.isFinite(value)) {
        setMasterVolume(value / 100);
      }
    });
  }

  if (musicVolume) {
    musicVolume.addEventListener("input", () => {
      const value = Number(musicVolume.value);
      if (Number.isFinite(value)) {
        setMusicVolume(value / 100);
      }
    });
  }

  if (sfxVolume) {
    sfxVolume.addEventListener("input", () => {
      const value = Number(sfxVolume.value);
      if (Number.isFinite(value)) {
        setSfxVolume(value / 100);
      }
    });
  }

  if (musicMute) {
    musicMute.addEventListener("click", () => {
      setMusicMuted(!bgmMuted);
      ensureAudioUnlocked();
    });
  }

  if (infoToggle && infoModal) {
    infoToggle.addEventListener("click", () => {
      const expanded = infoToggle.getAttribute("aria-expanded") !== "true";
      setInfoModalOpen(expanded);
    });
  }

  if (infoModalClose) {
    infoModalClose.addEventListener("click", () => {
      setInfoModalOpen(false);
    });
  }

  if (infoModal) {
    infoModal.addEventListener("click", (event) => {
      if (event.target === infoModal) {
        setInfoModalOpen(false);
      }
    });
  }

  updateMusicUi();
}

function updateCamera(deltaSeconds, nowSeconds) {
  if (!gameHasStarted && gamePaused && !levelSequenceState) {
    return;
  }

  if (updateCinematicCamera(nowSeconds)) {
    return;
  }

  const player = getLocalPlayer();
  if (!player) {
    return;
  }

  const horizontalDistance = Math.cos(cameraState.pitch) * cameraState.distance;
  const verticalDistance = Math.sin(cameraState.pitch) * cameraState.distance;
  const facingVector = getFacingVector();

  cameraTarget.set(
    toRenderUnits(player.x + facingVector.x * 7),
    toRenderUnits(player.y + 2.3),
    toRenderUnits(player.z + facingVector.z * 7),
  );
  cameraGoal.set(
    toRenderUnits(player.x) - facingVector.x * horizontalDistance,
    toRenderUnits(player.y) + verticalDistance,
    toRenderUnits(player.z) - facingVector.z * horizontalDistance,
  );
  camera.position.lerp(cameraGoal, Math.min(1, deltaSeconds * 4));
  camera.lookAt(cameraTarget);
}

function updateFloorGrid(deltaSeconds, nowSeconds) {
  const headingX = -Math.sin(cameraState.yaw);
  const headingZ = -Math.cos(cameraState.yaw);
  const sideX = -headingZ;
  const sideZ = headingX;
  const pitchBlend = 1 - THREE.MathUtils.inverseLerp(MIN_CAMERA_PITCH, MAX_CAMERA_PITCH, cameraState.pitch);
  const parallaxIntensity = THREE.MathUtils.lerp(GRID_PARALLAX_MIN_INTENSITY, 1, pitchBlend);

  gridScrollPrimaryX -= headingX * GRID_TRAVEL_SPEED_PRIMARY * deltaSeconds;
  gridScrollPrimaryZ -= headingZ * GRID_TRAVEL_SPEED_PRIMARY * deltaSeconds;
  gridScrollSecondaryX -= headingX * GRID_TRAVEL_SPEED_SECONDARY * deltaSeconds;
  gridScrollSecondaryZ -= headingZ * GRID_TRAVEL_SPEED_SECONDARY * deltaSeconds;

  gridScrollPrimaryX = THREE.MathUtils.euclideanModulo(gridScrollPrimaryX, GRID_CELL_SIZE);
  gridScrollPrimaryZ = THREE.MathUtils.euclideanModulo(gridScrollPrimaryZ, GRID_CELL_SIZE);
  gridScrollSecondaryX = THREE.MathUtils.euclideanModulo(gridScrollSecondaryX, GRID_CELL_SIZE);
  gridScrollSecondaryZ = THREE.MathUtils.euclideanModulo(gridScrollSecondaryZ, GRID_CELL_SIZE);

  const anchorX = camera.position.x;
  const anchorZ = camera.position.z;

  grid.position.x = anchorX + gridScrollPrimaryX;
  grid.position.z = anchorZ + gridScrollPrimaryZ;

  gridSecondary.position.x =
    anchorX + gridScrollSecondaryX +
    sideX * (GRID_CELL_SIZE * GRID_SECONDARY_SIDE_OFFSET_FACTOR * parallaxIntensity) +
    headingX * (GRID_CELL_SIZE * GRID_SECONDARY_BACK_OFFSET_FACTOR * parallaxIntensity);
  gridSecondary.position.z =
    anchorZ + gridScrollSecondaryZ +
    sideZ * (GRID_CELL_SIZE * GRID_SECONDARY_SIDE_OFFSET_FACTOR * parallaxIntensity) +
    headingZ * (GRID_CELL_SIZE * GRID_SECONDARY_BACK_OFFSET_FACTOR * parallaxIntensity);

  const pulse = 0.5 + 0.5 * Math.sin(nowSeconds * GRID_PULSE_SPEED);
  setGridOpacity(grid, 0.45 + 0.35 * pulse);
  setGridOpacity(gridSecondary, 0.08 + 0.15 * (1 - pulse));
}

function updateAtmosphericParticles(deltaSeconds) {
  if (atmosphericParticles.length === 0) {
    return;
  }

  const waitingToStart = !gameHasStarted && gamePaused && !levelSequenceState;
  let gameplayInitialized = updateAtmosphericParticles.gameplayInitialized ?? false;

  // Show/hide TNT blocks based on game state
  for (const tntBlock of atmosphericTNTParticles) {
    tntBlock.visible = waitingToStart;
  }

  if (waitingToStart) {
    camera.getWorldDirection(atmosphericForward).normalize();
    atmosphericRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    atmosphericUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

    // Update regular stars
    for (const particle of atmosphericParticles) {
      const speed = particle.userData.prestartSpeed ?? ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN;
      particle.position.addScaledVector(atmosphericForward, -speed * deltaSeconds);

      const depthAlongView = atmosphericOffset
        .copy(particle.position)
        .sub(camera.position)
        .dot(atmosphericForward);

      if (depthAlongView >= ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_NEAR) {
        continue;
      }

      const depth = THREE.MathUtils.lerp(
        ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_FAR * 0.55,
        ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_FAR,
        Math.random(),
      );
      const lateral = (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_PRESTART_LATERAL_SPREAD;
      const vertical = (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_PRESTART_VERTICAL_SPREAD;
      const newSpeed = THREE.MathUtils.lerp(
        ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN,
        ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MAX,
        Math.random(),
      );

      particle.userData.prestartSpeed = newSpeed;
      particle.position
        .copy(camera.position)
        .addScaledVector(atmosphericForward, depth)
        .addScaledVector(atmosphericRight, lateral)
        .addScaledVector(atmosphericUp, vertical);
    }

    // Update TNT blocks during pregame
    for (const tntBlock of atmosphericTNTParticles) {
      const speed = tntBlock.userData.prestartSpeed ?? ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN;
      tntBlock.position.addScaledVector(atmosphericForward, -speed * deltaSeconds);

      // Rotate TNT blocks
      tntBlock.rotation.x += deltaSeconds * 2.5;
      tntBlock.rotation.y += deltaSeconds * 1.8;
      tntBlock.rotation.z += deltaSeconds * 1.3;

      const depthAlongView = atmosphericOffset
        .copy(tntBlock.position)
        .sub(camera.position)
        .dot(atmosphericForward);

      if (depthAlongView >= ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_NEAR) {
        continue;
      }

      const depth = THREE.MathUtils.lerp(
        ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_FAR * 0.55,
        ATMOSPHERIC_PARTICLE_PRESTART_RESPAWN_FAR,
        Math.random(),
      );
      const lateral = (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_PRESTART_LATERAL_SPREAD;
      const vertical = (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_PRESTART_VERTICAL_SPREAD;
      const newSpeed = THREE.MathUtils.lerp(
        ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MIN,
        ATMOSPHERIC_PARTICLE_PRESTART_SPEED_MAX,
        Math.random(),
      );

      tntBlock.userData.prestartSpeed = newSpeed;
      tntBlock.position
        .copy(camera.position)
        .addScaledVector(atmosphericForward, depth)
        .addScaledVector(atmosphericRight, lateral)
        .addScaledVector(atmosphericUp, vertical);
    }

    updateAtmosphericParticles.gameplayInitialized = false;
    return;
  }

  // Reset star positions when transitioning to gameplay
  if (!gameplayInitialized) {
    for (const particle of atmosphericParticles) {
      particle.position.set(
        (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
        Math.random() * 24 + 16,
        (Math.random() - 0.5) * ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2,
      );
    }
    updateAtmosphericParticles.gameplayInitialized = true;
  }

  const headingX = -Math.sin(cameraState.yaw);
  const headingZ = -Math.cos(cameraState.yaw);
  const driftX = -headingX * ATMOSPHERIC_PARTICLE_DRIFT_SPEED * deltaSeconds;
  const driftZ = -headingZ * ATMOSPHERIC_PARTICLE_DRIFT_SPEED * deltaSeconds;
  const minX = camera.position.x - ATMOSPHERIC_PARTICLE_FIELD_RADIUS;
  const maxX = camera.position.x + ATMOSPHERIC_PARTICLE_FIELD_RADIUS;
  const minZ = camera.position.z - ATMOSPHERIC_PARTICLE_FIELD_RADIUS;
  const maxZ = camera.position.z + ATMOSPHERIC_PARTICLE_FIELD_RADIUS;
  const diameter = ATMOSPHERIC_PARTICLE_FIELD_RADIUS * 2;

  for (const particle of atmosphericParticles) {
    particle.position.x += driftX;
    particle.position.z += driftZ;

    if (particle.position.x < minX) {
      particle.position.x += diameter;
    } else if (particle.position.x > maxX) {
      particle.position.x -= diameter;
    }

    if (particle.position.z < minZ) {
      particle.position.z += diameter;
    } else if (particle.position.z > maxZ) {
      particle.position.z -= diameter;
    }
  }
}

function updateFpsCounter(deltaSeconds) {
  if (!fpsCounter) {
    return;
  }

  fpsSampleSeconds += deltaSeconds;
  fpsSampleFrames += 1;

  if (fpsSampleSeconds < 0.25) {
    return;
  }

  const fps = Math.round(fpsSampleFrames / fpsSampleSeconds);
  fpsCounter.textContent = `${fps} FPS`;
  fpsSampleSeconds = 0;
  fpsSampleFrames = 0;
}

function tick(nowSeconds) {
  const intents = {
    [LOCAL_PLAYER_ID]: getMovementIntent(),
    ...getBotMovementIntents(nowSeconds),
  };

  stepSimulation(world, intents);
  if (world.match.status === "finished" && world.match.winnerId === LOCAL_PLAYER_ID) {
    if (!levelSequenceState) {
      currentLevel += 1;
      resetGame({ preserveScore: true, preserveLevel: true });
      startLevelSequence(nowSeconds, {
        targetLevel: currentLevel,
        includeRoundCleared: true,
        sequenceType: "transition",
      });
    }
    return;
  }

  if (didPileMotionStepOccur()) {
    updateVisualOffsetsFromPileMotion();
    markBlocksDirty();
  }
  inputState.jumpQueued = false;

  processHoldFire(nowSeconds);
  updateBots(nowSeconds);
  stepProjectiles();
  updateMatchBanner();
}

function animate(now) {
  const nowSeconds = now / 1000;
  const deltaSeconds = Math.min(0.1, (now - lastFrameTime) / 1000);
  updateLevelSequence(nowSeconds);
  const gameplayActive = isGameplayActive() && !levelSequenceState;
  lastFrameTime = now;

  if (gameplayActive) {
    accumulator += deltaSeconds;
  } else {
    accumulator = 0;
  }

  easeBlockOwnerVisualOffsets(deltaSeconds);

  if (gameplayActive) {
    let fixedStepsThisFrame = 0;
    while (accumulator >= world.config.fixedDeltaSeconds && fixedStepsThisFrame < MAX_FIXED_STEPS_PER_FRAME) {
      tick(nowSeconds);
      accumulator -= world.config.fixedDeltaSeconds;
      fixedStepsThisFrame += 1;
    }

    // Drop excess backlog to avoid long catch-up bursts causing visible freezes.
    if (accumulator >= world.config.fixedDeltaSeconds) {
      accumulator = 0;
    }
  }

  scheduleBackgroundMusic();

  if (now >= nextLeaderboardRefreshAt && !leaderboardFetchInFlight) {
    void fetchLeaderboard();
  }

  updateExplosions(deltaSeconds);
  updateScorePopups(deltaSeconds);
  updateCamera(deltaSeconds, nowSeconds);
  updateFloorGrid(deltaSeconds, nowSeconds);
  updateAtmosphericParticles(deltaSeconds);
  updateFpsCounter(deltaSeconds);
  updateAimPoint(nowSeconds);
  updateShotPreview(nowSeconds);
  updateHud(nowSeconds);
  syncBlocks(nowSeconds);
  syncPlayers(deltaSeconds);
  syncProjectiles();
  syncExplosions();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function rotateCameraFromPointer(event) {
  if (!isPointerLocked()) {
    return;
  }

  cameraState.yaw -= event.movementX * 0.008;
  cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + event.movementY * 0.006, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  ensureAudioUnlocked();

  if (event.code === "Escape" && infoModal && !infoModal.classList.contains("hidden")) {
    event.preventDefault();
    setInfoModalOpen(false);
    return;
  }

  if (event.repeat) {
    return;
  }

  if (event.code === "KeyM") {
    setMusicMuted(!bgmMuted);
    return;
  }

  if (event.code === "BracketLeft") {
    setMusicVolume(bgmVolumeLevel - 0.05);
    return;
  }

  if (event.code === "BracketRight") {
    setMusicVolume(bgmVolumeLevel + 0.05);
    return;
  }

  const isLeaderboardShortcut =
    event.code === "F10"
    || event.key === "F10"
    || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "KeyL")
    || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l");

  if (isLeaderboardShortcut) {
    event.preventDefault();
    triggerLeaderboardTestShortcut();
    return;
  }

  if (event.code === "KeyW") {
    inputState.forward = true;
  }
  if (event.code === "KeyS") {
    inputState.backward = true;
  }
  if (event.code === "KeyA") {
    inputState.left = true;
  }
  if (event.code === "KeyD") {
    inputState.right = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    inputState.jumpQueued = true;
  }
  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyW") {
    inputState.forward = false;
  }
  if (event.code === "KeyS") {
    inputState.backward = false;
  }
  if (event.code === "KeyA") {
    inputState.left = false;
  }
  if (event.code === "KeyD") {
    inputState.right = false;
  }
});

renderer.domElement.addEventListener("mousemove", (event) => {
  rotateCameraFromPointer(event);
});

renderer.domElement.addEventListener("mousedown", (event) => {
  ensureAudioUnlocked();

  if (gamePaused) {
    return;
  }

  requestPointerLock();

  if (!isPointerLocked()) {
    return;
  }

  if (event.button === 0) {
    startChargeShot(performance.now() / 1000);
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    releaseChargeShot();
  }
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("pointerlockchange", () => {
  if (!isPointerLocked() && isGameplayPlayable()) {
    gamePaused = true;
  }

  if (isPointerLocked() && isGameplayPlayable()) {
    gamePaused = false;
    gameHasStarted = true;
  }

  setInteractionMode();

  if (!isPointerLocked()) {
    releaseChargeShot();
  }
});

window.addEventListener("blur", () => {
  inputState.forward = false;
  inputState.backward = false;
  inputState.left = false;
  inputState.right = false;
  releaseChargeShot();

  if (isGameplayPlayable()) {
    gamePaused = true;
    setInteractionMode();
  }
});

if (pauseAction) {
  pauseAction.addEventListener("click", () => {
    beginOrResumeGame();
  });
}

if (bannerAction) {
  bannerAction.addEventListener("click", () => {
    // Keep restart blocked only while a submission is in-flight.
    if (leaderboardSubmitInFlight) {
      return;
    }
    resetGame();
    beginOrResumeGame();
  });
}

if (initialsInput) {
  initialsInput.addEventListener("input", () => {
    const normalized = normalizeInitials(initialsInput.value);
    if (initialsInput.value !== normalized) {
      initialsInput.value = normalized;
    }
  });
}

if (initialsForm) {
  initialsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!scoreQualifiesForLeaderboard(currentScore) || leaderboardSubmittedScore === currentScore) {
      setInitialsFeedback("Score no longer qualifies for top 10.");
      hideInitialsForm();
      return;
    }

    const initials = normalizeInitials(initialsInput?.value ?? "");
    if (!isInitialsAllowed(initials)) {
      setInitialsFeedback("Enter 1-4 letters. Offensive combinations are blocked.");
      return;
    }

    void submitLeaderboardEntry(initials, currentScore, currentLevel);
  });
}

loadHighScore();
renderLeaderboard();
void fetchLeaderboard();
loadAudioSettings();
ensureEnemyModelLoading();
resetGame();
gamePaused = true;
setCameraToIntroStartPosition();
setInteractionMode();
initMusicControls();
requestAnimationFrame(animate);