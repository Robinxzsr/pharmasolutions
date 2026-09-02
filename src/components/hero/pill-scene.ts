/**
 * The hero's three.js scene: background plate, lit pill, selective bloom.
 *
 * Ported from the standalone prototype. Structural changes made in the port:
 *   - packaged as an init function returning a teardown, so it survives
 *     client-side navigation instead of leaking a rAF loop per visit;
 *   - the render loop pauses when the hero scrolls out of view or the tab is
 *     hidden (the prototype was a single non-scrolling page, so it could
 *     afford to render forever — a real site cannot);
 *   - reduced-motion is honoured: the scene still renders, it just holds a
 *     still frame instead of spinning and pulsing.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export interface PillSceneOptions {
  canvas: HTMLCanvasElement;
  /** Hashed URL of the background plate. */
  backgroundUrl: string;
  /** Hashed URL of the pre-centred, pre-scaled pill model. */
  modelUrl: string;
  /** Called once the scene has drawn a frame — drives the copy reveal. */
  onReady: () => void;
}

/** Layer 1 = "things that glow". Only meshes on it reach the bloom pass. */
const BLOOM_SCENE = 1;
/** Bloom is a blur, so half-res is indistinguishable and halves the cost. */
const BLOOM_SCALE = 0.5;
/** Depth of the background plate, in world units behind the pill plane. */
const BG_DEPTH = -6;
/** Pill placement as a percentage of the viewport — centred in the hands' gap. */
const PILL_X = 50;
const PILL_Y = 70;

export function initPillScene({
  canvas,
  backgroundUrl,
  modelUrl,
  onReady,
}: PillSceneOptions): () => void {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const bloomLayer = new THREE.Layers();
  bloomLayer.set(BLOOM_SCENE);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // -- Reveal orchestration --
  // Nothing is shown until the plate and the model are both ready and a frame
  // has actually been drawn, so the hero arrives as one deliberate fade rather
  // than text, then background, then pill.
  let bgReady = false;
  let pillReady = false;
  let revealed = false;
  let disposed = false;

  function reveal() {
    if (revealed || disposed) return;
    revealed = true;
    onReady();
  }

  function maybeReveal() {
    if (revealed || !bgReady || !pillReady) return;
    // Front-load shader compilation (MeshPhysicalMaterial + bloom is the slow
    // part) so the first visible frame is not the one that stalls.
    renderer.compile(scene, camera);
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  }

  // Safety net: if WebGL fails or an asset hangs, never leave the copy hidden.
  const revealTimeout = window.setTimeout(reveal, 3000);

  // -- Background plate: the hands, inside the 3D scene --
  const bgDist = camera.position.z - BG_DEPTH;

  function viewSizeAt(dist: number) {
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return { w: h * camera.aspect, h };
  }

  const bgTexture = new THREE.TextureLoader().load(backgroundUrl, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    // Match the crispness of the CSS background underneath, so the moment the
    // canvas fades in there is no visible change in the hands.
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    fitBackgroundCover();
    bgReady = true;
    maybeReveal();
  });

  const bgGeometry = new THREE.PlaneGeometry(1, 1);
  const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, toneMapped: false });
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
  bgMesh.position.z = BG_DEPTH;
  scene.add(bgMesh);

  /** Emulates CSS `background-size: cover` on the plate. */
  function fitBackgroundCover() {
    const { w, h } = viewSizeAt(bgDist);
    bgMesh.scale.set(w, h, 1);

    const img = bgTexture.image as HTMLImageElement | undefined;
    if (!img) return;

    const imgAspect = img.width / img.height;
    const viewAspect = w / h;

    if (viewAspect > imgAspect) {
      const r = imgAspect / viewAspect;
      bgTexture.repeat.set(1, r);
      bgTexture.offset.set(0, (1 - r) / 2);
    } else {
      const r = viewAspect / imgAspect;
      bgTexture.repeat.set(r, 1);
      bgTexture.offset.set((1 - r) / 2, 0);
    }
  }

  // -- Lighting: violet key, ember fill, white rim, violet back --
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  const keyLight = new THREE.DirectionalLight(0x9d4edd, 4);
  keyLight.position.set(-3, 2, 3);
  const fillLight = new THREE.DirectionalLight(0xff8c42, 1.1);
  fillLight.position.set(3, -1, 3);
  const rimLight = new THREE.DirectionalLight(0xffffff, 2.5);
  rimLight.position.set(0, 3, -4);
  const backLight = new THREE.DirectionalLight(0x6a0dad, 2.5);
  backLight.position.set(0, -2, -3);

  scene.add(ambient, keyLight, fillLight, rimLight, backLight);

  // -- Pill material: emissive drives the bloom --
  const pillMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe8dcff,
    metalness: 0.0,
    roughness: 0.28,
    ior: 1.45,
    emissive: 0x7c4dff,
    emissiveIntensity: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffa060),
  });

  /** Screen percentage to world position on the z=0 plane. */
  function screenToWorld(xPct: number, yPct: number) {
    const ndc = new THREE.Vector3((xPct / 100) * 2 - 1, -(yPct / 100) * 2 + 1, 0);
    ndc.unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    return camera.position.clone().add(dir.multiplyScalar(dist));
  }

  let pillMesh: THREE.Group | null = null;
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  gltfLoader.load(
    modelUrl,
    (gltf) => {
      if (disposed) return;
      const obj = gltf.scene;

      // The model is pre-centred and pre-scaled at build time (build_pill.mjs),
      // so it already spins on its own axis. No runtime bounding-box maths.
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.computeVertexNormals(); // normals were stripped to allow welding
        mesh.material = pillMaterial;
        mesh.layers.enable(BLOOM_SCENE);
      });

      pillMesh = new THREE.Group();
      pillMesh.add(obj);
      pillMesh.position.copy(screenToWorld(PILL_X, PILL_Y));
      scene.add(pillMesh);

      pillReady = true;
      maybeReveal();
    },
    undefined,
    (err) => {
      console.error("[hero] GLB load failed:", err);
      reveal(); // Show the copy regardless: the plate alone still reads.
    }
  );

  // -- Pass 1: bloom, pill only --
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * BLOOM_SCALE, window.innerHeight * BLOOM_SCALE),
      0.85, // strength
      0.6, // radius
      0.35 // threshold
    )
  );

  // -- Pass 2: full scene, with the bloom buffer added on top --
  const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform sampler2D baseTexture;",
        "uniform sampler2D bloomTexture;",
        "varying vec2 vUv;",
        "void main() {",
        "  gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);",
        "}",
      ].join("\n"),
    }),
    "baseTexture"
  );
  mixPass.needsSwap = true;

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());

  bloomComposer.setSize(window.innerWidth * BLOOM_SCALE, window.innerHeight * BLOOM_SCALE);

  // -- Blackout everything that isn't the pill, for pass 1 --
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const savedMaterials = new Map<string, THREE.Material | THREE.Material[]>();

  function darkenNonBloomed(obj: THREE.Object3D) {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && bloomLayer.test(mesh.layers) === false) {
      savedMaterials.set(mesh.uuid, mesh.material);
      mesh.material = darkMaterial;
    }
  }

  function restoreMaterial(obj: THREE.Object3D) {
    const mesh = obj as THREE.Mesh;
    const saved = savedMaterials.get(mesh.uuid);
    if (saved) {
      mesh.material = saved;
      savedMaterials.delete(mesh.uuid);
    }
  }

  // -- Render loop --
  const clock = new THREE.Clock();
  let frameHandle = 0;
  let running = false;

  function renderFrame() {
    const t = clock.getElapsedTime();

    if (!prefersReducedMotion) {
      if (pillMesh) pillMesh.rotation.y = t * 0.8;
      // Breathing emissive: the bloom follows it, so the glow is dynamic.
      pillMaterial.emissiveIntensity = 0.32 + Math.sin(t * 1.2) * 0.1;
    }

    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);

    finalComposer.render();
  }

  function tick() {
    if (!running) return;
    frameHandle = requestAnimationFrame(tick);
    renderFrame();
  }

  function start() {
    if (running || disposed) return;
    running = true;
    // Resume the clock where it stopped so the pill doesn't jump on return.
    clock.start();
    frameHandle = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    clock.stop();
    cancelAnimationFrame(frameHandle);
  }

  // Only render while the hero is actually on screen.
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !document.hidden) start();
      else stop();
    },
    { threshold: 0 }
  );
  io.observe(canvas);

  // ...and only while the tab is focused.
  function onVisibility() {
    if (document.hidden) stop();
    else if (canvas.getBoundingClientRect().bottom > 0) start();
  }
  document.addEventListener("visibilitychange", onVisibility);

  // A still scene only needs the one frame; draw it even though it never runs.
  if (prefersReducedMotion) requestAnimationFrame(renderFrame);

  // -- Resize --
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
    bloomComposer.setSize(w * BLOOM_SCALE, h * BLOOM_SCALE);
    finalComposer.setSize(w, h);

    fitBackgroundCover();
    if (pillMesh) pillMesh.position.copy(screenToWorld(PILL_X, PILL_Y));
    if (!running) renderFrame(); // Keep a paused or still scene correct.
  }
  window.addEventListener("resize", onResize, { passive: true });

  // -- Teardown --
  return function dispose() {
    if (disposed) return;
    disposed = true;

    stop();
    window.clearTimeout(revealTimeout);
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      (Array.isArray(material) ? material : [material]).forEach((m) => m?.dispose());
    });

    bgGeometry.dispose();
    bgMaterial.dispose();
    bgTexture.dispose();
    pillMaterial.dispose();
    darkMaterial.dispose();
    bloomComposer.dispose();
    finalComposer.dispose();
    renderer.dispose();
  };
}
