import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';

let scene, camera, renderer, controls;
let mesh = null;
let timerEl = null;
let gestureHintEl = null;
let fingerIconEl = null;
// Animation data: { T, V, data: Float32Array }
let anim = null;
let frameFloat = 0;
let lastShape = null;
let savedCameraPos = null;
let savedTarget = null;
let savedRotation = null;
// Gesture hint & auto-animation
let lastUserInteractionTime = Date.now(); // Initialize to now so it waits initially
let showingGestureHint = false;
let baseRotation = { x: 0, y: 0, z: 0 }; // Store base rotation separately
let animationStartTime = 0; // Track when current animation cycle started
const GESTURE_HINT_DELAY = 4000; // ms before showing hint
const GESTURE_HINT_TIMEOUT = 8000; // ms to show hint
const AUTO_ANIMATION_DURATION = 1500; // ms total animation time before stopping



// default paths (can be overridden by data-* on the canvas)
let MESH_URL = "assets/data/octopus_ours_poisson.glb";
let COLORS_META_URL = null;
let COLORS_BIN_URL = null;

const ROTATION_PRESETS = {
    default: { x: -Math.PI / 2 + 0.3, y: 0, z: 0.3 },
    apple: { x: -Math.PI / 2 + 0.3, y: 0.1, z: Math.PI / 2 },
    jared: { x: -Math.PI / 2, y: 0, z: Math.PI / 2 },
    octopus: { x: -Math.PI / 2 + 0.3, y: 0, z: 0.3 },
    sofa: { x: -Math.PI / 2, y: 0, z: 0.8 },
    holey: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: Math.PI / 2, z: 0 },
    max_boundary_0: { x: 0, y: Math.PI / 2, z: 0 },
    max_boundary_sin: { x: 0, y: Math.PI / 2, z: 0 },
    GS: { x: Math.PI / 2, y: Math.PI , z: Math.PI / 2 },
    armadillo: { x: -Math.PI / 2, y: 0, z: Math.PI },
    helmet: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: -2.4, z: 0 },
    // Add others here…
};


document.addEventListener("DOMContentLoaded", () => {
    console.log("[PDE VIEWER] DOMContentLoaded");
    init();
    // Don't load default scene - wait for script.js to call setModel()
    loadScene();
});

// ---------------------------------------------
// Init
// ---------------------------------------------
function init() {
    const canvas = document.getElementById("pdeCanvas");
    timerEl = document.getElementById("pdeTimer");
    gestureHintEl = document.getElementById("pdeGestureHint");
    fingerIconEl = gestureHintEl?.querySelector(".pde-finger-icon");
    console.log("[PDE VIEWER] gestureHintEl:", gestureHintEl);
    console.log("[PDE VIEWER] fingerIconEl:", fingerIconEl);
    if (!canvas) {
        console.warn("[PDE VIEWER] No #pdeCanvas found; viewer disabled.");
        return;
    }
    // --- read custom paths from data-* attributes ---
    if (canvas.dataset.mesh) {
        MESH_URL = canvas.dataset.mesh;
    }
    if (canvas.dataset.colorsMeta) {
        COLORS_META_URL = canvas.dataset.colorsMeta;
    }
    if (canvas.dataset.colorsBin) {
        COLORS_BIN_URL = canvas.dataset.colorsBin;
    }
    console.log("[PDE VIEWER] Using paths:", {
        MESH_URL,
        COLORS_META_URL,
        COLORS_BIN_URL,
    });
    console.log("[PDE VIEWER] init()");

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    resizeRenderer();
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f6fa); // light grey


    camera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / (canvas.clientHeight || 400),
        0.01,
        100
    );
    camera.position.set(0, 0, 3);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x555555, 1.2);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(3, 5, 2);
    scene.add(dirLight);

    controls = new OrbitControls(camera, renderer.domElement);

    // Track user interaction to show/hide gesture hint
    renderer.domElement.addEventListener("pointerdown", recordUserInteraction);
    renderer.domElement.addEventListener("wheel", recordUserInteraction);
    renderer.domElement.addEventListener("touchstart", recordUserInteraction);

    window.addEventListener("resize", resizeRenderer);
    animate();
}

function recordUserInteraction() {
    lastUserInteractionTime = Date.now();
    animationStartTime = 0; // Reset animation cycle
    if (showingGestureHint) {
        hideGestureHint();
    }
}

function showGestureHint() {
    if (gestureHintEl && !showingGestureHint) {
        console.log("[PDE VIEWER] Showing gesture hint");
        gestureHintEl.style.display = "block";
        showingGestureHint = true;
    }
}

function hideGestureHint() {
    if (gestureHintEl && showingGestureHint) {
        console.log("[PDE VIEWER] Hiding gesture hint");
        gestureHintEl.style.display = "none";
        showingGestureHint = false;
    }
}

function updateGestureHint() {
    const timeSinceInteraction = Date.now() - lastUserInteractionTime;

    // Show/hide hint based on animation cycle
    if (timeSinceInteraction > GESTURE_HINT_DELAY && animationStartTime > 0) {
        const elapsedInCycle = (Date.now() - animationStartTime) % (AUTO_ANIMATION_DURATION + GESTURE_HINT_DELAY);
        
        // Show during animation, hide when animation stops
        if (elapsedInCycle < AUTO_ANIMATION_DURATION && !showingGestureHint) {
            showGestureHint();
        } else if (elapsedInCycle >= AUTO_ANIMATION_DURATION && showingGestureHint) {
            hideGestureHint();
        }
    } else if (showingGestureHint && timeSinceInteraction <= GESTURE_HINT_DELAY) {
        // Hide if user interacted
        hideGestureHint();
    }
}

function resizeRenderer() {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
    const height = canvas.clientHeight || 400;
    // only update if something actually changed
    const needResize =
        canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}

// ---------------------------------------------
// Center camera on a given object
// ---------------------------------------------
function frameObject(obj, presetName = null) {
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8; // distance from center

    camera.position.copy(center.clone().add(new THREE.Vector3(0, 0, dist)));
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
}

function handleGltfLoaded(gltf) {
    console.log("[PDE VIEWER] GLB loaded.");

    gltf.scene.traverse(obj => {
        if (obj.isMesh && !mesh) {
            console.log("Loaded mesh mesh")
            mesh = obj;
        }
        if (obj.isPoints && !mesh) {
            console.log("Loaded point mesh")
            mesh = obj;
        }
    });

    gltf.scene.traverse(obj => {
        if (obj.isMesh && !mesh) {
            // detect degenerate triangle mesh = POINT CLOUD
            const pos = obj.geometry.attributes.position;
            const index = obj.geometry.index;

            let allDegenerate = true;
            if (index) {
                for (let i = 0; i < index.count; i += 3) {
                    const a = index.getX(i);
                    const b = index.getX(i + 1);
                    const c = index.getX(i + 2);
                    if (!(a === b && b === c)) {
                        allDegenerate = false;
                        break;
                    }
                }
            }

            if (allDegenerate) {
                console.log("Detected degenerate mesh → Converting to Points");

                const geom = obj.geometry;
                const mat = new THREE.PointsMaterial({
                    size: 0.01,
                    vertexColors: true
                });

                mesh = new THREE.Points(geom, mat);
            } else {
                console.log("Loaded normal mesh");
                mesh = obj;
            }
        }
    });

    if (!mesh) {
        console.error("[PDE VIEWER] No mesh found in GLB.");
        createFallbackMesh();
        return;
    }
    mesh.geometry.computeVertexNormals();

    // Force a visible test material first (no vertex colors)
    // mesh.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.0,
        side: THREE.DoubleSide,
    });

    // If we have a previous animation time, try to apply it immediately if possible
    // But we don't have the color data yet. So we might see the base mesh color for a split second.
    // To avoid flashing, we could make the material invisible until data is loaded?
    // Or just accept it. The issue is likely that we applyFrame(0) in loadColorData.

    scene.add(mesh);
    if (savedCameraPos && savedTarget) {
        camera.position.copy(savedCameraPos);
        controls.target.copy(savedTarget);
        controls.update();
    } else {
        frameObject(mesh);   // first-load use default framing
        // console.log("[PDE VIEWER] rotation preset:", lastShape);
        // if (ROTATION_PRESETS[lastShape]) {
        //     const r = ROTATION_PRESETS[lastShape];
        //     mesh.rotation.set(r.x, r.y, r.z);
        //     console.log("[PDE VIEWER] Applied rotation preset:", lastShape, r);
        // } else {
        //     const r = ROTATION_PRESETS['default'];
        //     mesh.rotation.set(r.x, r.y, r.z);
        //     console.log("[PDE VIEWER] Applied rotation preset:", 'default', r);
        // }
    }

    if (savedRotation) {
        console.log("[PDE VIEWER] Restoring mesh rotation:", savedRotation);
        mesh.rotation.copy(savedRotation);
    } else {
        const preset = ROTATION_PRESETS[lastShape] || ROTATION_PRESETS.default;
        console.log("[PDE VIEWER] Applying preset rotation:", preset);
        mesh.rotation.set(preset.x, preset.y, preset.z);
    }
    
    // Store the base rotation for auto-animation
    baseRotation = {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z
    };
    console.log("[PDE VIEWER] Stored base rotation:", baseRotation);
    console.log("[PDE VIEWER] Mesh added to scene. Vertex count:",
        mesh.geometry.attributes.position.count);

    // Try to load binary colors; if that fails, we still see the mesh
    loadColorData();
}


// ---------------------------------------------
// Load GLB mesh (or fallback cube)
// ---------------------------------------------
function loadScene() {
    console.log("[PDE VIEWER] loadScene()");

    const loader = new GLTFLoader();
    if (!MESH_URL) {
        console.error("[PDE VIEWER] MESH_URL is empty!");
        return;
    }

    loader.load(
        MESH_URL,
        (gltf) => {
            console.log("[PDE VIEWER] Loaded GLB from URL");
            handleGltfLoaded(gltf);
        },
        undefined,
        (err) => {
            console.error("[PDE VIEWER] GLTF parse error:", err)
            createFallbackMesh();
        }
    );

}

// Fallback: a simple cube so we know the viewer itself works
function createFallbackMesh() {
    if (mesh) return;

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    frameObject(mesh);
    console.log("[PDE VIEWER] Fallback cube created.");
}

// ---------------------------------------------
// Load binary animation data (optional)
// ---------------------------------------------
async function loadColorData() {
    if (!mesh) {
        console.warn("[PDE VIEWER] Mesh not ready, cannot load colors yet.");
        return;
    }

    if (!COLORS_META_URL || !COLORS_BIN_URL) {
        console.log("[PDE VIEWER] No color data URLs provided; skipping animation.");
        return;
    }

    try {
        console.log("[PDE VIEWER] Loading metadata JSON...");
        const metaResp = await fetch(COLORS_META_URL);
        if (!metaResp.ok) {
            console.warn("[PDE VIEWER] No metadata JSON found; skipping animation.");
            return;
        }

        const meta = await metaResp.json();
        const dtype = meta.dtype || "f32";

        console.log("[PDE VIEWER] Loading binary colors...");
        const binResp = await fetch(COLORS_BIN_URL);

        if (!binResp.ok) {
            console.warn("[PDE VIEWER] No binary colors found; skipping animation.");
            return;
        }

        const buffer = await binResp.arrayBuffer();
        let data;
        if (dtype === "u8") {
            console.log("[PDE VIEWER] Detected uint8 color...");
            data = new Uint8Array(buffer);
        } else { // "f32"
            console.log("[PDE VIEWER] Detected f32 color...");
            data = new Float32Array(buffer);
        }
        const geom = mesh.geometry;
        const V_geom = geom.attributes.position.count;

        const totalElems = data.length;
        const elemsPerFrame = V_geom * 3;
        const T_inferred = Math.floor(totalElems / elemsPerFrame);

        if (T_inferred <= 0) {
            console.error("[PDE VIEWER] Binary color data too short or invalid.", {
                totalElems,
                V_geom,
                elemsPerFrame: elemsPerFrame,
            });
            return;
        }

        if (totalElems % elemsPerFrame !== 0) {
            console.warn(
                "[PDE VIEWER] Binary data length not multiple of V*3. Truncating.",
                { totalElems, elemsPerFrame: elemsPerFrame }
            );
        }

        anim = {
            T: T_inferred,
            V: V_geom,
            data,
            dtype
        };

        console.log("[PDE VIEWER] Color animation loaded:", {
            frames: anim.T,
            vertices: anim.V,
            totalElems: data.length,
        });
        console.log("[PDE VIEWER] Size check:", {
            dtype,
            totalElems,
            V_geom,
            elemsPerFrame,
            inferredFrames: T_inferred
        });

        // Switch material to vertex-color aware material
        mesh.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.55,
            metalness: 0.0,
            side: THREE.DoubleSide,
        });

        // Create/reuse color attribute
        let colorAttr = geom.getAttribute("color");
        const expectedLen = V_geom * 3;
        if (!colorAttr || !colorAttr.array || colorAttr.array.length !== expectedLen) {
            colorAttr = new THREE.BufferAttribute(new Float32Array(expectedLen), 3);
            geom.setAttribute("color", colorAttr);
        }

        // Apply the CURRENT frame immediately, not 0
        const k = Math.floor(frameFloat);
        applyFrame(k);
    } catch (err) {
        console.error("[PDE VIEWER] Error loading binary colors:", err);
    }
}

// ---------------------------------------------
// Apply a frame (if animation available)
// ---------------------------------------------
function applyFrame(k) {
    if (!anim || !mesh) return;

    const { T, V, data, dtype } = anim;
    if (!T || !V || !data || !data.length) {
        console.warn("[PDE VIEWER] Animation data incomplete.", { T, V, hasData: !!data });
        return;
    }

    const geom = mesh.geometry;
    const colorAttr = geom.getAttribute("color");
    if (!colorAttr || !colorAttr.array) {
        console.warn("[PDE VIEWER] Color attribute missing on geometry.");
        return;
    }

    const frameIndex = ((k % T) + T) % T;
    const elemsPerFrame = V * 3;
    const start = frameIndex * elemsPerFrame;
    const end = start + elemsPerFrame;

    if (end > data.length) {
        console.warn("[PDE VIEWER] Frame slice out of range.", {
            frameIndex,
            start,
            end,
            dataLength: data.length,
            elemsPerFrame,
        });
        return;
    }

    // Normal path: copy data
    if (dtype === "u8") {
        // data is Uint8Array, convert to 0..1 floats
        const sliceU8 = data.subarray(start, end);
        for (let i = 0; i < elemsPerFrame; i++) {
            colorAttr.array[i] = sliceU8[i] / 255.0;
            // console.log("integers", {value: sliceU8[i]})
        }
    } else {
        // data is Float32Array in 0..1
        const sliceF32 = data.subarray(start, end);
        colorAttr.array.set(sliceF32); //slice
    }
    colorAttr.needsUpdate = true;
}

// ---------------------------------------------
// Animation loop
// ---------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    const speed = 5.0; // frames per second-ish
    frameFloat += speed * 0.016;

    if (anim) {
        const k = Math.floor(frameFloat);
        applyFrame(k);

        // Optional: Reset frameFloat to 0 when it exceeds T to keep numbers small
        // and strictly "restart" the counter, though visual looping is handled by modulo in applyFrame.
        if (k >= anim.T/4) {
            frameFloat = 0;
        }

        if (timerEl) {
            timerEl.style.display = "block";
            // Assuming 30fps simulation speed, display seconds or just a raw counter
            // Let's display a "time" value. If we assume dt=0.01 or similar.
            // For now, let's just show the frame index as a proxy for time, or scaled.
            // t = frame * 0.01 is common for heat.
            timerEl.innerText = `t = ${(frameFloat * 0.01).toFixed(2)}/${(anim.T * 0.0025).toFixed(2)}`;
        }
    } else {
        if (timerEl) {
            // For Poisson (steady state), hide timer or show "Steady State"
            timerEl.style.display = "none";
        }
    }

    // Update gesture hint visibility
    updateGestureHint();

    // Auto-animate when no user interaction - repeating cycle
    const timeSinceInteraction = Date.now() - lastUserInteractionTime;
    if (timeSinceInteraction > GESTURE_HINT_DELAY && mesh && controls) {
        // Initialize animation cycle on first frame
        if (animationStartTime === 0) {
            animationStartTime = Date.now();
        }
        
        // Calculate elapsed time within the animation cycle
        const elapsedInCycle = (Date.now() - animationStartTime) % (AUTO_ANIMATION_DURATION + GESTURE_HINT_DELAY);
        
        // Only animate during the animation duration, then wait before repeating
        if (elapsedInCycle < AUTO_ANIMATION_DURATION) {
            // Smoothly rotate camera around the Y-axis using OrbitControls' theta
            const progress = elapsedInCycle / AUTO_ANIMATION_DURATION;
            const angleSignal = Math.sin(progress * Math.PI * 4)*0.2; // Shared signal for camera + icon
            const angle = angleSignal * 0.4; // Full sine wave over animation duration
            
            // Rotate using OrbitControls' autoRotate-like approach
            // Store base theta on first animation
            if (!controls._baseTheta) {
                controls._baseTheta = controls.getAzimuthalAngle();
            }
            
            // Apply rotation offset to theta while maintaining phi (vertical angle)
            const newTheta = controls._baseTheta + angle;
            const radius = controls.getDistance();
            const phi = controls.getPolarAngle();
            
            // Update camera position using spherical coordinates
            const centerPos = controls.target;
            camera.position.x = centerPos.x + radius * Math.sin(phi) * Math.sin(newTheta);
            camera.position.y = centerPos.y + radius * Math.cos(phi);
            camera.position.z = centerPos.z + radius * Math.sin(phi) * Math.cos(newTheta);
            camera.lookAt(centerPos);
            
            // Show and position finger icon moving left-right in sync with camera
            if (gestureHintEl && renderer) {
                const canvas = renderer.domElement;
                const canvasRect = canvas.getBoundingClientRect();
                const centerX = canvasRect.width / 2;
                const centerY = canvasRect.height / 2;
                const dragDistance = 80;
                const pointerX = centerX - angleSignal * dragDistance; // Keep icon in phase with camera
                
                gestureHintEl.style.left = pointerX + 'px';
                gestureHintEl.style.top = centerY + 'px';
            }
        }
    } else {
        // Reset animation when user interacts
        animationStartTime = 0;
        if (controls) {
            controls._baseTheta = undefined; // Reset stored theta
        }
        
        // Reset finger position when not animating
        if (gestureHintEl && renderer) {
            const canvas = renderer.domElement;
            const canvasRect = canvas.getBoundingClientRect();
            gestureHintEl.style.left = (canvasRect.width / 2) + 'px';
            gestureHintEl.style.top = (canvasRect.height / 2) + 'px';
        }
    }

    resizeRenderer();
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function setModel(meshUrl, metaUrl, binUrl, shapeName, resetTimer = false) {
    if (!camera || !controls) {
        console.warn("[PDE VIEWER] Viewer not initialized yet, cannot set model.");
        return;
    }

    const shapeChanged = (lastShape && shapeName && shapeName !== lastShape);
    console.log("shape changed", { shapeChanged, lastShape, shapeName })
    lastShape = shapeName || lastShape;
    if (!shapeChanged) {
        savedCameraPos = camera.position.clone();
        savedTarget = controls.target.clone();

        if (mesh) savedRotation = mesh.rotation.clone();
    } else {
        savedCameraPos = null;
        savedTarget = null;
        savedRotation = null;
    }

    const meshChanged = !!meshUrl && meshUrl !== MESH_URL;
    const colorsChanged = metaUrl !== COLORS_META_URL || binUrl !== COLORS_BIN_URL;

    // if same config as current, do nothing
    if (!meshChanged && !colorsChanged && !resetTimer) {
        console.log("[PDE VIEWER] setModel called with same paths, ignoring.");
        return;
    }

    if (shapeChanged || resetTimer) {
        frameFloat = 0;
    }

    // If only the color data changed (typical "heat" method switch), keep the current mesh
    // and just reload the animation. This avoids flashing the baked GLB colors.
    if (!meshChanged && mesh && scene) {
        // Update color URLs (may be null to clear)
        COLORS_META_URL = metaUrl;
        COLORS_BIN_URL = binUrl;
        anim = null;

        console.log("[PDE VIEWER] Switched colors (mesh unchanged):", {
            MESH_URL,
            COLORS_META_URL,
            COLORS_BIN_URL,
        });

        // If colors are absent (e.g., steady-state), just stop anim.
        if (!COLORS_META_URL || !COLORS_BIN_URL) {
            return;
        }

        loadColorData();
        return;
    }

    // Otherwise, reload the mesh (shape change, poisson mesh, or first load)
    if (mesh && scene) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh = null;
    }
    anim = null;

    if (meshUrl) MESH_URL = meshUrl;

    // allow null to *clear* colors for Poisson
    COLORS_META_URL = metaUrl;
    COLORS_BIN_URL = binUrl;

    console.log("[PDE VIEWER] Switched model:", {
        MESH_URL,
        COLORS_META_URL,
        COLORS_BIN_URL,
    });

    loadScene();
}
// expose it globally so script.js can call it
window.PDE_VIEWER_SET_MODEL = setModel;
