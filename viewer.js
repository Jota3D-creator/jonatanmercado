import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const PRODUCT_CONFIG = {
  tonstad: {
    type: "tonstad",
    cameraDirection: new THREE.Vector3(1.25, 0.85, 1.65),
    doorAngle: 100,
    doorAxis: "y",
    drawerAxis: "z",
    drawerDirection: 1,
    drawerDistanceFactor: 0.72,
    slidingDoorAxis: "x",
    slidingDoorDistanceFactor: 0.75,
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
    type: "hauga",
    cameraDirection: new THREE.Vector3(1.35, 0.82, 1.75),

    // Exact structure inspected from Almacenamiento_Hauga.glb.
    // The four doors are already authored as glTF animations:
    // door_Puerta 1Action / door_Puerta 2Action = hinged ±90°
    // door_Puerta 1Action.002 / .003 = sliding ±0.50 m on X.
    exactDrawerNodes: {
      "anim_Cajon 1": { axis: "z", distance: 0.34 },
      "anim_Cajon 2": { axis: "z", distance: 0.34 },
      "anim_Cajon 3": { axis: "z", distance: 0.34 }
    },

    tintFinishes: {
      original: new THREE.Color(0xffffff),
      light: new THREE.Color(0xe9e2d6),
      dark: new THREE.Color(0x5e554c)
    }
  }
};

const NAME_PATTERNS = {
  glass: /(glass|vidrio|window|ventana|crystal|cristal)/i,
  metal: /(metal|handle|manija|tirador|hinge|bisagra|screw|tornillo|hardware)/i,
  wood: /(wood|madera|timber|oak|roble|body|cabinet|carcass|frame)/i,
  door: /(door|puerta|hinged|hinge_door|front_door)/i,
  slidingDoor: /(sliding|slide|corredera|slidedoor|sliding_door)/i,
  drawer: /(drawer|cajon|cajón|gaveta)/i
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
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.sortObjects = true;
    this.renderer.setClearColor(0x000000, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.84;

    this.clock = new THREE.Clock();
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    this.model = null;
    this.mixer = null;
    this.clipGroups = { doors: [], drawers: [], other: [] };
    this.motionNodes = { doors: [], drawers: [], slidingDoors: [] };
    this.animatedNodeNames = new Set();
    this.materialUsage = new Map();
    this.materialOriginals = new Map();
    this.primaryWoodMaterials = [];
    this.variantTextures = new Map();
    this.ground = null;

    this.modelBox = new THREE.Box3();
    this.modelSize = new THREE.Vector3();
    this.modelCenter = new THREE.Vector3();
    this.cameraHome = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);

    this.bindUI();
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

    const hemi = new THREE.HemisphereLight(0xf4f0e8, 0x474b52, 0.7);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff2df, 3.4);
    key.position.set(3.5, 6.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0002;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdce8ff, 1.35);
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
          // Three r180 uses uv1 for AO map's second UV channel when present.
          // If there is no separate UV set, reuse UV0.
          obj.geometry.setAttribute("uv1", obj.geometry.attributes.uv.clone());
        }

        const sourceMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
        const patchedMaterials = sourceMaterials.map((sourceMat) => {
          if (!sourceMat) return sourceMat;

          const mat = this.isGlassMaterial(sourceMat, obj.name)
            ? this.makeStableGlassMaterial(sourceMat)
            : sourceMat;

          const count = obj.geometry?.index?.count || obj.geometry?.attributes?.position?.count || 1;
          this.materialUsage.set(mat, (this.materialUsage.get(mat) || 0) + count);

          if (!this.materialOriginals.has(mat)) {
            this.materialOriginals.set(mat, {
              color: mat.color?.clone?.() || new THREE.Color(0xffffff),
              roughness: mat.roughness,
              metalness: mat.metalness,
              opacity: mat.opacity
            });
          }

          this.patchTextureColorSpaces(mat);
          return mat;
        });

        obj.material = Array.isArray(obj.material) ? patchedMaterials : patchedMaterials[0];
      });

      this.modelBox.setFromObject(this.model);
      this.modelBox.getSize(this.modelSize);
      this.modelBox.getCenter(this.modelCenter);

      this.findPrimaryWoodMaterials();
      this.detectMotion(gltf.animations || []);
      this.addGround();
      this.frameModel();
      this.controls.update();

      if (this.id === "tonstad") {
        await this.prepareTonstadVariants();
        await this.applyTonstadFinish("wood");
      }

      this.setLoading("");
      this.loadingEl.classList.add("is-hidden");
      this.updateMotionUIAvailability();

      if (DEBUG) this.renderDebugPanel(gltf);
    } catch (error) {
      console.error(`[${this.product}] viewer failed`, error);
      this.setLoading("Could not load model");
      this.loadingEl.classList.add("is-error");
    }
  }

  patchTextureColorSpaces(mat) {
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;

    [mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.alphaMap]
      .filter(Boolean)
      .forEach((tex) => {
        tex.colorSpace = THREE.NoColorSpace;
      });
  }

  isGlassMaterial(mat, objectName = "") {
    return NAME_PATTERNS.glass.test(`${mat?.name || ""} ${objectName || ""}`);
  }

  makeStableGlassMaterial(sourceMat) {
    // HAUGA's GLASS_HAUGA is exported as BLEND with baseColorFactor alpha ≈ 0.268
    // AND it reuses an RGBA atlas whose alpha contains 0 / 10 / 255 values.
    // Multiplying both alpha sources makes parts of the panes almost disappear.
    //
    // Replace it at runtime with transmission-based glass. This avoids the
    // depth-sorting artifacts of alpha blending and intentionally ignores the
    // atlas alpha channel for the window panes.
    const glass = new THREE.MeshPhysicalMaterial({
      name: `${sourceMat.name || "GLASS"}__viewer`,
      color: new THREE.Color(0xe5eaec),
      metalness: 0,
      roughness: 0.16,
      transmission: 0.90,
      thickness: 0.012,
      ior: 1.45,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      envMapIntensity: 1
    });

    // Keep the original packed roughness texture if available, but never reuse
    // the RGBA BaseColor atlas because its alpha is the source of the window issue.
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
        return !NAME_PATTERNS.glass.test(name) && !NAME_PATTERNS.metal.test(name);
      })
      .sort((a, b) => b[1] - a[1]);

    const namedWood = entries.filter(([mat]) => NAME_PATTERNS.wood.test(mat.name || ""));

    // If Blender material names are generic, fall back to the dominant non-glass material.
    this.primaryWoodMaterials = namedWood.length ? namedWood.map(([mat]) => mat) : entries.slice(0, 1).map(([mat]) => mat);
  }

  async prepareTonstadVariants() {
    const loadSet = async (finish, urls) => {
      const [baseColor, normal, roughness, ao] = await Promise.all([
        this.loadExternalTexture(urls.baseColor, true),
        this.loadExternalTexture(urls.normal, false),
        this.loadExternalTexture(urls.roughness, false),
        this.loadExternalTexture(urls.ao, false)
      ]);

      this.variantTextures.set(finish, { baseColor, normal, roughness, ao });
    };

    await Promise.all(
      Object.entries(this.config.textures).map(([finish, urls]) => loadSet(finish, urls))
    );
  }

  async loadExternalTexture(url, isColor) {
    const texture = await this.textureLoader.loadAsync(url);
    texture.flipY = false;
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
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

  applyHaugaFinish(finish) {
    const tint = this.config.tintFinishes?.[finish];
    if (!tint || !this.primaryWoodMaterials.length) return;

    this.primaryWoodMaterials.forEach((mat) => {
      if (!mat.color) return;
      mat.color.copy(tint);
      mat.needsUpdate = true;
    });
  }

  detectMotion(clips) {
    // Record every node already driven by an authored animation so we do not
    // apply a second manual transform on top of it.
    clips.forEach((clip) => {
      clip.tracks.forEach((track) => {
        const nodeName = track.name.split(".")[0];
        if (nodeName) this.animatedNodeNames.add(nodeName);
      });
    });

    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.model);

      clips.forEach((clip) => {
        const action = this.mixer.clipAction(clip);
        action.play();
        action.paused = true;
        action.clampWhenFinished = true;
        action.setLoop(THREE.LoopOnce, 1);
        action.time = 0;

        const item = { clip, action };

        if (NAME_PATTERNS.drawer.test(clip.name)) this.clipGroups.drawers.push(item);
        else if (NAME_PATTERNS.door.test(clip.name) || NAME_PATTERNS.slidingDoor.test(clip.name)) this.clipGroups.doors.push(item);
        else this.clipGroups.other.push(item);
      });

      // If the file contains one or two generic actions, they are often the authored
      // open/close interactions. Keep them usable rather than hiding the controls.
      if (!this.clipGroups.doors.length && !this.clipGroups.drawers.length && this.clipGroups.other.length) {
        if (this.clipGroups.other.length === 1) {
          this.clipGroups.doors = [...this.clipGroups.other];
        } else {
          this.clipGroups.doors = [this.clipGroups.other[0]];
          this.clipGroups.drawers = this.clipGroups.other.slice(1);
        }
      }
    }

    const candidates = [];
    this.model.traverse((obj) => {
      const name = obj.name || "";
      if (!name) return;

      // Exact HAUGA drawer nodes are not animated in the source GLB.
      // Door nodes are, and must be left to their authored clips.
      if (this.animatedNodeNames.has(name)) return;

      if (NAME_PATTERNS.drawer.test(name)) candidates.push({ obj, type: "drawers" });
      else if (NAME_PATTERNS.slidingDoor.test(name)) candidates.push({ obj, type: "slidingDoors" });
      else if (NAME_PATTERNS.door.test(name)) candidates.push({ obj, type: "doors" });
    });

    // Avoid animating both a named parent and all its named children.
    const candidateObjects = new Set(candidates.map((item) => item.obj));

    candidates.forEach(({ obj, type }) => {
      let parent = obj.parent;
      while (parent && parent !== this.model) {
        if (candidateObjects.has(parent)) return;
        parent = parent.parent;
      }

      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const record = {
        obj,
        type,
        originalPosition: obj.position.clone(),
        originalQuaternion: obj.quaternion.clone(),
        size,
        center,
        sign: this.motionSignFor(obj, center)
      };

      this.motionNodes[type].push(record);
    });
  }

  motionSignFor(obj, center) {
    const name = (obj.name || "").toLowerCase();

    if (/(left|izq|lhs|_l\b|\.l\b)/i.test(name)) return 1;
    if (/(right|der|rhs|_r\b|\.r\b)/i.test(name)) return -1;

    return center.x < this.modelCenter.x ? 1 : -1;
  }

  setMotion(type, value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);

    const clips = this.clipGroups[type] || [];
    clips.forEach(({ clip, action }) => {
      action.paused = true;
      action.enabled = true;
      action.time = clip.duration * t;
    });
    if (clips.length && this.mixer) this.mixer.update(0);

    if (type === "doors") {
      this.motionNodes.doors.forEach((item) => {
        item.obj.position.copy(item.originalPosition);
        item.obj.quaternion.copy(item.originalQuaternion);

        const axis = new THREE.Vector3();
        axis[this.config.doorAxis || "y"] = 1;

        const angle = THREE.MathUtils.degToRad(this.config.doorAngle || 100) * item.sign * t;
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        item.obj.quaternion.multiply(q);
      });

      this.motionNodes.slidingDoors.forEach((item) => {
        item.obj.position.copy(item.originalPosition);
        item.obj.quaternion.copy(item.originalQuaternion);

        const axisName = this.config.slidingDoorAxis || "x";
        const distance = (item.size[axisName] || this.modelSize[axisName] * 0.2)
          * (this.config.slidingDoorDistanceFactor || 0.72)
          * item.sign
          * t;

        item.obj.position[axisName] += distance;
      });
    }

    if (type === "drawers") {
      this.motionNodes.drawers.forEach((item) => {
        item.obj.position.copy(item.originalPosition);
        item.obj.quaternion.copy(item.originalQuaternion);

        const exact = this.config.exactDrawerNodes?.[item.obj.name];

        if (exact) {
          const axisName = exact.axis || "z";
          item.obj.position[axisName] += exact.distance * t;
          return;
        }

        const axisName = this.config.drawerAxis || "z";
        const basis = item.size[axisName] || this.modelSize[axisName] * 0.18;
        const distance = basis
          * (this.config.drawerDistanceFactor || 0.7)
          * (this.config.drawerDirection || 1)
          * t;

        item.obj.position[axisName] += distance;
      });
    }
  }

  setAllMotion(value) {
    this.setMotion("doors", value);
    this.setMotion("drawers", value);

    this.root.querySelectorAll(".viewer-range").forEach((range) => {
      range.value = String(Math.round(value * 100));
    });
  }

  addGround() {
    const radius = Math.max(this.modelSize.x, this.modelSize.z, this.modelSize.y) * 1.9;
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const material = new THREE.ShadowMaterial({
      color: 0x000000,
      opacity: 0.18,
      transparent: true
    });

    this.ground = new THREE.Mesh(geometry, material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(
      this.modelCenter.x,
      this.modelBox.min.y - Math.max(this.modelSize.y * 0.003, 0.001),
      this.modelCenter.z
    );
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  frameModel() {
    const sphere = new THREE.Sphere();
    this.modelBox.getBoundingSphere(sphere);

    const radius = Math.max(sphere.radius, 0.01);
    const direction = this.config.cameraDirection.clone().normalize();
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * 1.15;

    this.camera.position.copy(sphere.center).addScaledVector(direction, distance);
    this.camera.near = Math.max(radius / 120, 0.005);
    this.camera.far = radius * 80;
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(sphere.center);
    this.controls.minDistance = radius * 0.65;
    this.controls.maxDistance = radius * 6;

    this.cameraHome = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone()
    };
  }

  resetCamera() {
    if (!this.cameraHome) return;
    this.camera.position.copy(this.cameraHome.position);
    this.controls.target.copy(this.cameraHome.target);
    this.controls.autoRotate = true;
    this.controls.update();
  }

  bindUI() {
    this.root.querySelectorAll("[data-finish]").forEach((button) => {
      button.addEventListener("click", async () => {
        const finish = button.dataset.finish;

        this.root.querySelectorAll("[data-finish]").forEach((b) => {
          const active = b === button;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });

        if (this.id === "tonstad") await this.applyTonstadFinish(finish);
        else this.applyHaugaFinish(finish);
      });
    });

    this.root.querySelectorAll(".viewer-range").forEach((range) => {
      range.addEventListener("input", () => {
        this.controls.autoRotate = false;
        this.setMotion(range.dataset.motion, Number(range.value) / 100);
      });
    });

    this.root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        this.controls.autoRotate = false;

        if (action === "open-all") this.setAllMotion(1);
        if (action === "close-all") this.setAllMotion(0);
        if (action === "reset-camera") this.resetCamera();
      });
    });

    this.controls.addEventListener("start", () => {
      this.controls.autoRotate = false;
    });
  }

  updateMotionUIAvailability() {
    const doorsAvailable =
      this.clipGroups.doors.length > 0 ||
      this.motionNodes.doors.length > 0 ||
      this.motionNodes.slidingDoors.length > 0;

    const drawersAvailable =
      this.clipGroups.drawers.length > 0 ||
      this.motionNodes.drawers.length > 0;

    const doors = this.root.querySelector('[data-motion="doors"]');
    const drawers = this.root.querySelector('[data-motion="drawers"]');

    if (doors) {
      doors.disabled = !doorsAvailable;
      doors.closest(".viewer-control-group")?.classList.toggle("is-disabled", !doorsAvailable);
    }

    if (drawers) {
      drawers.disabled = !drawersAvailable;
      drawers.closest(".viewer-control-group")?.classList.toggle("is-disabled", !drawersAvailable);
    }

    if (!doorsAvailable && !drawersAvailable) {
      this.root.classList.add("viewer-needs-motion-map");
    }
  }

  setLoading(text) {
    const textEl = this.loadingEl.querySelector("span:last-child");
    if (textEl) textEl.textContent = text;
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * pixelRatio);
    const height = Math.round(rect.height * pixelRatio);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(rect.width, rect.height, false);
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
    }
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.mixer) this.mixer.update(0);

    this.controls.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  renderDebugPanel(gltf) {
    const materials = [];
    const nodes = [];

    this.model.traverse((obj) => {
      if (obj.name) nodes.push(`${obj.type}: ${obj.name}`);

      if (obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.filter(Boolean).forEach((mat) => {
          materials.push(`${obj.name || "(mesh)"} → ${mat.name || "(unnamed material)"}`);
        });
      }
    });

    const details = document.createElement("details");
    details.className = "viewer-debug";
    details.innerHTML = `
      <summary>Viewer debug / ${this.product}</summary>
      <div class="viewer-debug-grid">
        <div><strong>Animations</strong><pre>${escapeHtml((gltf.animations || []).map(c => c.name || "(unnamed)").join("\n") || "none")}</pre></div>
        <div><strong>Detected motion</strong><pre>${escapeHtml(JSON.stringify({
          doorNodes: this.motionNodes.doors.map(i => i.obj.name),
          slidingDoorNodes: this.motionNodes.slidingDoors.map(i => i.obj.name),
          drawerNodes: this.motionNodes.drawers.map(i => i.obj.name)
        }, null, 2))}</pre></div>
        <div><strong>Materials</strong><pre>${escapeHtml([...new Set(materials)].join("\n"))}</pre></div>
        <div><strong>Nodes</strong><pre>${escapeHtml(nodes.join("\n"))}</pre></div>
      </div>
    `;

    this.root.appendChild(details);

    console.group(`[Viewer debug] ${this.product}`);
    console.log("animations", (gltf.animations || []).map((clip) => clip.name));
    console.log("doors", this.motionNodes.doors.map((item) => item.obj.name));
    console.log("sliding doors", this.motionNodes.slidingDoors.map((item) => item.obj.name));
    console.log("drawers", this.motionNodes.drawers.map((item) => item.obj.name));
    console.log("wood materials", this.primaryWoodMaterials.map((mat) => mat.name));
    console.groupEnd();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

document.querySelectorAll(".js-product-viewer").forEach((root) => {
  new ProductViewer(root);
});
