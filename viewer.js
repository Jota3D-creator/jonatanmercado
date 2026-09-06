import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const PRODUCT_CONFIG = {
  tonstad: {
    cameraDirection: new THREE.Vector3(1.25, 0.85, 1.65),

    textures: {
      wood: {
        baseColor: "assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_BaseColor.png",
        normal: "assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_Normal.png",
        roughness: "assets/models/Tonstad/WOOD/Model_Tonstad_WOOD_Roughness.png",
        ao: "assets/models/Tonstad/WOOD/Tonstad_AO.png"
      },

      white: {
        baseColor: "assets/models/Tonstad/WHITE/Model_Tonstad_WOOD_BaseColor.png",
        normal: "assets/models/Tonstad/WHITE/Model_Tonstad_WOOD_Normal.png",
        roughness: "assets/models/Tonstad/WHITE/Model_Tonstad_WOOD_Roughness.png",
        ao: "assets/models/Tonstad/WHITE/Tonstad_AO.png"
      }
    }
  },

  hauga: {
    cameraDirection: new THREE.Vector3(1.35, 0.82, 1.75),

    // Exact drawer nodes present in Almacenamiento_Hauga.glb.
    // They are named as animation nodes in Blender but the supplied GLB does not
    // serialize AnimationClips for them, so we map only these exact nodes.
    exactDrawerNodes: {
      "anim_Cajon 1": { axis: "z", distance: 0.22, sign: 1 },
      "anim_Cajon 2": { axis: "z", distance: 0.22, sign: 1 },
      "anim_Cajon 3": { axis: "z", distance: 0.22, sign: 1 }
    },

    // Exact glTF WHITE material baseColorFactor found in the uploaded HAUGA file.
    // The exported WHITE material shares the non-color maps with WOOD but has no
    // BaseColor texture.
    whiteColor: new THREE.Color(
      0.4444735646247864,
      0.4444735646247864,
      0.4444735646247864
    )
  }
};

const NAME_PATTERNS = {
  glass: /(glass|vidrio|window|ventana|crystal|cristal)/i,
  metal: /(metal|handle|manija|tirador|hinge|bisagra|screw|tornillo|hardware)/i,
  wood: /(wood|madera|timber|oak|roble|body|cabinet|carcass|frame)/i,
  door: /(door|puerta|hinged|hinge[_\s-]?door|front[_\s-]?door)/i,
  slidingDoor: /(sliding|slide|corredera|corrediza|slidedoor|sliding[_\s-]?door)/i,
  drawer: /(drawer|cajon|cajón|gaveta|drawerfront|cajonera)/i
};

const DEBUG = new URLSearchParams(window.location.search).get("viewerDebug") === "1";

class ProductViewer {
  constructor(root) {
    this.root = root;
    this.id = root.dataset.viewerId;
    this.product = root.dataset.product || this.id;
    this.modelUrl = root.dataset.model;
    this.config = PRODUCT_CONFIG[this.id] || PRODUCT_CONFIG.tonstad;

    this.canvas = root.querySelector(".viewer-canvas");
    this.loadingEl = root.querySelector(".viewer-loading");
    this.stage = root.querySelector(".viewer-stage");

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.01;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.sortObjects = true;
    this.renderer.setClearColor(0x000000, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.38;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.84;

    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    this.model = null;
    this.mixer = null;

    // Movement comes ONLY from clips embedded in the GLB.
    this.clipGroups = {
      hingedDoors: [],
      slidingDoors: [],
      genericDoors: [],
      drawers: [],
      other: []
    };

    this.allClipItems = [];

    // Some exported furniture files keep clearly named drawer nodes (for example
    // `anim_Cajon 1`) but do not actually serialize AnimationClips for them.
    // We keep a very narrow fallback for those named nodes only.
    this.drawerFallbackNodes = [];

    this.materialUsage = new Map();
    this.primaryWoodMaterials = [];
    this.variantTextures = new Map();

    // HAUGA keeps exact original WOOD materials and creates its WHITE variant
    // from the exported material definition.
    this.haugaMaterialBindings = [];

    this.modelBox = new THREE.Box3();
    this.modelSize = new THREE.Vector3();
    this.modelCenter = new THREE.Vector3();
    this.modelRadius = 1;
    this.cameraHome = null;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.pointerDown = null;
    this.lastTap = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);

    this.bindUI();
    this.bindPointerInteraction();
    this.setupEnvironment();
    this.load();
    this.animate();
  }

  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();

    this.scene.environment = pmrem.fromScene(room, 0.04).texture;

    room.dispose();
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xf4f0e8, 0x474b52, 0.62);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff2df, 3.0);
    key.position.set(3.5, 6.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0002;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdce8ff, 1.08);
    fill.position.set(-4, 2.5, -2.5);
    this.scene.add(fill);
  }

  async load() {
    try {
      this.setLoading("Loading model");

      const gltf = await this.loader.loadAsync(this.modelUrl);
      this.model = gltf.scene;
      this.scene.add(this.model);

      this.model.traverse((obj) => {
        if (!obj.isMesh) return;

        obj.castShadow = true;
        obj.receiveShadow = true;

        if (obj.geometry?.attributes?.uv && !obj.geometry.attributes.uv1) {
          obj.geometry.setAttribute("uv1", obj.geometry.attributes.uv.clone());
        }

        const sourceMaterials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];

        const patchedMaterials = sourceMaterials.map((sourceMat) => {
          if (!sourceMat) return sourceMat;

          const mat = this.isGlassMaterial(sourceMat, obj.name)
            ? this.makeClearGlassMaterial(sourceMat)
            : sourceMat;

          const count =
            obj.geometry?.index?.count ||
            obj.geometry?.attributes?.position?.count ||
            1;

          this.materialUsage.set(
            mat,
            (this.materialUsage.get(mat) || 0) + count
          );

          this.patchTextureColorSpaces(mat);
          return mat;
        });

        obj.material = Array.isArray(obj.material)
          ? patchedMaterials
          : patchedMaterials[0];
      });

      this.modelBox.setFromObject(this.model);
      this.modelBox.getSize(this.modelSize);
      this.modelBox.getCenter(this.modelCenter);

      const modelSphere = new THREE.Sphere();
      this.modelBox.getBoundingSphere(modelSphere);
      this.modelRadius = Math.max(modelSphere.radius, 0.01);

      this.findPrimaryWoodMaterials();
      this.setupHaugaMaterialVariants();
      this.setupEmbeddedAnimations(gltf.animations || []);
      this.setupNamedDrawerFallbacks();

      this.addGround();
      this.frameModel();

      if (this.id === "tonstad") {
        await this.prepareTonstadVariants();
        await this.applyTonstadFinish("wood");
      }

      if (this.id === "hauga") {
        this.applyHaugaFinish("wood");
      }

      this.updateMotionUIAvailability();

      this.loadingEl.classList.add("is-hidden");

      if (DEBUG) this.renderDebugPanel(gltf);
    } catch (error) {
      console.error(`[${this.product}] viewer failed`, error);
      this.setLoading("Could not load model");
      this.loadingEl.classList.add("is-error");
    }
  }

  /* ------------------------------------------------
     MATERIALS
  ------------------------------------------------ */

  patchTextureColorSpaces(mat) {
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;

    [
      mat.normalMap,
      mat.roughnessMap,
      mat.metalnessMap,
      mat.aoMap,
      mat.alphaMap
    ]
      .filter(Boolean)
      .forEach((tex) => {
        tex.colorSpace = THREE.NoColorSpace;
      });
  }

  isGlassMaterial(mat, objectName = "") {
    return NAME_PATTERNS.glass.test(
      `${mat?.name || ""} ${objectName || ""}`
    );
  }

  makeClearGlassMaterial(sourceMat) {
    // Clear, subtly visible architectural/furniture glass.
    // We intentionally ignore the packed source alpha atlas because it produced
    // uneven/disappearing panes. Low alpha + depthWrite false gives a cleaner
    // transparent result against the WebGL canvas.
    const glass = new THREE.MeshPhysicalMaterial({
      name: `${sourceMat.name || "GLASS"}__viewer`,
      color: new THREE.Color(0xeef4f5),
      metalness: 0,
      roughness: 0.055,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      ior: 1.45,
      clearcoat: 0.20,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.9
    });

    if (sourceMat.roughnessMap) {
      glass.roughnessMap = sourceMat.roughnessMap;
      glass.roughnessMap.colorSpace = THREE.NoColorSpace;
    }

    glass.needsUpdate = true;
    return glass;
  }

  findPrimaryWoodMaterials() {
    const entries = [...this.materialUsage.entries()]
      .filter(([mat]) => {
        const name = mat.name || "";

        return (
          !NAME_PATTERNS.glass.test(name) &&
          !NAME_PATTERNS.metal.test(name)
        );
      })
      .sort((a, b) => b[1] - a[1]);

    const namedWood = entries.filter(([mat]) =>
      NAME_PATTERNS.wood.test(mat.name || "")
    );

    this.primaryWoodMaterials = namedWood.length
      ? namedWood.map(([mat]) => mat)
      : entries.slice(0, 1).map(([mat]) => mat);
  }

  setupHaugaMaterialVariants() {
    if (this.id !== "hauga" || !this.model) return;

    const whiteByWoodMaterial = new Map();

    this.model.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;

      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];

      materials.forEach((mat, index) => {
        if (!mat || !/^WOOD$/i.test(mat.name || "")) return;

        let white = whiteByWoodMaterial.get(mat);

        if (!white) {
          white = mat.clone();
          white.name = "WHITE__viewer";

          // Match the exported HAUGA WHITE material definition:
          // no BaseColor texture, constant base color, while retaining
          // normal / AO / roughness / metallic / emissive maps from the set.
          white.map = null;

          if (white.color) {
            white.color.copy(this.config.whiteColor);
          }

          white.needsUpdate = true;
          whiteByWoodMaterial.set(mat, white);
        }

        this.haugaMaterialBindings.push({
          mesh: obj,
          index,
          wood: mat,
          white
        });
      });
    });
  }

  applyHaugaFinish(finish) {
    if (this.id !== "hauga" || !this.haugaMaterialBindings.length) return;

    this.haugaMaterialBindings.forEach((binding) => {
      const target = finish === "white"
        ? binding.white
        : binding.wood;

      if (Array.isArray(binding.mesh.material)) {
        const list = [...binding.mesh.material];
        list[binding.index] = target;
        binding.mesh.material = list;
      } else {
        binding.mesh.material = target;
      }
    });
  }

  async prepareTonstadVariants() {
    const loadSet = async (finish, urls) => {
      try {
        const [baseColor, normal, roughness, ao] = await Promise.all([
          this.loadExternalTexture(urls.baseColor, true),
          this.loadExternalTexture(urls.normal, false),
          this.loadExternalTexture(urls.roughness, false),
          this.loadExternalTexture(urls.ao, false)
        ]);

        this.variantTextures.set(finish, {
          baseColor,
          normal,
          roughness,
          ao
        });
      } catch (error) {
        console.warn(
          `[TONSTAD] Could not load ${finish} texture set`,
          error
        );
      }
    };

    await Promise.all(
      Object.entries(this.config.textures || {}).map(([finish, urls]) =>
        loadSet(finish, urls)
      )
    );
  }

  async loadExternalTexture(url, isColor) {
    const texture = await this.textureLoader.loadAsync(url);

    texture.flipY = false;
    texture.colorSpace = isColor
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;

    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy()
    );

    texture.needsUpdate = true;
    return texture;
  }

  async applyTonstadFinish(finish) {
    const set = this.variantTextures.get(finish);

    if (!set || !this.primaryWoodMaterials.length) return;

    this.primaryWoodMaterials.forEach((mat) => {
      mat.map = set.baseColor;
      mat.normalMap = set.normal;
      mat.roughnessMap = set.roughness;
      mat.aoMap = set.ao;
      mat.aoMapIntensity = 1;

      if (mat.color) mat.color.set(0xffffff);

      mat.needsUpdate = true;
    });
  }

  /* ------------------------------------------------
     EMBEDDED ANIMATIONS ONLY
  ------------------------------------------------ */

  setupEmbeddedAnimations(clips) {
    if (!clips.length) {
      this.mixer = null;
      return;
    }

    this.mixer = new THREE.AnimationMixer(this.model);

    clips.forEach((clip) => {
      const action = this.mixer.clipAction(clip);

      action.enabled = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.paused = true;
      action.time = 0;

      const item = {
        clip,
        action,
        targetNames: this.getClipTargetNames(clip),
        properties: this.getClipProperties(clip),
        isOpen: false,
        tweenToken: 0
      };

      const group = this.classifyClip(item);
      this.clipGroups[group].push(item);
      this.allClipItems.push(item);
    });

    this.promoteUnclassifiedTranslationsToDrawers();
    this.mixer.update(0);
  }

  getClipTargetNames(clip) {
    const names = new Set();

    clip.tracks.forEach((track) => {
      const lastDot = track.name.lastIndexOf(".");
      const targetName = lastDot >= 0
        ? track.name.slice(0, lastDot)
        : track.name;

      if (targetName) names.add(targetName);
    });

    return [...names];
  }

  getClipProperties(clip) {
    const properties = new Set();

    clip.tracks.forEach((track) => {
      const lastDot = track.name.lastIndexOf(".");
      const property = lastDot >= 0
        ? track.name.slice(lastDot + 1)
        : "";

      if (property) properties.add(property);
    });

    return properties;
  }

  classifyClip(item) {
    const label = [
      item.clip.name,
      ...item.targetNames
    ].join(" ");

    if (NAME_PATTERNS.drawer.test(label)) {
      return "drawers";
    }

    const looksLikeDoor =
      NAME_PATTERNS.door.test(label) ||
      NAME_PATTERNS.slidingDoor.test(label);

    if (looksLikeDoor) {
      if (
        NAME_PATTERNS.slidingDoor.test(label) ||
        (
          item.properties.has("position") &&
          !item.properties.has("quaternion")
        )
      ) {
        return "slidingDoors";
      }

      if (item.properties.has("quaternion")) {
        return "hingedDoors";
      }

      return "genericDoors";
    }

    return "other";
  }

  promoteUnclassifiedTranslationsToDrawers() {
    // Furniture exports often contain generic action names. If a clip only moves
    // position and wasn't identified as a door, it is much more likely to be a
    // drawer / pull-out than an arbitrary transform.
    const stillOther = [];

    this.clipGroups.other.forEach((item) => {
      const positionOnly =
        item.properties.has("position") &&
        !item.properties.has("quaternion") &&
        !item.properties.has("scale");

      if (positionOnly) {
        this.clipGroups.drawers.push(item);
      } else {
        stillOther.push(item);
      }
    });

    this.clipGroups.other = stillOther;
  }

  setupNamedDrawerFallbacks() {
    if (!this.model) return;

    const animatedTargets = new Set(
      this.allClipItems.flatMap((item) => item.targetNames)
    );

    const exact = this.config.exactDrawerNodes || null;

    // HAUGA: use the three exact anim_Cajon nodes we inspected in the GLB.
    // This avoids guessing the axis or distance from camera orientation.
    if (exact) {
      Object.entries(exact).forEach(([name, motion]) => {
        const obj = this.model.getObjectByName(name);

        if (!obj) return;
        if (animatedTargets.has(name)) return;

        this.drawerFallbackNodes.push({
          obj,
          axis: motion.axis,
          sign: motion.sign ?? 1,
          distance: motion.distance,
          originalPosition: obj.position.clone(),
          value: 0,
          tweenToken: 0
        });
      });

      return;
    }

    // Generic fallback for other products only when a clearly named drawer node
    // exists but no embedded animation clip targets it.
    const axis =
      Math.abs(this.config.cameraDirection.z) >=
      Math.abs(this.config.cameraDirection.x)
        ? "z"
        : "x";

    const sign = Math.sign(this.config.cameraDirection[axis]) || 1;

    this.model.traverse((obj) => {
      if (!obj.name || !NAME_PATTERNS.drawer.test(obj.name)) return;
      if (animatedTargets.has(obj.name)) return;

      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);

      if (!Number.isFinite(size[axis]) || size[axis] <= 0) return;

      const distance = Math.min(
        size[axis] * 0.52,
        this.modelSize[axis] * 0.48
      );

      this.drawerFallbackNodes.push({
        obj,
        axis,
        sign,
        distance,
        originalPosition: obj.position.clone(),
        value: 0,
        tweenToken: 0
      });
    });
  }

  setDrawerFallback(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);

    this.drawerFallbackNodes.forEach((item) => {
      item.tweenToken += 1;
      item.value = t;
      item.obj.position.copy(item.originalPosition);
      item.obj.position[item.axis] += item.sign * item.distance * t;
    });
  }

  findDrawerFallbackForObject(object) {
    if (!object || !this.drawerFallbackNodes.length) return null;

    for (const item of this.drawerFallbackNodes) {
      let node = object;

      while (node) {
        if (node === item.obj) return item;
        if (node === this.model) break;
        node = node.parent;
      }
    }

    return null;
  }

  toggleDrawerFallback(item) {
    if (!item) return;
    const target = item.value >= 0.5 ? 0 : 1;
    this.tweenDrawerFallback(item, target);
  }

  tweenDrawerFallback(item, targetValue) {
    const from = THREE.MathUtils.clamp(item.value, 0, 1);
    const to = THREE.MathUtils.clamp(targetValue, 0, 1);
    const token = ++item.tweenToken;
    const start = performance.now();
    const duration = 380 * Math.max(Math.abs(to - from), 0.3);

    const ease = (t) =>
      t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (now) => {
      if (item.tweenToken !== token) return;

      const p = THREE.MathUtils.clamp((now - start) / duration, 0, 1);
      const value = THREE.MathUtils.lerp(from, to, ease(p));

      item.value = value;
      item.obj.position.copy(item.originalPosition);
      item.obj.position[item.axis] += item.sign * item.distance * value;

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        this.syncDrawerFallbackSlider();
      }
    };

    requestAnimationFrame(step);
  }

  syncDrawerFallbackSlider() {
    const range = this.root.querySelector('[data-motion="drawers"]');
    if (!range || !this.drawerFallbackNodes.length) return;

    const average = this.drawerFallbackNodes.reduce(
      (sum, item) => sum + item.value,
      0
    ) / this.drawerFallbackNodes.length;

    range.value = String(Math.round(average * 100));
  }

  getDoorClips() {
    return [
      ...this.clipGroups.hingedDoors,
      ...this.clipGroups.slidingDoors,
      ...this.clipGroups.genericDoors
    ];
  }

  setClipItems(items, value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);

    items.forEach((item) => {
      item.action.enabled = true;
      item.action.paused = true;
      item.action.time = item.clip.duration * t;
      item.isOpen = t >= 0.5;
      item.tweenToken += 1;
    });

    if (items.length && this.mixer) {
      this.mixer.update(0);
    }
  }

  setMotion(type, value) {
    if (type === "doors") {
      this.setClipItems(this.getDoorClips(), value);
      return;
    }

    this.setClipItems(
      this.clipGroups[type] || [],
      value
    );

    if (type === "drawers") {
      this.setDrawerFallback(value);
    }
  }

  setAllMotion(value) {
    this.setClipItems(this.getDoorClips(), value);
    this.setClipItems(this.clipGroups.drawers, value);
    this.setDrawerFallback(value);

    this.root.querySelectorAll(".viewer-range").forEach((range) => {
      range.value = String(Math.round(value * 100));
    });
  }

  /* ------------------------------------------------
     TOUCH / CLICK / FOCUS ZOOM
  ------------------------------------------------ */

  bindPointerInteraction() {
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;

      this.pointerDown = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now()
      };
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.pointerDown) return;

      const dx = event.clientX - this.pointerDown.x;
      const dy = event.clientY - this.pointerDown.y;
      const distance = Math.hypot(dx, dy);
      const elapsed = performance.now() - this.pointerDown.time;

      this.pointerDown = null;

      // A drag belongs to OrbitControls, not interaction.
      if (distance > 9 || elapsed > 650) return;

      const hit = this.findHitAtPointer(event.clientX, event.clientY);
      if (!hit) return;

      const now = performance.now();
      const previousTap = this.lastTap;

      const isDoubleTap =
        previousTap &&
        now - previousTap.time < 340 &&
        Math.hypot(
          event.clientX - previousTap.x,
          event.clientY - previousTap.y
        ) < 28;

      this.lastTap = {
        time: now,
        x: event.clientX,
        y: event.clientY
      };

      this.controls.autoRotate = false;

      if (isDoubleTap) {
        this.focusObject(hit.object);
        this.lastTap = null;
        return;
      }

      const item = this.findClipForObject(hit.object);

      if (item) {
        this.toggleClip(item);
        return;
      }

      const drawerFallback = this.findDrawerFallbackForObject(hit.object);

      if (drawerFallback) {
        this.toggleDrawerFallback(drawerFallback);
      }
    });
  }

  findHitAtPointer(clientX, clientY) {
    if (!this.model) return null;

    const rect = this.canvas.getBoundingClientRect();

    this.pointer.x =
      ((clientX - rect.left) / rect.width) * 2 - 1;

    this.pointer.y =
      -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera
    );

    const hits = this.raycaster.intersectObject(
      this.model,
      true
    );

    return hits[0] || null;
  }

  findClipForObject(object) {
    const ancestors = new Set();
    let cursor = object;

    while (cursor) {
      if (cursor.name) ancestors.add(cursor.name);
      if (cursor === this.model) break;
      cursor = cursor.parent;
    }

    for (const item of this.allClipItems) {
      if (
        item.targetNames.some((name) =>
          ancestors.has(name)
        )
      ) {
        return item;
      }
    }

    for (const item of this.allClipItems) {
      for (const targetName of item.targetNames) {
        const target = this.model.getObjectByName(targetName);
        if (!target) continue;

        let node = object;

        while (node) {
          if (node === target) return item;
          if (node === this.model) break;
          node = node.parent;
        }
      }
    }

    return null;
  }

  toggleClip(item) {
    const target = item.isOpen ? 0 : 1;
    this.tweenClip(item, target);
  }

  tweenClip(item, targetValue) {
    const duration = Math.max(item.clip.duration, 0.001);

    const from = THREE.MathUtils.clamp(
      item.action.time / duration,
      0,
      1
    );

    const to = THREE.MathUtils.clamp(
      targetValue,
      0,
      1
    );

    const token = ++item.tweenToken;
    const start = performance.now();

    const tweenDuration = 420 * Math.max(
      Math.abs(to - from),
      0.28
    );

    const ease = (t) =>
      t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (now) => {
      if (item.tweenToken !== token) return;

      const p = THREE.MathUtils.clamp(
        (now - start) / tweenDuration,
        0,
        1
      );

      const value = THREE.MathUtils.lerp(
        from,
        to,
        ease(p)
      );

      item.action.enabled = true;
      item.action.paused = true;
      item.action.time = duration * value;

      if (this.mixer) this.mixer.update(0);

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        item.isOpen = to >= 0.5;
        this.syncGroupSlider(item);
      }
    };

    requestAnimationFrame(step);
  }

  focusObject(object) {
    if (!object || !this.model) return;

    let target = object;
    let box = new THREE.Box3().setFromObject(target);
    let sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    // Climb until the target is large enough to make a useful framing.
    while (
      target.parent &&
      target.parent !== this.model &&
      sphere.radius < this.modelRadius * 0.075
    ) {
      target = target.parent;
      box = new THREE.Box3().setFromObject(target);
      box.getBoundingSphere(sphere);
    }

    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return;

    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();

    const cameraDirection = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();

    const desiredDistance = THREE.MathUtils.clamp(
      sphere.radius /
        Math.sin(
          THREE.MathUtils.degToRad(
            this.camera.fov * 0.5
          )
        ) *
        1.55,
      this.controls.minDistance,
      this.modelRadius * 4
    );

    const toTarget = sphere.center.clone();

    const toPosition = toTarget
      .clone()
      .addScaledVector(
        cameraDirection,
        desiredDistance
      );

    this.tweenCamera(
      fromPosition,
      toPosition,
      fromTarget,
      toTarget
    );
  }

  tweenCamera(fromPosition, toPosition, fromTarget, toTarget) {
    const start = performance.now();
    const duration = 520;

    const ease = (t) =>
      1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const p = THREE.MathUtils.clamp(
        (now - start) / duration,
        0,
        1
      );

      const e = ease(p);

      this.camera.position.lerpVectors(
        fromPosition,
        toPosition,
        e
      );

      this.controls.target.lerpVectors(
        fromTarget,
        toTarget,
        e
      );

      this.controls.update();

      if (p < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  syncGroupSlider(item) {
    let motion = null;

    if (this.clipGroups.drawers.includes(item)) {
      motion = "drawers";
    } else if (this.clipGroups.slidingDoors.includes(item)) {
      motion = "slidingDoors";
    } else if (this.clipGroups.hingedDoors.includes(item)) {
      motion = "hingedDoors";
    } else if (this.clipGroups.genericDoors.includes(item)) {
      motion = "doors";
    }

    if (!motion) return;

    const range = this.root.querySelector(
      `[data-motion="${motion}"]`
    );

    if (!range) return;

    const group = motion === "doors"
      ? this.getDoorClips()
      : this.clipGroups[motion];

    if (!group.length) return;

    const average =
      group.reduce((sum, clipItem) => {
        const duration = Math.max(
          clipItem.clip.duration,
          0.001
        );

        return sum + clipItem.action.time / duration;
      }, 0) / group.length;

    range.value = String(
      Math.round(average * 100)
    );
  }

  updateMotionUIAvailability() {
    const availability = {
      doors: this.getDoorClips().length > 0,
      slidingDoors: this.clipGroups.slidingDoors.length > 0,
      hingedDoors: this.clipGroups.hingedDoors.length > 0,
      drawers:
        this.clipGroups.drawers.length > 0 ||
        this.drawerFallbackNodes.length > 0
    };

    Object.entries(availability).forEach(([motion, available]) => {
      const input = this.root.querySelector(
        `[data-motion="${motion}"]`
      );

      if (!input) return;

      const group = input.closest(".viewer-control-group");

      input.disabled = !available;
      group?.classList.toggle(
        "is-unavailable",
        !available
      );
    });

    const anyMotion = Object.values(
      availability
    ).some(Boolean);

    this.root
      .querySelector(".viewer-action-row")
      ?.classList.toggle(
        "is-unavailable",
        !anyMotion
      );
  }

  /* ------------------------------------------------
     CAMERA / SCENE
  ------------------------------------------------ */

  addGround() {
    const radius = Math.max(
      this.modelSize.x,
      this.modelSize.z,
      this.modelSize.y
    ) * 1.9;

    const geometry = new THREE.PlaneGeometry(
      radius * 2,
      radius * 2
    );

    const material = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.16,
      transparent: true
    });

    const ground = new THREE.Mesh(
      geometry,
      material
    );

    ground.rotation.x = -Math.PI / 2;
    ground.position.set(
      this.modelCenter.x,
      this.modelBox.min.y -
        Math.max(
          this.modelSize.y * 0.003,
          0.001
        ),
      this.modelCenter.z
    );

    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  frameModel() {
    const sphere = new THREE.Sphere();
    this.modelBox.getBoundingSphere(sphere);

    const radius = Math.max(
      sphere.radius,
      0.01
    );

    const direction = this.config.cameraDirection
      .clone()
      .normalize();

    const distance =
      radius /
      Math.sin(
        THREE.MathUtils.degToRad(
          this.camera.fov * 0.5
        )
      ) *
      1.12;

    this.camera.position
      .copy(sphere.center)
      .addScaledVector(
        direction,
        distance
      );

    this.camera.near = Math.max(
      radius / 120,
      0.005
    );

    this.camera.far = radius * 80;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(
      sphere.center
    );

    this.controls.minDistance =
      radius * 0.45;

    this.controls.maxDistance =
      radius * 6;

    this.cameraHome = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone()
    };

    this.controls.update();
  }

  resetCamera() {
    if (!this.cameraHome) return;

    const fromPosition = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();

    this.controls.autoRotate = true;

    this.tweenCamera(
      fromPosition,
      this.cameraHome.position.clone(),
      fromTarget,
      this.cameraHome.target.clone()
    );
  }

  /* ------------------------------------------------
     UI
  ------------------------------------------------ */

  bindUI() {
    this.root.querySelectorAll("[data-finish]").forEach((button) => {
      button.addEventListener("click", async () => {
        const finish = button.dataset.finish;

        this.root.querySelectorAll("[data-finish]").forEach((b) => {
          const active = b === button;

          b.classList.toggle(
            "is-active",
            active
          );

          b.setAttribute(
            "aria-pressed",
            active ? "true" : "false"
          );
        });

        if (this.id === "tonstad") {
          await this.applyTonstadFinish(
            finish
          );
        }

        if (this.id === "hauga") {
          this.applyHaugaFinish(
            finish
          );
        }
      });
    });

    this.root.querySelectorAll(".viewer-range").forEach((range) => {
      range.addEventListener("input", () => {
        this.controls.autoRotate = false;

        this.setMotion(
          range.dataset.motion,
          Number(range.value) / 100
        );
      });
    });

    this.root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;

        this.controls.autoRotate = false;

        if (action === "open-all") {
          this.setAllMotion(1);
        }

        if (action === "close-all") {
          this.setAllMotion(0);
        }

        if (action === "reset-camera") {
          this.resetCamera();
        }
      });
    });

    this.controls.addEventListener("start", () => {
      this.controls.autoRotate = false;
    });
  }

  setLoading(text) {
    const textEl = this.loadingEl.querySelector(
      "span:last-child"
    );

    if (textEl) textEl.textContent = text;
  }

  resize() {
    const rect =
      this.stage.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    const width = Math.round(
      rect.width * pixelRatio
    );

    const height = Math.round(
      rect.height * pixelRatio
    );

    if (
      this.canvas.width !== width ||
      this.canvas.height !== height
    ) {
      this.renderer.setPixelRatio(
        pixelRatio
      );

      this.renderer.setSize(
        rect.width,
        rect.height,
        false
      );

      this.camera.aspect =
        rect.width / rect.height;

      this.camera.updateProjectionMatrix();
    }
  }

  animate = () => {
    requestAnimationFrame(
      this.animate
    );

    this.controls.update();

    this.renderer.render(
      this.scene,
      this.camera
    );
  };

  /* ------------------------------------------------
     DEBUG
  ------------------------------------------------ */

  renderDebugPanel(gltf) {
    const details = document.createElement(
      "details"
    );

    details.className = "viewer-debug";

    const groupText = Object.entries(
      this.clipGroups
    )
      .map(([group, items]) => {
        const names = items.map((item) => {
          const targets =
            item.targetNames.length
              ? ` → ${item.targetNames.join(", ")}`
              : "";

          const props = [...item.properties].join(", ");

          return `${
            item.clip.name || "(unnamed)"
          }${targets}${props ? ` [${props}]` : ""}`;
        });

        return `${group}\n${
          names.length
            ? names.join("\n")
            : "none"
        }`;
      })
      .join("\n\n");

    details.innerHTML = `
      <summary>Viewer debug / ${escapeHtml(this.product)}</summary>
      <div class="viewer-debug-grid">
        <div>
          <strong>Embedded animations</strong>
          <pre>${escapeHtml(
            (gltf.animations || [])
              .map(
                (clip) =>
                  clip.name || "(unnamed)"
              )
              .join("\n") || "none"
          )}</pre>
        </div>

        <div>
          <strong>Classification</strong>
          <pre>${escapeHtml(
            groupText
          )}</pre>
        </div>

        <div>
          <strong>Named drawer fallbacks</strong>
          <pre>${escapeHtml(
            this.drawerFallbackNodes.length
              ? this.drawerFallbackNodes
                  .map((item) => `${item.obj.name} → ${item.axis.toUpperCase()} ${item.distance.toFixed(3)} m`)
                  .join("\n")
              : "none"
          )}</pre>
        </div>
      </div>
    `;

    this.root.appendChild(details);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

document
  .querySelectorAll(".js-product-viewer")
  .forEach((root) => {
    new ProductViewer(root);
  });
