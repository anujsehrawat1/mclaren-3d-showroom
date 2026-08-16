import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';

// --- Application State ---
let scene, camera, renderer, controls;
let carModel = null;
let activeIndex = -1;
let isAnimating = false;

// Interactive features state
const doorNodes = [];
let doorsOpen = false;
const spoilerNodes = [];
let drsActive = false;
let audioCtx = null;
let engineNode = null;
let engineRunning = false;
let tourInterval = null;
let isTourRunning = false;

// DOM Elements
const loaderEl = document.getElementById('loader');
const loaderBarEl = document.getElementById('loader-bar');
const loaderTextEl = document.getElementById('loader-text');
const hudTopEl = document.getElementById('hud-top');
const partTitleEl = document.getElementById('part-title');
const partDescEl = document.getElementById('part-description');
const partsListEl = document.getElementById('parts-list');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');
const navIndicatorEl = document.getElementById('nav-indicator');
const sidePanelEl = document.getElementById('side-panel');
const panelToggleEl = document.getElementById('panel-toggle');
const annotationsContainerEl = document.getElementById('annotations-container');
const svgOverlayEl = document.getElementById('svg-overlay');

// --- Parts & Hotspots Data ---
// Coordinates are normalized assuming car is centered at (0,0,0)
// and scaled to standard box: Width (X) ~2.0, Height (Y) ~1.1, Length (Z) ~4.5.
// Front of the car is at +Z, Rear is at -Z.
const carParts = [
    {
        name: "Overview",
        shortDesc: "Experience the McLaren Hypercar. Crafted from carbon fiber, engineered with aerodynamic precision, and powered by an advanced twin-turbocharged hybrid powertrain. Select an individual component to inspect its engineering design.",
        cameraPos: { x: 3.5, y: 1.8, z: 4.0 },
        lookAt: { x: 0, y: 0.1, z: 0 },
        annotations: []
    },
    {
        name: "Active Front Splitter",
        shortDesc: "The active front splitter dynamically adjusts its angle to balance downforce between front and rear axles. Constructed from high-tensile carbon fiber, it guides clean air under the floor to feed Venturi tunnels.",
        cameraPos: { x: 0.5, y: -0.2, z: 2.5 },
        lookAt: { x: 0, y: -0.35, z: 2.15 },
        annotations: [
            {
                label: "Carbon Splitter",
                desc: "Ultra-thin carbon composite generating up to 200kg of front downforce.",
                point: { x: 0, y: -0.35, z: 2.15 },
                offset: { x: -140, y: -50 }
            },
            {
                label: "Active Flaps",
                desc: "Micro-hydraulic flaps that adjust in milliseconds based on speed.",
                point: { x: 0.7, y: -0.3, z: 1.9 },
                offset: { x: 140, y: -20 }
            }
        ]
    },
    {
        name: "LED Matrix Headlights",
        shortDesc: "Signature double-element LED headlights integrated directly into the air intakes. By combining illumination and ventilation into a single unit, weight is minimized and cooling efficiency is maximized.",
        cameraPos: { x: 1.0, y: 0.3, z: 2.0 },
        lookAt: { x: 0.65, y: 0.1, z: 1.7 },
        annotations: [
            {
                label: "Laser-LED Array",
                desc: "Adaptive high-beam system with 48 individual matrix nodes.",
                point: { x: 0.65, y: 0.1, z: 1.7 },
                offset: { x: 150, y: -60 }
            },
            {
                label: "Intake Duct",
                desc: "Channels cooling air directly to the front brake assemblies.",
                point: { x: 0.72, y: -0.05, z: 1.6 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Carbon Monocage Chassis",
        shortDesc: "The passenger cell is a continuous Monocage molded from carbon fiber. Incredible torsional rigidity provides an ultra-safe cabin shell and serves as the structural mount for front and rear subframes.",
        cameraPos: { x: 1.1, y: 0.6, z: 0.6 },
        lookAt: { x: 0.5, y: 0.35, z: 0.2 },
        annotations: [
            {
                label: "Monocage Tub",
                desc: "Weighing only 75kg, it offers unparalleled driver safety.",
                point: { x: 0.5, y: 0.35, z: 0.2 },
                offset: { x: 150, y: -50 }
            },
            {
                label: "A-Pillar Ducting",
                desc: "Integrated rollover protection and internal air routing.",
                point: { x: 0.45, y: 0.65, z: 0.6 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Side Intake Vents",
        shortDesc: "The sculpted flanks direct high-velocity air into the high-temperature radiators. The complex door channels act as aerodynamic guides, keeping flow attached to the body contour.",
        cameraPos: { x: 1.4, y: 0.25, z: -0.4 },
        lookAt: { x: 0.75, y: 0.05, z: -0.6 },
        annotations: [
            {
                label: "High-Temp Radiator",
                desc: "Dual-core aluminum radiator for cooling the hybrid powertrain.",
                point: { x: 0.75, y: 0.05, z: -0.6 },
                offset: { x: 150, y: -50 }
            },
            {
                label: "Sculpted Tendon",
                desc: "Pushes air flow boundary layer inward to reduce drag.",
                point: { x: 0.85, y: 0.15, z: 0.1 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Butterfly Dihedral Doors",
        shortDesc: "Dihedral doors hinge forward and upward to facilitate easy cabin access even in tight spaces. The door design includes integrated air channels that feed cold air into the engine bay.",
        cameraPos: { x: 1.3, y: 0.75, z: 0.85 },
        lookAt: { x: 0.7, y: 0.35, z: 0.55 },
        annotations: [
            {
                label: "Dihedral Hinge",
                desc: "Forged aluminum hinge mounted to the carbon structural pillar.",
                point: { x: 0.55, y: 0.5, z: 0.85 },
                offset: { x: 150, y: -60 }
            },
            {
                label: "Air Sweep Door",
                desc: "Hollow door panels channel 30% more air than standard inlets.",
                point: { x: 0.88, y: 0.25, z: 0.3 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Carbon Ceramic Brakes",
        shortDesc: "Derived from Formula 1 technology, these carbon ceramic discs and bespoke monobloc calipers offer massive stopping power. They operate efficiently at temperatures exceeding 800°C.",
        cameraPos: { x: 1.3, y: -0.1, z: 1.45 },
        lookAt: { x: 0.92, y: -0.12, z: 1.25 },
        annotations: [
            {
                label: "Brembo Caliper",
                desc: "6-piston aluminum-lithium monobloc caliper.",
                point: { x: 0.92, y: -0.08, z: 1.28 },
                offset: { x: 150, y: -60 }
            },
            {
                label: "Carbon Disc",
                desc: "390mm cross-drilled carbon-ceramic rotor.",
                point: { x: 0.9, y: -0.2, z: 1.2 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Forged Alloy Wheels",
        shortDesc: "Ultra-light forged aluminum wheels wrapped in track-optimized Pirelli P Zero Corsa tires. Dynamic wheel spokes create a vacuum to pull hot air away from the brakes.",
        cameraPos: { x: 1.35, y: -0.12, z: -1.1 },
        lookAt: { x: 0.96, y: -0.15, z: -1.25 },
        annotations: [
            {
                label: "Forged Spoke",
                desc: "Saves 2.5kg of unsprung weight per wheel.",
                point: { x: 0.96, y: -0.15, z: -1.25 },
                offset: { x: 150, y: -50 }
            },
            {
                label: "Pirelli Corsa",
                desc: "Bespoke compound optimized for lateral grip.",
                point: { x: 0.98, y: 0.1, z: -1.2 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Twin-Turbo V8 Engine",
        shortDesc: "The heart of the beast: a mid-mounted 4.0-liter dry-sump twin-turbo V8, augmented by an electric motor. Together they deliver instantaneous throttle response and mind-bending acceleration.",
        cameraPos: { x: 0.6, y: 0.7, z: -0.7 },
        lookAt: { x: 0.0, y: 0.35, z: -0.65 },
        annotations: [
            {
                label: "Plenum Chamber",
                desc: "Carbon-fiber intake plenum delivering charge air at 1.8 bar.",
                point: { x: 0, y: 0.35, z: -0.65 },
                offset: { x: -150, y: -50 }
            },
            {
                label: "Electric Motor",
                desc: "Axial-flux motor delivering instant torque fill.",
                point: { x: 0, y: -0.05, z: -0.9 },
                offset: { x: 150, y: 40 }
            }
        ]
    },
    {
        name: "Active Rear Spoiler",
        shortDesc: "An active hydraulic rear spoiler that acts as both a stabilizer and an airbrake. It changes its pitch automatically depending on acceleration, braking, and cornering g-forces.",
        cameraPos: { x: 0.7, y: 0.8, z: -2.1 },
        lookAt: { x: 0.45, y: 0.52, z: -1.82 },
        annotations: [
            {
                label: "DRS Actuator",
                desc: "Hydraulic struts that flatten the wing for high-speed runs.",
                point: { x: 0.45, y: 0.52, z: -1.82 },
                offset: { x: 150, y: -45 }
            },
            {
                label: "Gurney Flap",
                desc: "Carbon trailing edge optimizing boundary layer attachment.",
                point: { x: 0, y: 0.62, z: -1.95 },
                offset: { x: -150, y: -45 }
            }
        ]
    },
    {
        name: "Titanium Exhaust Outlets",
        shortDesc: "Top-exit high-mounted dual exhaust pipes crafted from titanium. High exhaust gas exits close to the spoiler to assist downforce generation via blown-wing aerodynamics.",
        cameraPos: { x: 0, y: 0.6, z: -2.0 },
        lookAt: { x: 0, y: 0.42, z: -1.72 },
        annotations: [
            {
                label: "Titanium Tips",
                desc: "Heat-resistant lightweight titanium pipes.",
                point: { x: 0, y: 0.42, z: -1.72 },
                offset: { x: 140, y: -50 }
            }
        ]
    },
    {
        name: "Carbon Rear Diffuser",
        shortDesc: "An aggressive underbody carbon fiber diffuser. It accelerates low-pressure air beneath the car to create a strong suction effect, clamping the rear tyres to the tarmac.",
        cameraPos: { x: 1.2, y: 0.3, z: -3.3 },
        lookAt: { x: 0.3, y: -0.38, z: -1.9 },
        annotations: [
            {
                label: "Diffuser Vanes",
                desc: "Vertical fins that stabilize turbulent air behind the tyres.",
                point: { x: 0.3, y: -0.4, z: -1.9 },
                offset: { x: 150, y: -40 }
            },
            {
                label: "Venturi Tunnel Exit",
                desc: "Expands flat-floor air to create massive downforce.",
                point: { x: -0.3, y: -0.42, z: -1.85 },
                offset: { x: -150, y: -30 }
            }
        ]
    },
    {
        name: "F1 Cockpit & Interface",
        shortDesc: "A minimalist cabin designed purely around driver focus. A formula-style flat-bottom steering wheel contains only vital controls, surrounded by rich Alcantara and exposed carbon.",
        cameraPos: { x: -1.3, y: 0.7, z: 0.4 },
        lookAt: { x: -0.25, y: 0.25, z: 0.15 },
        annotations: [
            {
                label: "F1 Steering Wheel",
                desc: "Carbon rim with integrated shift lights and drive selector.",
                point: { x: -0.25, y: 0.22, z: 0.18 },
                offset: { x: -150, y: -50 }
            },
            {
                label: "Active HUD Display",
                desc: "Folding digital instrument cluster showing race telemetrics.",
                point: { x: -0.24, y: 0.32, z: 0.08 },
                offset: { x: 150, y: -40 }
            }
        ]
    }
];

// --- Scene Initialization ---
function init() {
    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.12);

    // 2. Camera setup
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    const initialPart = carParts[0];
    camera.position.set(initialPart.cameraPos.x, initialPart.cameraPos.y, initialPart.cameraPos.z);

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.4;

    // Create a beautiful reflection PMREM environment map dynamically
    const environment = new RoomEnvironment(renderer);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(environment).texture;

    // 4. Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
    controls.minDistance = 2.6; // Prevent camera from going inside the car body
    controls.maxDistance = 10.0;
    controls.target.set(initialPart.lookAt.x, initialPart.lookAt.y, initialPart.lookAt.z);

    // 5. Lights setup (Studio Lighting)
    setupLights();

    // 6. Floor setup
    setupFloor();

    // 7. Load Car Model
    loadCarModel();

    // 8. Setup UI Events & Render List
    buildSidePanelList();
    setupUIEvents();

    // 9. Start loop
    animate();
}

function setupLights() {
    // Ambient Light (Turned off for pure darkness)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.0);
    scene.add(ambientLight);

    // Main Overhead Soft SpotLight (Near-zero overhead glow with faint purple tint)
    const topLight = new THREE.SpotLight(0x8b00be, 0.08);
    topLight.position.set(0, 5, 0);
    topLight.angle = Math.PI / 2.5;
    topLight.penumbra = 0.9;
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    topLight.shadow.camera.near = 1;
    topLight.shadow.camera.far = 10;
    topLight.shadow.bias = -0.001;
    scene.add(topLight);

    // Front/Key Light (Turned off)
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.0);
    keyLight.position.set(2, 2.5, 4);
    scene.add(keyLight);

    // Subtle Neon Purple Rim Light (Matching car's lighting element highlights)
    const rimLightLeft = new THREE.DirectionalLight(0x8b00be, 0.08);
    rimLightLeft.position.set(-4, 1.5, -3);
    scene.add(rimLightLeft);

    // Cool Purple Rim Light (Contrasting ambient reflections)
    const rimLightRight = new THREE.DirectionalLight(0x8b00be, 0.06);
    rimLightRight.position.set(4, 1.5, -3);
    scene.add(rimLightRight);
}

// High-Resolution Seeded Procedural Grungy Concrete Floor Generator
function createCharcoalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Simple deterministic PRNG for consistent results across reloads
    let seed = 45678;
    function seededRandom() {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    // 1. Base Charcoal Grey
    ctx.fillStyle = '#181818';
    ctx.fillRect(0, 0, 2048, 2048);

    // 2. Concrete Stain Blotches (Creates organic color variations so it's not plain)
    for (let i = 0; i < 160; i++) {
        const x = seededRandom() * canvas.width;
        const y = seededRandom() * canvas.height;
        const radius = 100 + seededRandom() * 450;
        const opacity = 0.04 + seededRandom() * 0.14;
        const val = seededRandom() > 0.5 ? 26 : 12; // Lighter or darker spots
        
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${val},${val},${val},${opacity})`);
        grad.addColorStop(1, 'rgba(24,24,24,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. High-Frequency Micro Stone/Gravel Grain Noise
    const imgData = ctx.getImageData(0, 0, 2048, 2048);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (seededRandom() - 0.5) * 16; // Grain variation
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    return new THREE.CanvasTexture(canvas);
}

function setupFloor() {
    const charcoalTex = createCharcoalTexture();
    // Do NOT repeat the texture to avoid tiling seams
    charcoalTex.wrapS = THREE.ClampToEdgeWrapping;
    charcoalTex.wrapT = THREE.ClampToEdgeWrapping;

    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
        map: charcoalTex,
        bumpMap: charcoalTex,
        bumpScale: 0.15, // High bump scale for concrete roughness
        roughness: 0.98,
        metalness: 0.05
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.45;
    floor.receiveShadow = true;
    scene.add(floor);
}

function loadCarModel() {
    const loader = new GLTFLoader();

    loader.load(
        '/3dModel/scene.gltf',
        (gltf) => {
            carModel = gltf.scene;

            // Calculate bounding box of the loaded raw model
            const box = new THREE.Box3().setFromObject(carModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Scale the model group
            const scaleFactor = 4.3 / Math.max(size.x, size.y, size.z);
            carModel.scale.setScalar(scaleFactor);

            // Position the model group so its center is at (0, 0, 0) in world space
            carModel.position.copy(center).multiplyScalar(-scaleFactor);

            // Adjust Y position so wheels stand on ground (y = -0.45)
            const newBox = new THREE.Box3().setFromObject(carModel);
            const bottomY = newBox.min.y;
            carModel.position.y += (-0.45 - bottomY);

            // Traverse and enable shadows, modify textures for premium look
            carModel.traverse((node) => {
                const name = node.name.toLowerCase();

                // Cache door nodes for interactive animations (supports English 'door' and French 'porte')
                if ((name.includes('door') || name.includes('porte')) && !name.includes('trim') && !name.includes('handle') && !name.includes('lock')) {
                    let hasParentDoor = false;
                    let parent = node.parent;
                    while (parent) {
                        if (parent.name.toLowerCase().includes('door') || parent.name.toLowerCase().includes('porte')) {
                            hasParentDoor = true;
                            break;
                        }
                        parent = parent.parent;
                    }
                    if (!hasParentDoor) {
                        doorNodes.push({
                            node: node,
                            origPos: node.position.clone(),
                            origRot: node.rotation.clone()
                        });
                    }
                }

                // Cache spoiler/rear wing nodes for DRS (supports English 'spoiler/wing' and French 'aileron')
                if (name.includes('spoiler') || name.includes('rear_wing') || name.includes('aileron') || (name.includes('wing') && !name.includes('mirror') && !name.includes('fender'))) {
                    let hasParentSpoiler = false;
                    let parent = node.parent;
                    while (parent) {
                        if (parent.name.toLowerCase().includes('spoiler') || parent.name.toLowerCase().includes('wing') || parent.name.toLowerCase().includes('aileron')) {
                            hasParentSpoiler = true;
                            break;
                        }
                        parent = parent.parent;
                    }
                    if (!hasParentSpoiler) {
                        spoilerNodes.push({
                            node: node,
                            origPos: node.position.clone(),
                            origRot: node.rotation.clone()
                        });
                    }
                }

                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    
                    // Fine tune material settings to make it extremely premium
                    if (node.material) {
                        node.material.envMapIntensity = 1.5;
                        const matName = node.material.name.toLowerCase();
                        if (matName.includes('glass') || matName.includes('vitre') || node.material.transparent) {
                            node.material.roughness = 0.05;
                            node.material.metalness = 0.9;
                            node.material.transmission = 0.9; // For transparent glass feel
                            node.material.ior = 1.5;
                        }
                    }
                }
            });

            scene.add(carModel);
            console.log("Showroom Diagnostics:");
            console.log(" - Doors cached:", doorNodes.length, doorNodes.map(d => d.node.name));
            console.log(" - Spoilers cached:", spoilerNodes.length, spoilerNodes.map(s => s.node.name));

            // Animate Loader Fadeout
            gsap.to(loaderEl, {
                opacity: 0,
                duration: 0.8,
                onComplete: () => {
                    loaderEl.classList.add('fade-out');
                    // Focus on overview (index 0) immediately
                    setPartActive(0);
                }
            });
        },
        (xhr) => {
            if (xhr.total) {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                loaderBarEl.style.width = percent + '%';
                loaderTextEl.textContent = percent + '%';
            }
        },
        (error) => {
            console.error('An error happened loading the GLTF model:', error);
            loaderTextEl.textContent = "Error Loading Asset";
        }
    );
}

// --- UI Interaction Logic ---

function buildSidePanelList() {
    partsListEl.innerHTML = '';
    carParts.forEach((part, index) => {
        const li = document.createElement('li');
        li.className = `part-item ${index === 0 ? 'active' : ''}`;
        li.dataset.index = index;
        
        // Add component details
        const formattedIndex = index.toString().padStart(2, '0');
        li.innerHTML = `
            <span class="part-item-name">${part.name}</span>
            <span class="part-item-number">${formattedIndex}</span>
        `;
        
        li.addEventListener('click', () => {
            if (isAnimating) return;
            setPartActive(index);
        });
        
        partsListEl.appendChild(li);
    });

    updateNavIndicator();
}

function updateNavIndicator() {
    navIndicatorEl.textContent = `${activeIndex + 1} / ${carParts.length}`;
}

function setPartActive(index) {
    if (index < 0 || index >= carParts.length || index === activeIndex) return;

    isAnimating = true;
    activeIndex = index;

    // Rev engine on transition
    revEngine();

    // Update list selection UI
    document.querySelectorAll('.part-item').forEach((item, idx) => {
        if (idx === index) {
            item.classList.add('active');
            // Only scroll the element into view if the side panel is open,
            // to prevent the browser from scrolling the body horizontally and breaking the layout.
            if (!sidePanelEl.classList.contains('collapsed')) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } else {
            item.classList.remove('active');
        }
    });

    updateNavIndicator();

    // Adjust OrbitControls zoom limits dynamically
    // In overview mode, prevent going inside the car (minDistance = 2.4).
    // In component mode, allow zooming extremely close to inspect detailed textures (minDistance = 0.25).
    if (index === 0) {
        controls.minDistance = 2.4;
    } else {
        controls.minDistance = 0.25;
    }

    // Fade out HUD content
    hudTopEl.classList.add('hidden');
    clearAnnotations();

    const part = carParts[index];

    // GSAP Animate Camera & Target (OrbitControls target)
    gsap.to(camera.position, {
        x: part.cameraPos.x,
        y: part.cameraPos.y,
        z: part.cameraPos.z,
        duration: 2.0,
        ease: 'power3.inOut'
    });

    gsap.to(controls.target, {
        x: part.lookAt.x,
        y: part.lookAt.y,
        z: part.lookAt.z,
        duration: 2.0,
        ease: 'power3.inOut',
        onComplete: () => {
            isAnimating = false;
            
            // Set HUD text
            partTitleEl.textContent = part.name;
            partDescEl.textContent = part.shortDesc;
            hudTopEl.classList.remove('hidden');

            // Render Annotations
            renderAnnotations(part.annotations);
        }
    });
}

// --- Annotations & SVG Connection Lines ---
let currentAnnotations = [];

function clearAnnotations() {
    annotationsContainerEl.innerHTML = '';
    svgOverlayEl.innerHTML = '';
    currentAnnotations = [];
}

function renderAnnotations(annotations) {
    clearAnnotations();
    if (!annotations || annotations.length === 0) return;

    annotations.forEach((annot, index) => {
        // Create 3D anchor point dot
        const pointEl = document.createElement('div');
        pointEl.className = 'annotation-point';
        pointEl.innerHTML = '<div class="annotation-dot"></div>';
        annotationsContainerEl.appendChild(pointEl);

        // Create Card
        const cardEl = document.createElement('div');
        cardEl.className = 'annotation-card';
        cardEl.innerHTML = `
            <div class="annotation-title">${annot.label}</div>
            <div class="annotation-body">${annot.desc}</div>
        `;
        annotationsContainerEl.appendChild(cardEl);

        // Store reference with positioning elements
        currentAnnotations.push({
            data: annot,
            pointEl: pointEl,
            cardEl: cardEl,
            vector: new THREE.Vector3(annot.point.x, annot.point.y, annot.point.z)
        });

        // Trigger reveal fade-in with staggered delay
        setTimeout(() => {
            cardEl.classList.add('visible');
        }, index * 200 + 100);
    });
}

function updateAnnotationsPositions() {
    if (currentAnnotations.length === 0) return;

    // Clear SVG overlay paths each frame
    svgOverlayEl.innerHTML = '';

    currentAnnotations.forEach((annot) => {
        // Project 3D vector to screen coords
        const proj = annot.vector.clone().project(camera);

        // Check if the point is behind the camera
        const dir = annot.vector.clone().sub(camera.position);
        const dot = dir.dot(camera.getWorldDirection(new THREE.Vector3()));
        if (dot < 0) {
            annot.pointEl.style.display = 'none';
            annot.cardEl.style.display = 'none';
            return;
        }

        annot.pointEl.style.display = 'block';
        annot.cardEl.style.display = 'block';

        // Convert projection coordinates to pixel positions
        const px = (proj.x * 0.5 + 0.5) * window.innerWidth;
        const py = (-(proj.y) * 0.5 + 0.5) * window.innerHeight;

        // Position 3D point dot
        annot.pointEl.style.left = `${px}px`;
        annot.pointEl.style.top = `${py}px`;

        // Position Card with configured offset
        const cardX = px + annot.data.offset.x;
        const cardY = py + annot.data.offset.y;
        annot.cardEl.style.left = `${cardX}px`;
        annot.cardEl.style.top = `${cardY}px`;

        // Draw Line connecting point dot to Card anchor point
        // Card anchor point is the left side (or right side depending on offset x sign)
        const isLeftOffset = annot.data.offset.x < 0;
        const lineEndX = cardX + (isLeftOffset ? annot.cardEl.offsetWidth : 0);
        const lineEndY = cardY;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', px);
        line.setAttribute('y1', py);
        line.setAttribute('x2', lineEndX);
        line.setAttribute('y2', lineEndY);
        line.setAttribute('stroke', '#8B00BE');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.6');
        svgOverlayEl.appendChild(line);
    });
}

// --- Event Listeners & Controls ---
function setupUIEvents() {
    // Chevron Click Handlers
    prevBtn.addEventListener('click', () => {
        if (isAnimating) return;
        let prevIdx = activeIndex - 1;
        if (prevIdx < 0) prevIdx = carParts.length - 1;
        setPartActive(prevIdx);
    });

    nextBtn.addEventListener('click', () => {
        if (isAnimating) return;
        let nextIdx = activeIndex + 1;
        if (nextIdx >= carParts.length) nextIdx = 0;
        setPartActive(nextIdx);
    });

    // Panel Toggle Collapsing/Expanding
    panelToggleEl.addEventListener('click', () => {
        sidePanelEl.classList.toggle('collapsed');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (isAnimating) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextBtn.click();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            prevBtn.click();
        }
    });

    // Window Resize Handler
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Interactive Showroom Functions ---

// 1. Car Paint Customizer
function changeCarColor(hexColor) {
    if (!carModel) return;
    const color = new THREE.Color(hexColor);
    carModel.traverse((node) => {
        if (node.isMesh && node.material) {
            const name = node.name.toLowerCase();
            const matName = node.material.name.toLowerCase();
            
            // Check if mesh represents exterior car body paint (supports English, French, and model-specific material.005)
            if (
                matName.includes('paint') || 
                matName.includes('body') || 
                matName.includes('exterior') || 
                matName.includes('shell') ||
                matName.includes('carrosserie') ||
                matName.includes('carosserie') ||
                matName.includes('peinture') ||
                matName.includes('material.005') ||
                name.includes('body') ||
                name.includes('car_paint')
            ) {
                // Ignore carbon fiber trims, interior details, headlights, wheels or tyres
                if (
                    !matName.includes('carbon') && 
                    !matName.includes('glass') && 
                    !matName.includes('interior') && 
                    !matName.includes('wheel') &&
                    !matName.includes('tire') &&
                    !name.includes('glass') &&
                    !name.includes('wheel')
                ) {
                    node.material.color.copy(color);
                    node.material.roughness = 0.15;
                    node.material.metalness = 0.85;
                }
            }
        }
    });
}

// 2. Butterfly Doors Toggle
function toggleDoors() {
    if (!carModel || doorNodes.length === 0) return;
    doorsOpen = !doorsOpen;
    const btn = document.getElementById('btn-toggle-doors');
    btn.querySelector('.btn-text').textContent = doorsOpen ? 'CLOSE DIHEDRAL DOORS' : 'OPEN DIHEDRAL DOORS';
    btn.classList.toggle('active', doorsOpen);

    doorNodes.forEach(({ node, origPos, origRot }) => {
        const isLeft = node.name.toLowerCase().includes('left') || node.name.toLowerCase().includes('_l') || node.position.x < 0;
        
        // Target translations and rotations for dihedral scissor-butterfly wings
        const targetRotX = doorsOpen ? origRot.x + (isLeft ? -0.45 : 0.45) : origRot.x;
        const targetRotY = doorsOpen ? origRot.y + (isLeft ? 0.6 : -0.6) : origRot.y;
        const targetRotZ = doorsOpen ? origRot.z + (isLeft ? 0.75 : -0.75) : origRot.z;
        
        const targetPosY = doorsOpen ? origPos.y + 0.15 : origPos.y;
        const targetPosX = doorsOpen ? origPos.x + (isLeft ? -0.05 : 0.05) : origPos.x;

        gsap.to(node.rotation, {
            x: targetRotX,
            y: targetRotY,
            z: targetRotZ,
            duration: 1.8,
            ease: 'power3.inOut'
        });

        gsap.to(node.position, {
            x: targetPosX,
            y: targetPosY,
            duration: 1.8,
            ease: 'power3.inOut'
        });
    });
}

// 3. Active Rear Spoiler / DRS Toggle
function toggleDRS() {
    if (!carModel || spoilerNodes.length === 0) return;
    drsActive = !drsActive;
    const btn = document.getElementById('btn-toggle-drs');
    btn.querySelector('.btn-text').textContent = drsActive ? 'DEACTIVATE DRS SPOILER' : 'ACTIVATE DRS SPOILER';
    btn.classList.toggle('active', drsActive);

    spoilerNodes.forEach(({ node, origPos, origRot }) => {
        // Move spoiler up and angle it flat for DRS aerofoil position
        const targetPosY = drsActive ? origPos.y + 0.15 : origPos.y;
        const targetPosZ = drsActive ? origPos.z - 0.06 : origPos.z;
        const targetRotX = drsActive ? origRot.x - 0.2 : origRot.x;

        gsap.to(node.position, {
            y: targetPosY,
            z: targetPosZ,
            duration: 1.2,
            ease: 'power2.inOut'
        });

        gsap.to(node.rotation, {
            x: targetRotX,
            duration: 1.2,
            ease: 'power2.inOut'
        });
    });
}

// 4. Cinematic Auto Tour
function toggleCinematicTour() {
    const btn = document.getElementById('btn-toggle-tour');
    if (!isTourRunning) {
        isTourRunning = true;
        btn.classList.add('active');
        btn.querySelector('.btn-text').textContent = 'STOP CINEMATIC TOUR';
        
        cycleTour();
        tourInterval = setInterval(cycleTour, 6500);
    } else {
        isTourRunning = false;
        btn.classList.remove('active');
        btn.querySelector('.btn-text').textContent = 'START CINEMATIC TOUR';
        clearInterval(tourInterval);
        tourInterval = null;
    }
}

function cycleTour() {
    let nextIdx = activeIndex + 1;
    if (nextIdx >= carParts.length) nextIdx = 0;
    setPartActive(nextIdx);
}

// 5. Procedural V8 Synthesizer Growl (Web Audio API)
function toggleEngineSound() {
    const btn = document.getElementById('btn-engine-sound');
    if (!engineRunning) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // Subtly synthesize double-combustion V8 growl
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';

        // Base V8 idle frequencies
        osc1.frequency.setValueAtTime(55, audioCtx.currentTime); // ~800 RPM base firing
        osc2.frequency.setValueAtTime(27.5, audioCtx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, audioCtx.currentTime);
        filter.Q.setValueAtTime(3.0, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.0, audioCtx.currentTime);

        // V8 Startup Ignition Sweep
        gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.1);
        osc1.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.4);
        osc2.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.4);
        filter.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.4);

        // Settle down to idle growl
        osc1.frequency.exponentialRampToValueAtTime(58, audioCtx.currentTime + 1.5);
        osc2.frequency.exponentialRampToValueAtTime(29, audioCtx.currentTime + 1.5);
        filter.frequency.exponentialRampToValueAtTime(130, audioCtx.currentTime + 1.5);
        gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 1.5);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start();
        osc2.start();

        engineNode = { osc1, osc2, gain, filter };
        engineRunning = true;
        btn.classList.add('running');
        btn.querySelector('.btn-text').textContent = 'STOP V8 ENGINE';
    } else {
        // Shutdown engine sound
        if (engineNode) {
            const now = audioCtx.currentTime;
            engineNode.gain.gain.linearRampToValueAtTime(0.0, now + 0.6);
            engineNode.osc1.frequency.exponentialRampToValueAtTime(10, now + 0.6);
            engineNode.osc2.frequency.exponentialRampToValueAtTime(5, now + 0.6);
            
            const shuttingOsc1 = engineNode.osc1;
            const shuttingOsc2 = engineNode.osc2;
            setTimeout(() => {
                shuttingOsc1.stop();
                shuttingOsc2.stop();
            }, 700);
            engineNode = null;
        }
        engineRunning = false;
        btn.classList.remove('running');
        btn.querySelector('.btn-text').textContent = 'START V8 ENGINE';
    }
}

function revEngine() {
    if (!engineRunning || !audioCtx || !engineNode) return;
    const now = audioCtx.currentTime;
    
    // Simulate throttle press (pitch up during camera sweep)
    engineNode.osc1.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    engineNode.osc2.frequency.exponentialRampToValueAtTime(55, now + 0.2);
    engineNode.filter.frequency.exponentialRampToValueAtTime(280, now + 0.2);
    engineNode.gain.gain.linearRampToValueAtTime(0.22, now + 0.2);

    // Settle back to V8 idle rumble
    engineNode.osc1.frequency.exponentialRampToValueAtTime(58, now + 1.3);
    engineNode.osc2.frequency.exponentialRampToValueAtTime(29, now + 1.3);
    engineNode.filter.frequency.exponentialRampToValueAtTime(130, now + 1.3);
    engineNode.gain.gain.linearRampToValueAtTime(0.12, now + 1.3);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Update orbit controls
    controls.update();

    // Sync HTML/SVG annotation points with 3D model transforms
    updateAnnotationsPositions();

    // Render WebGL frame
    renderer.render(scene, camera);
}

// --- Launch Showcase ---
window.addEventListener('DOMContentLoaded', init);
