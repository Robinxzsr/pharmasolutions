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
/**
 * Pill placement, as a percentage of the BACKGROUND IMAGE — not the viewport.
 *
 * The plate is cover-fitted, so the hands shift and crop as the window aspect
 * changes. Anchoring to image space means the pill tracks the hands instead of
 * drifting away from them.
 *
 * Measured from the source plate (2048x1153): the right hand's fingertip sits
 * at x 66.7%, y 67.8%. Y here is that fingertip's height, so the pill meets it.
 */
const PILL_X = 50; // centred in the gap between the hands
const PILL_Y = 67.8; // the right hand's fingertip height

/**
 * Which point ON THE PILL lands on PILL_Y, as a fraction of the pill's height
 * measured from its bottom. 0.75 puts the pill's three-quarter mark on the
 * fingertip; 0.5 would centre the pill there.
 *
 * Solved against the model's real bounding box at load, so it stays correct if
 * the model is ever rebuilt at a different size.
 */
const PILL_ANCHOR = 0.5;

/**
 * Glow character — every knob that decides whether the pill reads as *lit from
 * within* or as *a shiny object catching a lamp*. All of it lives here so the
 * look can be tuned without hunting through the material, the lights, and the
 * bloom pass separately.
 *
 * The rule of thumb: sharpness comes from tight specular highlights, so soften
 * by widening the specular lobe (roughness up, clearcoat down) and letting the
 * bloom do the work instead (low threshold, wide radius).
 */
const GLOW = {
  /** Width of the specular lobe. Low values give a hard mirror streak. */
  roughness: 0.45,
  /**
   * The glossy varnish coat. This is the main source of the sharp highlight —
   * it sits on top of the base material with its own, much tighter, specular.
   */
  clearcoat: 0.3,
  clearcoatRoughness: 0.6,
  /** Soft velvet falloff at the silhouette. Diffuse by nature, so safe to lean on. */
  sheen: 0.85,
  /** Internal emission. Drives the bloom, so this is the glow's real brightness. */
  emissive: 0.42,
  /** How far the emission breathes either side of that. */
  emissivePulse: 0.08,
  /** Intensity of the white rim light — the main source of the white-hot core. */
  rimLight: 0.6,
  /**
   * The pill's own surface colour. Kept lavender rather than near-white so it
   * still reads as violet under direct light, instead of blowing out white.
   */
  surfaceColor: 0xd9c4ff,
  /** Violet key light. */
  keyLight: 3.2,
  /**
   * Bloom. A low threshold pulls the pill's mid-tones into the halo (rather
   * than just its hottest pixels) and a wide radius spreads them, which is
   * what turns a hot core into an atmospheric glow.
   */
  bloomStrength: 0.9,
  bloomRadius: 0.58,
  bloomThreshold: 0.2,
} as const;

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
    // The pill's anchor reads the crop this just set. If the model won the
    // race, its placement was computed against an unfitted plate — redo it.
    positionPill();
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
  const keyLight = new THREE.DirectionalLight(0x9d4edd, GLOW.keyLight);
  keyLight.position.set(-3, 2, 3);
  const fillLight = new THREE.DirectionalLight(0xff8c42, 1.1);
  fillLight.position.set(3, -1, 3);
  const rimLight = new THREE.DirectionalLight(0xffffff, GLOW.rimLight);
  rimLight.position.set(0, 3, -4);
  const backLight = new THREE.DirectionalLight(0x6a0dad, 2.5);
  backLight.position.set(0, -2, -3);

  scene.add(ambient, keyLight, fillLight, rimLight, backLight);

  // -- Pill material: emissive drives the bloom --
  const pillMaterial = new THREE.MeshPhysicalMaterial({
    color: GLOW.surfaceColor,
    metalness: 0.0,
    roughness: GLOW.roughness,
    ior: 1.45,
    emissive: 0x7c4dff,
    emissiveIntensity: GLOW.emissive,
    clearcoat: GLOW.clearcoat,
    clearcoatRoughness: GLOW.clearcoatRoughness,
    sheen: GLOW.sheen,
    sheenColor: new THREE.Color(0xffa060),
  });

  /**
   * Background-image percentage to world position on the z=0 plane.
   *
   * Walks the same cover-fit the plate uses: image UV -> visible window (via
   * the texture's repeat/offset) -> world units on the plate -> scaled forward
   * onto the pill's plane. Because both planes are centred on the camera axis,
   * that last step is a straight ratio of their distances.
   */
  function imageToWorld(xPct: number, yPct: number) {
    const { w, h } = viewSizeAt(bgDist);

    // Texture V runs bottom-up; the incoming percentage runs top-down.
    const u = xPct / 100;
    const v = 1 - yPct / 100;

    // Where that pixel falls across the visible crop, 0..1.
    const xFrac = (u - bgTexture.offset.x) / bgTexture.repeat.x;
    const yFrac = (v - bgTexture.offset.y) / bgTexture.repeat.y;

    // The plate is centred on the origin, so 0.5 is the middle.
    const xAtPlate = (xFrac - 0.5) * w;
    const yAtPlate = (yFrac - 0.5) * h;

    // Project from the plate's depth onto z=0 so it lines up on screen.
    const scale = camera.position.z / bgDist;
    return new THREE.Vector3(xAtPlate * scale, yAtPlate * scale, 0);
  }

  let pillMesh: THREE.Group | null = null;
  /** The model's height in world units, measured once at load. */
  let pillHeight = 0;

  /**
   * Puts the pill's PILL_ANCHOR point on the PILL_X/PILL_Y target.
   *
   * `position` moves the group's origin, which sits at the model's centre — so
   * the anchor offset is the gap between that centre and the point we actually
   * want to land, half a pill height at the extremes.
   */
  function positionPill() {
    if (!pillMesh) return;
    const target = imageToWorld(PILL_X, PILL_Y);
    pillMesh.position.set(
      target.x,
      target.y - pillHeight * (PILL_ANCHOR - 0.5),
      0
    );
  }
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

      // Measure before any rotation is applied, so the height is the model's
      // own and not the sweep of its bounding box mid-spin.
      pillHeight = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).y;

      positionPill();
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
      GLOW.bloomStrength,
      GLOW.bloomRadius,
      GLOW.bloomThreshold
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
      pillMaterial.emissiveIntensity = GLOW.emissive + Math.sin(t * 1.2) * GLOW.emissivePulse;
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

    // Order matters: the pill's anchor is derived from the plate's crop, so the
    // plate has to be refitted first.
    fitBackgroundCover();
    positionPill();
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
