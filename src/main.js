import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VV } from './VV.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020); // Darker background for contrast
scene.fog = new THREE.Fog(0x202020, 5000, 15000); // Fog to fade out the room

// Cameras
let currentCamera;
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 5000; // Millimeters visible vertically in ortho

const perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 10, 50000);
perspectiveCamera.position.set(0, 1600, 4500);

const orthoCamera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    10,
    50000
);
orthoCamera.position.set(0, 1600, 4500);

currentCamera = perspectiveCamera; // Start with perspective

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Shadows ON for contrast
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.querySelector('#app').appendChild(renderer.domElement);

const controls = new OrbitControls(currentCamera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false; // Disable panning to keep wall centered
controls.target.set(0, 1250, 0); // Default center
controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor

// --- Environment & Lighting ---
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

// 1. Ambient (Low, for contrast)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// 2. Key Light (Spotlight, Dramatic)
const spotLight = new THREE.SpotLight(0xffeeb1, 2); // Warm-ish
spotLight.position.set(3000, 5000, 4000);
spotLight.angle = Math.PI / 6;
spotLight.penumbra = 0.5;
spotLight.decay = 0;
spotLight.distance = 50000;
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
scene.add(spotLight);

// 3. Fill Light (Cool, Soft)
const fillLight = new THREE.PointLight(0xcceeff, 1);
fillLight.decay = 0;
fillLight.position.set(-3000, 2000, 4000);
scene.add(fillLight);

// 4. Rim Light (Back, for separation)
const rimLight = new THREE.SpotLight(0xffffff, 2);
rimLight.decay = 0;
rimLight.position.set(0, 4000, -5000);
rimLight.lookAt(0, 0, 0);
scene.add(rimLight);

// --- Room / Floor ---
// Concrete Material
const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.9,
    metalness: 0.1
});

// Floor
const floorGeo = new THREE.PlaneGeometry(20000, 20000);
const floor = new THREE.Mesh(floorGeo, concreteMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Back Wall
const backWallGeo = new THREE.PlaneGeometry(20000, 10000);
const backWall = new THREE.Mesh(backWallGeo, concreteMaterial);
backWall.position.set(0, 5000, -3000); // 3m behind center
backWall.receiveShadow = true;
scene.add(backWall);

// --- Model Initialization ---
const vv = new VV(scene);

// Initialize with values from UI
const initLength = parseFloat(document.getElementById('totalLength').value);
const initHeight = parseFloat(document.getElementById('height').value);
const initSections = parseInt(document.getElementById('sections').value);
vv.setDimensions(initLength, initHeight, initSections);

// --- Interaction ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    if (event.target.closest('#ui-panel')) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, currentCamera);

    // Intersect with the wall group children
    const intersects = raycaster.intersectObjects(vv.wallGroup.children, true);
    if (intersects.length > 0) {
        vv.toggleFold();
    }
});

// --- UI Events ---
document.getElementById('updateBtn').addEventListener('click', () => {
    const totalLength = parseFloat(document.getElementById('totalLength').value);
    const height = parseFloat(document.getElementById('height').value);
    const sections = parseInt(document.getElementById('sections').value);

    vv.setDimensions(totalLength, height, sections);
});

document.getElementById('foldFrontBtn').addEventListener('click', () => vv.foldFront());
document.getElementById('unfoldBtn').addEventListener('click', () => vv.unfold());
document.getElementById('foldBackBtn').addEventListener('click', () => vv.foldBack());

document.getElementById('wallColor').addEventListener('input', (e) => {
    vv.updateColor(e.target.value);
});

// --- View Controls ---
function updateCameraView(camX, camY, camZ, targetX, targetY, targetZ) {
    currentCamera.position.set(camX, camY, camZ);
    controls.target.set(targetX, targetY, targetZ);
    controls.update();
}

document.getElementById('viewFront').addEventListener('click', () => {
    const centerY = vv.state.height / 2;
    updateCameraView(0, centerY, 4500, 0, centerY, 0);
});
document.getElementById('viewTop').addEventListener('click', () => {
    // const centerY = vv.state.height / 2000; // Unused
    updateCameraView(0, 6000, 0, 0, 0, 0);
});
document.getElementById('viewSide').addEventListener('click', () => {
    const centerY = vv.state.height / 2;
    updateCameraView(4000, centerY, 0, 0, centerY, 0);
});

document.getElementById('toggleCamera').addEventListener('click', () => {
    // Save current state
    const pos = currentCamera.position.clone();
    const target = controls.target.clone();

    // Switch
    if (currentCamera === perspectiveCamera) {
        currentCamera = orthoCamera;
        // Hide environment in Ortho
        floor.visible = false;
        backWall.visible = false;
    } else {
        currentCamera = perspectiveCamera;
        // Show environment in Perspective
        floor.visible = true;
        backWall.visible = true;
    }

    // Restore state
    currentCamera.position.copy(pos);
    controls.object = currentCamera;
    controls.target.copy(target);
    controls.update();
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    vv.update();
    controls.update();
    renderer.render(scene, currentCamera);
}

// Resize handler
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;

    // Update Perspective
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();

    // Update Ortho
    orthoCamera.left = -frustumSize * aspect / 2;
    orthoCamera.right = frustumSize * aspect / 2;
    orthoCamera.top = frustumSize / 2;
    orthoCamera.bottom = -frustumSize / 2;
    orthoCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
