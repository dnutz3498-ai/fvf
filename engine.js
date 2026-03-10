// engine.js — Renderer, WeaponSystem, PlayerController, BotAI, MapBuilder
// UPGRADED: Fixed gun damage, melee weapons, smart bots, parkour-ready maps

// ─────────────────────────────────────────────
// RENDERER
// ─────────────────────────────────────────────
class Renderer {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // disabled by default, enabled by setQuality
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // cheapest shadow type
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 600);
    this.scene.add(this.camera);
    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }
  clearScene() {
    const kids = [...this.scene.children];
    kids.forEach(c => {
      if (c === this.camera) return;
      if (c._isPooled) return; // never dispose pooled meshes
      this.scene.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
    });
    this.scene.fog = null; this.scene.background = null;
    // Clear cached textures and shop rings between maps
    if (MapBuilder._texCache) { Object.values(MapBuilder._texCache).forEach(t => t.dispose()); MapBuilder._texCache = {}; }
    MapBuilder._shopRings = [];
    // Reset spark pool entries to dead (don't null the pool — meshes are still in scene)
    if (BotAI._sparkPool) { for (const s of BotAI._sparkPool) { s.alive = false; s.mesh.visible = false; } }
  }
  setQuality(q) {
    if (q === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
  }
  render() { this.renderer.render(this.scene, this.camera); }
}

// ─────────────────────────────────────────────
// WEAPON SYSTEM — supports gun + melee + special
// ─────────────────────────────────────────────
class WeaponSystem {
  constructor(scene) {
    this.scene = scene;
    this.ammo = 30; this.reserve = 90;
    this.isReloading = false; this.reloadTimer = 0;
    this.lastShotTime = 0; this.recoilY = 0; this.recoilX = 0;
    this.stats = null; this.weaponId = null;
    this.flashes = []; this.viewMesh = null;
    // Minigun spin-up state
    this._spinUpTimer = 0; this._spinReady = false;
    // Burst state
    this._burstQueue = 0; this._burstTimer = 0;
  }

  equip(id) {
    const s = WEAPON_STATS[id] || WEAPON_STATS.assaultRifle;
    this.stats = s; this.weaponId = id;
    this.ammo = s.type === 'melee' ? 999 : s.magSize;
    this.reserve = 9999; // infinite reserve
    this.isReloading = false; this.recoilY = 0; this.recoilX = 0;
    this._spinUpTimer = 0; this._spinReady = false;
    this._burstQueue = 0; this._burstTimer = 0;
    this.viewMesh = this._buildViewmodel(id, s);
    return s;
  }

  isMelee() { return this.stats?.type === 'melee'; }

  _mat(col, emCol, ei = 0.3) {
    return new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.15,
      emissive: new THREE.Color(emCol || 0), emissiveIntensity: emCol ? ei : 0 });
  }

  _buildViewmodel(id, s) {
    const g = new THREE.Group();
    const bm = this._mat(s.color, 0);
    const am = this._mat(s.accentColor, s.accentColor, 0.45);
    const gl = (col, intensity, dist) => { const l = new THREE.PointLight(col, intensity, dist); return l; };

    // ── MELEE ─────────────────────────────────────────────────────────────────
    if (s.type === 'melee') {
      if (id === 'katana') {
        g.add(this._m(new THREE.BoxGeometry(0.018, 0.008, 0.82), am, 0, 0, 0.22));
        g.add(this._m(new THREE.BoxGeometry(0.015, 0.006, 0.34), bm, 0, 0, -0.17));
        g.add(this._m(new THREE.BoxGeometry(0.14, 0.018, 0.018), bm, 0, 0, 0.01));
        g.add(this._m(new THREE.BoxGeometry(0.008, 0.008, 0.04), bm, 0, 0, 0.63));
      } else if (id === 'spear') {
        g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.9, 6), bm, 0, 0, -0.1, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.0, 0.02, 0.28, 5), am, 0, 0, 0.47, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 6), am, 0, 0, 0.34, [Math.PI/2,0,0]));
      } else if (id === 'battleaxe') {
        g.add(this._m(new THREE.CylinderGeometry(0.018, 0.018, 0.65, 6), bm, 0, 0, 0, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.04, 0.22, 0.025), am, 0.12, 0.02, 0.28));
        g.add(this._m(new THREE.BoxGeometry(0.025, 0.08, 0.02), am, -0.06, 0.02, 0.28));
      } else if (id === 'warHammer') {
        g.add(this._m(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 6), bm, 0, 0, -0.08, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.14, 0.09, 0.07), am, 0, 0, 0.26));
        g.add(this._m(new THREE.BoxGeometry(0.025, 0.025, 0.055), bm, 0, 0, 0.01));
      } else if (id === 'scimitar') {
        g.add(this._m(new THREE.BoxGeometry(0.012, 0.18, 0.022), am, 0.06, 0.06, 0.28));
        g.add(this._m(new THREE.BoxGeometry(0.01, 0.12, 0.018), am, 0.02, -0.01, 0.12));
        g.add(this._m(new THREE.BoxGeometry(0.1, 0.016, 0.014), bm, 0, 0, 0.02));
        g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 6), bm, 0, 0, -0.14, [Math.PI/2,0,0]));
      } else if (id === 'twinDaggers') {
        g.add(this._m(new THREE.BoxGeometry(0.014, 0.01, 0.32), am, 0.06, 0, 0.1));
        g.add(this._m(new THREE.BoxGeometry(0.014, 0.01, 0.32), am, -0.06, 0, 0.1));
        g.add(this._m(new THREE.BoxGeometry(0.03, 0.016, 0.016), bm, 0.06, 0, -0.04));
        g.add(this._m(new THREE.BoxGeometry(0.03, 0.016, 0.016), bm, -0.06, 0, -0.04));
      } else if (id === 'halberd') {
        g.add(this._m(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), bm, 0, 0, 0.05, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.03, 0.18, 0.02), am, 0.05, 0.04, 0.56));
        g.add(this._m(new THREE.CylinderGeometry(0.0, 0.018, 0.2, 5), am, 0, 0.02, 0.66, [Math.PI/2,0,0]));
      } else if (id === 'triton') {
        g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.75, 6), bm, 0, 0, -0.02, [Math.PI/2,0,0]));
        for (let i = -1; i <= 1; i++) g.add(this._m(new THREE.CylinderGeometry(0.0, 0.012, 0.22, 4), am, i*0.045, 0, 0.47, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.022, 0.022, 0.025, 8), am, 0, 0, 0.36, [Math.PI/2,0,0]));
      } else if (id === 'gladiusSword') {
        g.add(this._m(new THREE.BoxGeometry(0.055, 0.012, 0.44), am, 0, 0, 0.16));
        g.add(this._m(new THREE.BoxGeometry(0.13, 0.018, 0.018), bm, 0, 0, -0.04));
        g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 6), bm, 0, 0, -0.18, [Math.PI/2,0,0]));
      } else if (id === 'flail') {
        g.add(this._m(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), bm, 0, 0, -0.15, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), bm, 0.04, 0.04, 0.08, [0.6,0.3,0]));
        g.add(this._m(new THREE.BoxGeometry(0.11, 0.11, 0.11), am, 0.1, 0.1, 0.22));
        for (let i=0;i<6;i++){const a=(i/6)*Math.PI*2;g.add(this._m(new THREE.CylinderGeometry(0.008,0.0,0.06,4),am,0.1+Math.cos(a)*0.055,0.1+Math.sin(a)*0.055,0.22,[Math.cos(a)*1.2,0,Math.sin(a)*1.2]));}
      } else if (id === 'naginata') {
        g.add(this._m(new THREE.CylinderGeometry(0.013, 0.013, 0.9, 6), bm, 0, 0, 0.0, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.01, 0.2, 0.016), am, 0.04, 0.06, 0.52));
        g.add(this._m(new THREE.BoxGeometry(0.008, 0.06, 0.012), am, 0.01, -0.02, 0.44));
      } else if (id === 'hammerfist') {
        g.add(this._m(new THREE.BoxGeometry(0.14, 0.18, 0.14), am, 0, 0, 0));
        for (let i=-1;i<=1;i++) g.add(this._m(new THREE.BoxGeometry(0.025,0.025,0.065),am,i*0.044,0.1,0.1));
        g.add(this._m(new THREE.BoxGeometry(0.06, 0.28, 0.06), bm, 0, 0, -0.2));
      } else if (id === 'combatKnife') {
        g.add(this._m(new THREE.BoxGeometry(0.02, 0.008, 0.3), am, 0, 0.01, 0.1));
        g.add(this._m(new THREE.BoxGeometry(0.065, 0.01, 0.012), bm, 0, 0, -0.04));
        g.add(this._m(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 6), bm, 0, 0, -0.15, [Math.PI/2,0,0]));
      } else if (id === 'tacticalBaton') {
        g.add(this._m(new THREE.CylinderGeometry(0.022, 0.016, 0.62, 8), bm, 0, 0, 0.05, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), am, 0, 0, 0.41, [Math.PI/2,0,0]));
        const bgl = gl(s.accentColor, 1.5, 0.8); bgl.position.set(0,0,0.5); g.add(bgl);
      } else if (id === 'chainsaw') {
        g.add(this._m(new THREE.BoxGeometry(0.065, 0.06, 0.52), bm, 0, 0, 0.06));
        g.add(this._m(new THREE.BoxGeometry(0.022, 0.005, 0.48), am, 0, 0.038, 0.06));
        g.add(this._m(new THREE.BoxGeometry(0.022, 0.005, 0.48), am, 0, -0.038, 0.06));
        for (let i=0;i<8;i++) g.add(this._m(new THREE.BoxGeometry(0.008,0.018,0.008),am,0,(i%2===0?1:-1)*0.044,-0.18+i*0.065));
        g.add(this._m(new THREE.BoxGeometry(0.06, 0.055, 0.15), am, 0, -0.008, -0.25));
      } else if (id === 'earthGauntlets') {
        g.add(this._m(new THREE.BoxGeometry(0.13, 0.12, 0.16), bm, 0, 0, 0.04));
        g.add(this._m(new THREE.BoxGeometry(0.13, 0.04, 0.04), am, 0, 0.08, -0.04));
        for (let i=-1;i<=1;i++) g.add(this._m(new THREE.BoxGeometry(0.025,0.03,0.05),am,i*0.04,0.08,0.12));
        g.add(this._m(new THREE.BoxGeometry(0.1, 0.08, 0.2), bm, 0, -0.005, -0.16));
      } else if (id === 'knuckledusters') {
        g.add(this._m(new THREE.BoxGeometry(0.12, 0.055, 0.04), am, 0, 0, 0.02));
        for (let i=-1;i<=1;i++) g.add(this._m(new THREE.BoxGeometry(0.026,0.026,0.05),am,i*0.038,0.025,0.045));
        g.add(this._m(new THREE.BoxGeometry(0.1, 0.08, 0.14), bm, 0, -0.005, -0.1));
      } else if (id === 'energyBlade') {
        g.add(this._m(new THREE.BoxGeometry(0.014, 0.014, 0.6), am, 0, 0, 0.18));
        g.add(this._m(new THREE.BoxGeometry(0.038, 0.038, 0.18), bm, 0, 0, -0.1));
        const egl = gl(s.accentColor, 2.5, 1.5); egl.position.set(0,0,0.45); g.add(egl);
      } else if (id === 'plasmaSword') {
        g.add(this._m(new THREE.BoxGeometry(0.028, 0.012, 0.58), am, 0, 0, 0.16));
        g.add(this._m(new THREE.BoxGeometry(0.1, 0.016, 0.016), bm, 0, 0, -0.02));
        g.add(this._m(new THREE.BoxGeometry(0.042, 0.04, 0.2), bm, 0, 0, -0.14));
        const pgl = gl(s.accentColor, 3, 1.8); pgl.position.set(0,0,0.42); g.add(pgl);
      } else if (id === 'nanoWhip') {
        g.add(this._m(new THREE.CylinderGeometry(0.022, 0.018, 0.22, 7), bm, 0, 0, -0.11, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.005, 0.002, 0.55, 5), am, 0.02, 0.02, 0.28, [0.15,0,0.1]));
        g.add(this._m(new THREE.BoxGeometry(0.03, 0.03, 0.03), am, 0.06, 0.07, 0.55));
        const wgl = gl(s.accentColor, 1.5, 0.9); wgl.position.set(0.05,0.06,0.54); g.add(wgl);
      } else if (id === 'gravFist') {
        g.add(this._m(new THREE.BoxGeometry(0.14, 0.13, 0.18), bm, 0, 0, 0.04));
        g.add(this._m(new THREE.BoxGeometry(0.16, 0.04, 0.04), am, 0, 0.09, -0.02));
        for (let i=-1;i<=1;i++) g.add(this._m(new THREE.BoxGeometry(0.028,0.038,0.06),am,i*0.045,0.085,0.12));
        const gfgl = gl(s.accentColor, 2, 1.2); gfgl.position.set(0,0,0.1); g.add(gfgl);
      } else if (id === 'phaseBlade') {
        g.add(this._m(new THREE.BoxGeometry(0.016, 0.016, 0.56), am, 0, 0, 0.14));
        g.add(this._m(new THREE.BoxGeometry(0.09, 0.014, 0.014), bm, 0, 0, -0.02));
        g.add(this._m(new THREE.BoxGeometry(0.04, 0.04, 0.18), bm, 0, 0, -0.13));
        const pbgl = gl(s.accentColor, 2, 1.4); pbgl.position.set(0,0,0.42); g.add(pbgl);
      } else if (id === 'voltLance') {
        g.add(this._m(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 7), bm, 0, 0, 0.03, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.CylinderGeometry(0.0, 0.022, 0.22, 5), am, 0, 0, 0.52, [Math.PI/2,0,0]));
        for (let i=0;i<3;i++) g.add(this._m(new THREE.BoxGeometry(0.005,0.005,0.12),am,Math.cos(i/3*Math.PI*2)*0.025,Math.sin(i/3*Math.PI*2)*0.025,0.38,[Math.PI/2,0,0]));
        const vlgl = gl(s.accentColor, 2.5, 1.6); vlgl.position.set(0,0,0.64); g.add(vlgl);
      } else if (id === 'atomicMace') {
        g.add(this._m(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 7), bm, 0, 0, -0.06, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.16, 0.16, 0.16), am, 0, 0, 0.28));
        for (let i=0;i<6;i++){const a=(i/6)*Math.PI*2;g.add(this._m(new THREE.CylinderGeometry(0.012,0.0,0.1,4),am,Math.cos(a)*0.08,Math.sin(a)*0.08,0.28,[Math.PI/2+Math.cos(a)*Math.PI/2,0,Math.sin(a)*Math.PI/2]));}
        const amgl = gl(s.accentColor, 3, 2); amgl.position.set(0,0,0.28); g.add(amgl);
      } else if (id === 'holyBlade') {
        g.add(this._m(new THREE.BoxGeometry(0.032, 0.012, 0.62), am, 0, 0, 0.16));
        g.add(this._m(new THREE.BoxGeometry(0.18, 0.014, 0.014), am, 0, 0, -0.02));
        g.add(this._m(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6), bm, 0, 0, -0.18, [Math.PI/2,0,0]));
        const hbgl = gl(s.accentColor, 3.5, 2.2); hbgl.position.set(0,0,0.45); g.add(hbgl);
      } else if (id === 'runeBlades') {
        g.add(this._m(new THREE.BoxGeometry(0.016, 0.01, 0.42), am, 0.07, 0, 0.08));
        g.add(this._m(new THREE.BoxGeometry(0.016, 0.01, 0.42), am, -0.07, 0.02, 0.08));
        for (let i=0;i<4;i++) g.add(this._m(new THREE.BoxGeometry(0.006,0.006,0.008),am,0.07,0.008,-0.06+i*0.09));
        const rbgl = gl(s.accentColor, 2, 1.4); rbgl.position.set(0,0,0.3); g.add(rbgl);
      } else if (id === 'soulReaper') {
        // Dark melee scythe
        g.add(this._m(new THREE.CylinderGeometry(0.015, 0.015, 0.68, 6), bm, 0, 0, -0.04, [Math.PI/2,0,0]));
        const sr0=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.26,0.018),am.clone()); sr0.position.set(0.08,0.08,0.34); sr0.rotation.z=-0.35; g.add(sr0);
        const sr1=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.18,0.015),am.clone()); sr1.position.set(0.18,0.2,0.36); sr1.rotation.z=-0.75; g.add(sr1);
        const sr2=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.1,0.012),am.clone()); sr2.position.set(0.25,0.28,0.36); sr2.rotation.z=-1.15; g.add(sr2);
        const srgl = gl(s.accentColor, 2, 1.5); srgl.position.set(0.15,0.18,0.38); g.add(srgl);

      } else if (id === 'infernoScythe' || id.toLowerCase().includes('scythe')) {
        // ── REAL SCYTHE: long staff + dramatic curved fire blade ─────────────
        // Staff
        g.add(this._m(new THREE.CylinderGeometry(0.016, 0.013, 1.05, 7), bm, 0, 0, -0.02, [Math.PI/2,0,0]));
        // Neck connector
        g.add(this._m(new THREE.CylinderGeometry(0.024, 0.02, 0.06, 7), am, 0, 0, 0.52, [Math.PI/2,0,0]));
        // Blade segments — sweeping crescent arc to the right
        const sc0=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.32,0.02),am.clone()); sc0.position.set(0.06,0.13,0.52); sc0.rotation.z=-0.35; g.add(sc0);
        const sc1=new THREE.Mesh(new THREE.BoxGeometry(0.009,0.28,0.018),am.clone()); sc1.position.set(0.19,0.32,0.52); sc1.rotation.z=-0.75; g.add(sc1);
        const sc2=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.18,0.014),am.clone()); sc2.position.set(0.30,0.44,0.52); sc2.rotation.z=-1.15; g.add(sc2);
        // Inner bevel edge glow strip
        const sci=new THREE.Mesh(new THREE.BoxGeometry(0.005,0.22,0.01),this._mat(s.accentColor,s.accentColor,0.95)); sci.position.set(0.04,0.14,0.54); sci.rotation.z=-0.35; g.add(sci);
        // Root spike
        g.add(this._m(new THREE.CylinderGeometry(0.0,0.014,0.1,5),am,-0.02,-0.04,0.56,[Math.PI/2,0,0]));
        // Fire glows
        const fg1=gl(s.accentColor,3.5,2.2); fg1.position.set(0.18,0.28,0.54); g.add(fg1);
        const fg2=gl(0xff2200,1.5,1.4); fg2.position.set(0.08,0.14,0.54); g.add(fg2);

      } else {
        // Generic melee fallback
        g.add(this._m(new THREE.BoxGeometry(0.016, 0.016, 0.55), am, 0, 0, 0.15));
        g.add(this._m(new THREE.BoxGeometry(0.04, 0.04, 0.18), bm, 0, 0, -0.1));
        const fbgl = gl(s.accentColor, 2.5, 1.5); fbgl.position.set(0,0,0.4); g.add(fbgl);
      }

    // ── MAGIC RANGED ──────────────────────────────────────────────────────────
    } else if (id === 'spellstaff') {
      g.add(this._m(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 7), bm, 0, 0, 0.01, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.1, 0.1, 0.1), am, 0, 0, 0.4));
      const ssgl = gl(s.accentColor, 3, 2); ssgl.position.set(0,0,0.42); g.add(ssgl);
    } else if (id === 'ankh') {
      g.add(this._m(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 7), bm, 0, 0, 0.01, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.18, 0.016, 0.016), am, 0, 0, 0.18));
      g.add(this._m(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10), am, 0, 0.04, 0.32, [Math.PI/2,0,0]));
      const agl = gl(s.accentColor, 2.5, 1.8); agl.position.set(0,0,0.36); g.add(agl);
    } else if (id === 'voidOrb') {
      g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.46, 7), bm, 0, 0, -0.04, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.13, 0.13, 0.13), am, 0, 0, 0.26));
      const vogl = gl(s.accentColor, 4, 2.5); vogl.position.set(0,0,0.27); g.add(vogl);
    } else if (id === 'stormWand') {
      g.add(this._m(new THREE.CylinderGeometry(0.016, 0.012, 0.5, 7), bm, 0, 0, 0.0, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.0, 0.022, 0.1, 5), am, 0, 0, 0.3, [Math.PI/2,0,0]));
      const swgl = gl(s.accentColor, 3, 1.8); swgl.position.set(0,0,0.36); g.add(swgl);
    } else if (id === 'frostScepter') {
      g.add(this._m(new THREE.CylinderGeometry(0.016, 0.016, 0.56, 7), bm, 0, 0, 0.0, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.0, 0.03, 0.14, 6), am, 0, 0, 0.35, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.0, 0.02, 0.1, 6), am, 0.03, 0.03, 0.37, [Math.PI/2,0.3,0]));
      const fsgl = gl(s.accentColor, 3, 2); fsgl.position.set(0,0,0.42); g.add(fsgl);
    } else if (id === 'shadowBow') {
      g.add(this._m(new THREE.BoxGeometry(0.01, 0.52, 0.012), bm, 0, 0, 0.02));
      g.add(this._m(new THREE.BoxGeometry(0.01, 0.28, 0.012), am, 0.045, 0.1, 0.02));
      g.add(this._m(new THREE.BoxGeometry(0.01, 0.28, 0.012), am, 0.045, -0.1, 0.02));
      g.add(this._m(new THREE.CylinderGeometry(0.003, 0.003, 0.55, 4), am, 0.052, 0, 0.02, [Math.PI/2,0,0]));
    } else if (id === 'orbOfChoas') {
      g.add(this._m(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6), bm, 0, 0, -0.1, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.14, 0.14, 0.14), am, 0, 0, 0.12));
      g.add(this._m(new THREE.BoxGeometry(0.08, 0.08, 0.08), bm, 0.08, 0.05, 0.16));
      const ocgl = gl(s.accentColor, 4, 2.5); ocgl.position.set(0,0,0.12); g.add(ocgl);

    // ── SNIPERS ───────────────────────────────────────────────────────────────
    } else if (id === 'sniperRifle') {
      g.add(this._m(new THREE.BoxGeometry(0.036, 0.05, 0.72), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.008, 0.01, 0.62, 8), bm, 0, 0.003, 0.67, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 12), am, 0, 0.048, 0.05, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.036, 0.2), bm, 0, -0.008, -0.42));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.055, 0.026), bm, 0, -0.052, -0.02));
      g.add(this._m(new THREE.BoxGeometry(0.006, 0.06, 0.006), bm, 0.025, -0.055, 0.3));
      g.add(this._m(new THREE.BoxGeometry(0.006, 0.06, 0.006), bm, -0.025, -0.055, 0.3));
    } else if (id === 'sniperAuto') {
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.052, 0.6), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.009, 0.011, 0.52, 8), bm, 0, 0.003, 0.56, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.028, 0.18), am, 0, 0.044, 0.04));
      g.add(this._m(new THREE.BoxGeometry(0.026, 0.06, 0.028), bm, 0, -0.052, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.032, 0.05, 0.18), bm, 0, -0.005, -0.4));

    // ── SHOTGUNS ──────────────────────────────────────────────────────────────
    } else if (id === 'shotgun') {
      g.add(this._m(new THREE.BoxGeometry(0.062, 0.068, 0.52), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.02, 0.022, 0.44, 8), bm, 0, 0.004, 0.48, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.048, 0.05, 0.14), am, 0, -0.01, 0.12));
      g.add(this._m(new THREE.BoxGeometry(0.048, 0.058, 0.2), bm, 0, -0.004, -0.32));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.062, 0.03), bm, 0, -0.058, -0.06));
      g.add(this._m(new THREE.BoxGeometry(0.005, 0.02, 0.05), am, 0.032, 0.02, 0.06));
    } else if (id === 'tacShotgun') {
      g.add(this._m(new THREE.BoxGeometry(0.058, 0.064, 0.48), bm, 0, 0, 0.04));
      g.add(this._m(new THREE.CylinderGeometry(0.018, 0.02, 0.38, 8), bm, 0, 0.003, 0.44, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.042, 0.042, 0.1), am, 0, -0.008, 0.2));
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.056, 0.16), bm, 0, -0.002, -0.22));
      g.add(this._m(new THREE.BoxGeometry(0.028, 0.06, 0.028), bm, 0, -0.054, 0.04));

    // ── PISTOLS ───────────────────────────────────────────────────────────────
    } else if (id === 'pistol') {
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.052, 0.18), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.007, 0.009, 0.15, 8), bm, 0, 0.009, 0.165, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.072, 0.026), bm, 0, -0.06, -0.04));
      g.add(this._m(new THREE.BoxGeometry(0.036, 0.01, 0.14), am, 0, 0.034, 0.02));
    } else if (id === 'revolver') {
      g.add(this._m(new THREE.BoxGeometry(0.04, 0.055, 0.22), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.008, 0.01, 0.18, 8), bm, 0, 0.01, 0.2, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.024, 0.024, 0.052, 6), am, 0, 0.006, 0.0, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.032, 0.078, 0.03), bm, 0, -0.062, -0.06));
      g.add(this._m(new THREE.BoxGeometry(0.01, 0.028, 0.018), am, 0, 0.042, -0.1));
    } else if (id === 'dualPistols') {
      for (const ox of [-0.065, 0.065]) {
        g.add(this._m(new THREE.BoxGeometry(0.034, 0.048, 0.17), bm, ox, 0, 0));
        g.add(this._m(new THREE.CylinderGeometry(0.006, 0.008, 0.14, 7), bm, ox, 0.008, 0.155, [Math.PI/2,0,0]));
        g.add(this._m(new THREE.BoxGeometry(0.028, 0.065, 0.024), bm, ox, -0.055, -0.04));
      }

    // ── SMG ───────────────────────────────────────────────────────────────────
    } else if (id === 'smg') {
      g.add(this._m(new THREE.BoxGeometry(0.048, 0.055, 0.3), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 8), bm, 0, 0.004, 0.25, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.018, 0.095, 0.022), am, 0, -0.078, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.052, 0.026), bm, 0, -0.05, 0.02));
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.012, 0.1), am, 0, 0.034, -0.06));

    // ── LMG / MINIGUN ─────────────────────────────────────────────────────────
    } else if (id === 'lmg') {
      g.add(this._m(new THREE.BoxGeometry(0.068, 0.072, 0.56), bm, 0, 0, 0.04));
      g.add(this._m(new THREE.CylinderGeometry(0.012, 0.015, 0.5, 8), bm, 0, 0.005, 0.52, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.092, 0.03), am, 0, -0.082, 0.08));
      g.add(this._m(new THREE.BoxGeometry(0.042, 0.08, 0.22), am, -0.022, -0.002, -0.18));
      g.add(this._m(new THREE.BoxGeometry(0.007, 0.065, 0.007), bm, 0.028, -0.062, 0.32));
      g.add(this._m(new THREE.BoxGeometry(0.007, 0.065, 0.007), bm, -0.028, -0.062, 0.32));
    } else if (id === 'minigun') {
      g.add(this._m(new THREE.BoxGeometry(0.09, 0.07, 0.6), bm, 0, 0, 0.05));
      for (let i=0;i<6;i++){const a=(i/6)*Math.PI*2,cx=Math.cos(a)*0.038,cy=Math.sin(a)*0.038;g.add(this._m(new THREE.CylinderGeometry(0.009,0.009,0.68,6),bm,cx,cy,0.04,[Math.PI/2,0,0]));}
      g.add(this._m(new THREE.BoxGeometry(0.07, 0.05, 0.35), am, 0, -0.03, -0.22));
      g.add(this._m(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), am, 0, 0, 0.38, [Math.PI/2,0,0]));

    // ── BURST RIFLE ───────────────────────────────────────────────────────────
    } else if (id === 'burstRifle') {
      g.add(this._m(new THREE.BoxGeometry(0.05, 0.06, 0.42), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.009, 0.011, 0.34, 8), bm, 0, 0.004, 0.38, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.085, 0.03), am, 0, -0.074, 0.02));
      g.add(this._m(new THREE.BoxGeometry(0.048, 0.012, 0.16), am, 0, 0.038, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.024, 0.06, 0.026), bm, 0, -0.05, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.036, 0.05, 0.16), bm, 0, -0.004, -0.24));

    // ── CROSSBOW / LAUNCHERS ──────────────────────────────────────────────────
    } else if (id === 'crossbow') {
      g.add(this._m(new THREE.BoxGeometry(0.04, 0.05, 0.44), bm, 0, 0, -0.02));
      g.add(this._m(new THREE.BoxGeometry(0.42, 0.018, 0.018), am, 0, 0.005, 0.24));
      g.add(this._m(new THREE.BoxGeometry(0.004, 0.004, 0.21), bm, 0.21, 0.005, 0.24));
      g.add(this._m(new THREE.BoxGeometry(0.004, 0.004, 0.21), bm, -0.21, 0.005, 0.24));
      g.add(this._m(new THREE.BoxGeometry(0.012, 0.012, 0.38), bm, 0, 0.024, 0.1));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.06, 0.03), bm, 0, -0.055, -0.06));
    } else if (id === 'grenadeLauncher') {
      g.add(this._m(new THREE.BoxGeometry(0.07, 0.075, 0.44), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.028, 0.03, 0.38, 10), bm, 0, 0.005, 0.4, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.065, 0.012, 0.3), am, 0, 0.045, 0.06));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.08, 0.03), bm, 0, -0.065, -0.04));
    } else if (id === 'rocketLauncher') {
      g.add(this._m(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 10), bm, 0, 0, 0.04, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.048, 0.048, 0.12, 10), am, 0, 0, 0.42, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.07, 0.05, 0.38), am, 0, -0.06, -0.02));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.07, 0.03), bm, 0, -0.08, -0.12));

    // ── FUTURISTIC RANGED ─────────────────────────────────────────────────────
    } else if (id === 'plasmaRifle') {
      g.add(this._m(new THREE.BoxGeometry(0.055, 0.065, 0.5), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.022, 0.025, 0.28, 8), am, 0, 0.005, 0.42, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.052, 0.015, 0.42), am, 0, 0.042, 0.01));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.08, 0.03), am, 0, -0.072, 0.06));
      const prgl = gl(s.accentColor, 2, 1.8); prgl.position.set(0,0,0.56); g.add(prgl);
    } else if (id === 'railgun') {
      g.add(this._m(new THREE.BoxGeometry(0.04, 0.06, 0.85), bm, 0, 0, 0));
      g.add(this._m(new THREE.BoxGeometry(0.082, 0.01, 0.85), am, 0, 0.042, 0));
      g.add(this._m(new THREE.BoxGeometry(0.082, 0.01, 0.85), am, 0, -0.012, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.016, 0.018, 0.7, 6), am, 0, 0.005, 0.62, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.025, 0.062, 0.026), bm, 0, -0.05, -0.04));
      const rggl = gl(s.accentColor, 3, 2); rggl.position.set(0,0,1); g.add(rggl);
    } else if (id === 'voidCannon') {
      g.add(this._m(new THREE.BoxGeometry(0.068, 0.075, 0.5), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.034, 0.038, 0.24, 8), am, 0, 0, 0.44, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.065, 0.018, 0.42), am, 0, 0.048, 0.04));
      g.add(this._m(new THREE.BoxGeometry(0.025, 0.082, 0.03), bm, 0, -0.07, 0.06));
      const vcgl = gl(s.accentColor, 3, 2.2); vcgl.position.set(0,0,0.56); g.add(vcgl);
    } else if (id === 'pulseCannon') {
      g.add(this._m(new THREE.BoxGeometry(0.06, 0.068, 0.46), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.025, 0.028, 0.2, 8), am, 0, 0, 0.42, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.055, 0.016, 0.38), am, 0, 0.044, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.075, 0.028), bm, 0, -0.062, 0.04));
      const pcgl = gl(s.accentColor, 2, 1.6); pcgl.position.set(0,0,0.52); g.add(pcgl);
    } else if (id === 'ionBlaster') {
      g.add(this._m(new THREE.BoxGeometry(0.05, 0.058, 0.34), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.014, 0.016, 0.22, 7), am, 0, 0.003, 0.32, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.046, 0.012, 0.28), am, 0, 0.038, -0.02));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.072, 0.024), bm, 0, -0.06, 0.04));
      const ibgl = gl(s.accentColor, 1.5, 1.2); ibgl.position.set(0,0,0.44); g.add(ibgl);
    } else if (id === 'quantumRifle') {
      g.add(this._m(new THREE.BoxGeometry(0.042, 0.055, 0.65), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.011, 0.013, 0.56, 8), bm, 0, 0.003, 0.6, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.016, 0.5), am, 0, 0.042, 0.01));
      g.add(this._m(new THREE.BoxGeometry(0.024, 0.062, 0.028), bm, 0, -0.052, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.035, 0.048, 0.2), bm, 0, -0.004, -0.38));
      const qrgl = gl(s.accentColor, 2.5, 2); qrgl.position.set(0,0,0.88); g.add(qrgl);
    } else if (id === 'antimatterGun') {
      g.add(this._m(new THREE.BoxGeometry(0.072, 0.082, 0.46), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 10), am, 0, 0, 0.44, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.068, 0.022, 0.38), am, 0, 0.054, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.028, 0.088, 0.032), bm, 0, -0.074, 0.06));
      const aggl = gl(s.accentColor, 4, 2.8); aggl.position.set(0,0,0.55); g.add(aggl);
    } else if (id === 'gravLauncher') {
      g.add(this._m(new THREE.BoxGeometry(0.065, 0.07, 0.5), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.03, 0.034, 0.26, 8), am, 0, 0, 0.44, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.025, 0.08, 0.028), bm, 0, -0.068, 0.04));
      const glgl = gl(s.accentColor, 2, 1.5); glgl.position.set(0,0,0.57); g.add(glgl);
    } else if (id === 'lavaCannon') {
      g.add(this._m(new THREE.BoxGeometry(0.062, 0.07, 0.44), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.028, 0.032, 0.22, 8), am, 0, 0, 0.4, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.058, 0.016, 0.36), am, 0, 0.046, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.024, 0.076, 0.028), bm, 0, -0.065, 0.04));
      const lcgl = gl(0xff4400, 3, 2); lcgl.position.set(0,0,0.51); g.add(lcgl);
    } else if (id === 'soniCannon') {
      g.add(this._m(new THREE.BoxGeometry(0.058, 0.065, 0.38), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.038, 0.022, 0.14, 12), am, 0, 0, 0.36, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.055, 0.016, 0.32), am, 0, 0.044, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.072, 0.026), bm, 0, -0.062, 0.04));
      const scgl = gl(s.accentColor, 1.5, 1.4); scgl.position.set(0,0,0.44); g.add(scgl);
    } else if (id === 'naniteRifle') {
      g.add(this._m(new THREE.BoxGeometry(0.044, 0.056, 0.46), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.01, 0.012, 0.36, 8), am, 0, 0.003, 0.42, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.04, 0.013, 0.38), am, 0, 0.039, -0.01));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.08, 0.025), bm, 0, -0.068, 0.04));
      const nrgl = gl(s.accentColor, 1.5, 1.2); nrgl.position.set(0,0,0.6); g.add(nrgl);
    } else if (id === 'disruptor') {
      g.add(this._m(new THREE.BoxGeometry(0.054, 0.062, 0.42), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.018, 0.022, 0.2, 7), am, 0, 0.004, 0.38, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.05, 0.014, 0.35), am, 0, 0.042, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.022, 0.076, 0.026), bm, 0, -0.064, 0.04));
      const dgl = gl(s.accentColor, 2.5, 1.8); dgl.position.set(0,0,0.49); g.add(dgl);

    // ── ANCIENT RANGED ────────────────────────────────────────────────────────
    } else if (id === 'longbow') {
      g.add(this._m(new THREE.BoxGeometry(0.012, 0.72, 0.014), bm, 0, 0, 0.01));
      g.add(this._m(new THREE.BoxGeometry(0.012, 0.42, 0.014), am, 0.05, 0.12, 0.01));
      g.add(this._m(new THREE.BoxGeometry(0.012, 0.42, 0.014), am, 0.05, -0.12, 0.01));
      g.add(this._m(new THREE.CylinderGeometry(0.003, 0.003, 0.72, 4), bm, 0.058, 0, 0.01, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 5), am, 0.03, 0, 0.01, [Math.PI/2,0,0]));
    } else if (id === 'throwingAxes') {
      g.add(this._m(new THREE.CylinderGeometry(0.013, 0.013, 0.28, 6), bm, 0, 0, -0.06, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.03, 0.16, 0.02), am, 0.06, 0.04, 0.1));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.1, 0.018), am, -0.04, 0.02, 0.08));

    // ── ASSAULT RIFLE + GENERIC FALLBACK ──────────────────────────────────────
    } else {
      g.add(this._m(new THREE.BoxGeometry(0.052, 0.062, 0.44), bm, 0, 0, 0));
      g.add(this._m(new THREE.CylinderGeometry(0.01, 0.012, 0.32, 8), bm, 0, 0.004, 0.38, [Math.PI/2,0,0]));
      g.add(this._m(new THREE.BoxGeometry(0.02, 0.088, 0.03), am, 0, -0.076, 0.02));
      g.add(this._m(new THREE.BoxGeometry(0.026, 0.062, 0.026), bm, 0, -0.053, 0.0));
      g.add(this._m(new THREE.BoxGeometry(0.038, 0.05, 0.17), bm, 0, -0.004, -0.24));
      g.add(this._m(new THREE.BoxGeometry(0.011, 0.007, 0.18), am, 0, 0.036, 0.04));
    }

    const muz = new THREE.Object3D(); muz.name = 'muzzle';
    const mzz = {
      sniperRifle:0.98,sniperAuto:0.88,railgun:1.05,shotgun:0.73,tacShotgun:0.65,
      smg:0.36,pistol:0.25,revolver:0.28,dualPistols:0.22,minigun:0.68,lmg:0.78,
      plasmaRifle:0.62,voidCannon:0.58,pulseCannon:0.54,ionBlaster:0.47,
      quantumRifle:0.88,antimatterGun:0.56,gravLauncher:0.58,lavaCannon:0.53,
      soniCannon:0.44,naniteRifle:0.6,disruptor:0.5,
      crossbow:0.42,grenadeLauncher:0.52,rocketLauncher:0.6,
      longbow:0.18,throwingAxes:0.14,burstRifle:0.52,spellstaff:0.44,
      ankh:0.38,voidOrb:0.3,stormWand:0.38,frostScepter:0.44,shadowBow:0.18,orbOfChoas:0.18,
      katana:0,spear:0,battleaxe:0,warHammer:0,scimitar:0,twinDaggers:0,
      halberd:0,triton:0,gladiusSword:0,flail:0,naginata:0,hammerfist:0,
      combatKnife:0,tacticalBaton:0,chainsaw:0,earthGauntlets:0,knuckledusters:0,
      energyBlade:0,plasmaSword:0,nanoWhip:0,gravFist:0,phaseBlade:0,
      voltLance:0,atomicMace:0,holyBlade:0,runeBlades:0,soulReaper:0,infernoScythe:0,
    };
    muz.position.set(0, 0.004, mzz[id] !== undefined ? mzz[id] : 0.55);
    g.add(muz);
    return g;
  }

  _m(geo, mat, x, y, z, rot) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) { m.rotation.x = rot[0] || 0; m.rotation.y = rot[1] || 0; m.rotation.z = rot[2] || 0; }
    return m;
  }

  canShoot(now) {
    if (!this.stats) return false;
    if (this.isMelee()) return (now - this.lastShotTime) >= (60000 / this.stats.fireRate);
    // Infinite mags: reserve is always topped up, reload instantly when empty
    this.reserve = 9999;
    if (this.ammo <= 0 && !this.isReloading) this.startReload();
    if (this.isReloading) return false;
    // Minigun spin-up
    if (this.stats.spinUp) {
      if (!this._spinReady) return false;
    }
    return (now - this.lastShotTime) >= (60000 / this.stats.fireRate);
  }

  shoot(camera, now) {
    if (!this.canShoot(now)) return null;
    const s = this.stats;
    if (!this.isMelee()) {
      // Check if owner has infinite ammo boost active
      if (!this._ownerRef?._boostInfiniteAmmo) {
        this.ammo--;
        if (this.ammo < 0) { this.ammo = 0; return null; }
      }
      // Infinite reserve: auto-reload the moment mag empties
      this.reserve = 9999;
    }
    this.lastShotTime = now;
    if (!this.isMelee()) {
      // Per-weapon recoil patterns (x offset, y rise per shot index 0-11)
      const shotIdx = Math.max(0, (s.magSize - this.ammo - 1)) % 12;
      const P = { assaultRifle:[[0,.05],[0,.07],[-.02,.08],[.02,.08],[0,.07],[-.03,.06],[.03,.06],[0,.05],[-.02,.04],[.02,.04],[0,.03],[0,.02]], smg:[[0,.03],[.01,.03],[-.01,.03],[0,.04],[.01,.03],[-.01,.03],[0,.02],[.01,.02],[-.01,.02],[0,.02],[0,.01],[0,.01]], sniperRifle:[[0,.15],[0,.12],[0,.1],[0,.08],[0,.07],[0,.06],[0,.05],[0,.04],[0,.04],[0,.03],[0,.03],[0,.02]], shotgun:[[0,.12],[0,.1],[0,.08],[0,.06],[0,.05],[0,.04],[0,.04],[0,.03],[0,.03],[0,.02],[0,.02],[0,.02]], pistol:[[0,.06],[0,.05],[.01,.05],[-.01,.05],[0,.04],[0,.04],[0,.03],[0,.03],[0,.02],[0,.02],[0,.02],[0,.02]], revolver:[[0,.18],[0,.15],[0,.12],[0,.1],[0,.08],[0,.07],[0,.06],[0,.05],[0,.04],[0,.04],[0,.03],[0,.03]], minigun:[[0,.02],[.005,.02],[-.005,.02],[0,.025],[.005,.02],[-.005,.02],[0,.015],[0,.015],[0,.015],[0,.01],[0,.01],[0,.01]], railgun:[[0,.22],[0,.2],[0,.18],[0,.16],[0,.14],[0,.12],[0,.1],[0,.09],[0,.08],[0,.07],[0,.06],[0,.05]], burstRifle:[[0,.06],[.01,.07],[-.01,.07],[0,.06],[.01,.05],[-.01,.05],[0,.04],[0,.04],[0,.03],[0,.03],[0,.02],[0,.02]], plasmaRifle:[[0,.04],[.01,.04],[-.01,.04],[0,.05],[.01,.04],[-.01,.04],[0,.03],[0,.03],[0,.02],[0,.02],[0,.02],[0,.02]] };
      const pat = P[s.id] || P.assaultRifle;
      const [rx, ry] = pat[shotIdx] || pat[pat.length-1];
      this.recoilX += rx + (Math.random()-0.5)*0.005;
      this.recoilY += ry + Math.random()*0.005;
      this._flash(camera);
      this._spawnTracer(camera, s);
    }

    // Melee: instant AoE swing
    if (this.isMelee()) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const origin = camera.position.clone().addScaledVector(dir, 0.5);
      return { bullets: [{ id:'melee_'+Math.random().toString(36).substr(2,6), position:origin, direction:dir.clone(), speed:0, damage:s.damage, range:s.meleeRadius||2.2, meleeArc:s.meleeArc||1.8, distanceTraveled:0, alive:true, isMelee:true, ownerId:'local', ownerTeam:this._ownerTeam||'a' }], ammo:this.ammo, reserve:this.reserve };
    }

    if (s.burst && s.burst > 1 && !this._burstQueue) this._burstQueue = s.burst - 1;

    const bullets = [];
    const pellets = s.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const sp = s.spread * (1 + this.recoilY * 0.5);
      dir.x += (Math.random()-0.5)*sp; dir.y += (Math.random()-0.5)*sp; dir.z += (Math.random()-0.5)*sp;
      dir.normalize();
      bullets.push({ id:Math.random().toString(36).substr(2,8), position:camera.position.clone().addScaledVector(dir,0.4), direction:dir.clone(), speed:s.id==='railgun'?800:140, damage:s.damage, range:s.range, distanceTraveled:0, alive:true, penetrating:!!s.penetrating, ownerId:'local', ownerTeam:this._ownerTeam||'a' });
    }
    return { bullets, ammo:this.ammo, reserve:this.reserve };
  }

  _spawnTracer(camera, s) {
    if (!this.scene || this.isMelee()) return;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const origin = camera.position.clone().addScaledVector(dir, 0.5);
    const end = origin.clone().addScaledVector(dir, Math.min(s.range||60, 60));
    const cols = { sniperRifle:0x00ffff, railgun:0x9900ff, plasmaRifle:0x00ff88, minigun:0xffaa00, shotgun:0xffdd88 };
    const col = cols[s.id] || 0xffe8aa;
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.5, depthWrite:false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    let alpha = 0.5;
    const fade = () => { alpha -= 0.06; if(alpha<=0){this.scene.remove(line);geo.dispose();mat.dispose();return;} mat.opacity=alpha; requestAnimationFrame(fade); };
    requestAnimationFrame(fade);
  }

  _flash(camera) {
    if (this.isMelee()) return;
    const s = this.stats;
    const cols = { sniperRifle:0xaaffff, railgun:0xbb88ff, plasmaRifle:0x44ffaa, minigun:0xff8800, shotgun:0xffcc55 };
    const col = cols[s.id] || 0xffbb44;
    const lt = new THREE.PointLight(col, 18, 7);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    lt.position.copy(camera.position).addScaledVector(dir, 0.8);
    this.scene.add(lt);
    this.flashes.push({ light:lt, life:55 });
  }

  startReload() {
    if (this.isMelee() || this.isReloading || !this.stats || this.reserve <= 0 || this.ammo === this.stats.magSize) return;
    this.isReloading = true; this.reloadTimer = this.stats.reloadTime;
  }

  update(delta, isFiring) {
    // Muzzle flashes
    this.flashes = this.flashes.filter(f => {
      f.life -= delta; f.light.intensity = Math.max(0, 14 * (f.life / 70));
      if (f.life <= 0) { this.scene.remove(f.light); return false; } return true;
    });
    // Recoil recovery
    this.recoilY *= 0.8; this.recoilX *= 0.8;
    if (Math.abs(this.recoilY) < 0.001) this.recoilY = 0;
    if (Math.abs(this.recoilX) < 0.001) this.recoilX = 0;
    // Reload
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.reserve = 9999; // ensure infinite
        this.ammo = this.stats.magSize; // always full mag
        return { reloaded: true };
      }
    }
    // Minigun spin-up
    if (this.stats?.spinUp) {
      if (isFiring) {
        this._spinUpTimer = Math.min(this._spinUpTimer + delta, this.stats.spinUp);
        this._spinReady = this._spinUpTimer >= this.stats.spinUp * 0.7;
      } else {
        this._spinUpTimer = Math.max(0, this._spinUpTimer - delta * 2);
        this._spinReady = this._spinUpTimer > this.stats.spinUp * 0.3;
      }
    }
    // Burst queue
    if (this._burstQueue > 0) {
      this._burstTimer -= delta;
      if (this._burstTimer <= 0) {
        this._burstQueue--;
        this._burstTimer = 80;
        // Trigger burst shot via flag
        return { burstFire: true };
      }
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HUMANOID CHARACTER MESH SYSTEM v2 — Proportional, Detailed, Fully Animated
// ═══════════════════════════════════════════════════════════════════════════

function buildCharMesh(charId, charDef, forPreview) {
  const g = new THREE.Group();

  // ── Materials ─────────────────────────────────────────────────────────────
  const col   = new THREE.Color(charDef.bodyColor);
  const acol  = new THREE.Color(charDef.accentColor);

  // Primary armour body
  const bm = new THREE.MeshStandardMaterial({
    color: charDef.bodyColor, metalness: 0.55, roughness: 0.30
  });
  // Accent / glow panels
  const am = new THREE.MeshStandardMaterial({
    color: charDef.accentColor, metalness: 0.9, roughness: 0.08,
    emissive: acol, emissiveIntensity: 0.65
  });
  // Dark visor / undersuit
  const vm = new THREE.MeshStandardMaterial({
    color: 0x050810, metalness: 0.95, roughness: 0.05
  });
  // Secondary armour — slightly lighter than body
  const bm2 = new THREE.MeshStandardMaterial({
    color: col.clone().lerp(new THREE.Color(0xffffff), 0.12), metalness: 0.45, roughness: 0.42
  });
  // Undersuit (dark flex material under armour gaps)
  const um = new THREE.MeshStandardMaterial({
    color: 0x0a0a14, metalness: 0.1, roughness: 0.8
  });
  // Thin emissive trim lines
  const tm = new THREE.MeshStandardMaterial({
    color: charDef.accentColor, metalness: 1.0, roughness: 0.0,
    emissive: acol, emissiveIntensity: 1.2
  });

  // ── Mesh helper ───────────────────────────────────────────────────────────
  const mk = (geo, mat, px=0, py=0, pz=0, rx=0, ry=0, rz=0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true; m.receiveShadow = false;
    return m;
  };
  // Cylinder helper (most joints use capsule-ish cylinders)
  const cyl = (rt, rb, h, seg=10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (r, ws=10, hs=8) => new THREE.SphereGeometry(r, ws, hs);

  // ── Per-character personality via deterministic hash ────────────────────
  let h = 0; for (const c of charId) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  const variant = Math.abs(h) % 8; // 0-7 visual variant

  // Body scale — tanks bigger, assassins leaner
  const role = (charDef.role || '').toUpperCase();
  const isTank     = role.includes('TANK')  || role.includes('SENTINEL');
  const isAssassin = role.includes('DUELIST')|| role.includes('INFILTR');
  const isSupport  = role.includes('SUPPORT')|| role.includes('MEDIC');
  const bodyW  = isTank ? 1.14 : isAssassin ? 0.92 : 1.0;  // chest width mult
  const bodyH  = isTank ? 1.08 : isAssassin ? 0.96 : 1.0;  // height mult
  const legLen = isTank ? 0.94 : isAssassin ? 1.04 : 1.0;

  // Root group sits so feet are at y=0
  // Full standing height ≈ 1.82 units

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ROOT — foot level at y=0, centre of mass ≈ y=0.90
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── LEGS ──────────────────────────────────────────────────────────────────
  // Hip pivot lives at y = 0.82 (top of legs)
  const hipPivot = new THREE.Group(); hipPivot.position.set(0, 0.82 * bodyH, 0); g.add(hipPivot);

  const mkLeg = (side) => {
    const sx   = side === 'l' ? -1 : 1;
    const leg  = new THREE.Group(); leg.position.set(sx * 0.115, 0, 0); hipPivot.add(leg);

    // ── Thigh ──
    const thigh = new THREE.Group(); leg.add(thigh);
    // Main thigh cylinder
    thigh.add(mk(cyl(0.075, 0.068, 0.38 * legLen, 10), bm,  0, -0.19 * legLen, 0));
    // Thigh armour plate (front)
    thigh.add(mk(box(0.10, 0.22 * legLen, 0.04), bm2,  0, -0.15 * legLen,  0.072));
    // Accent stripe on plate
    thigh.add(mk(box(0.018, 0.18 * legLen, 0.010), tm,  sx*0.04, -0.15 * legLen, 0.096));
    // Knee cap sphere
    thigh.add(mk(sph(0.068, 8, 6), bm, 0, -0.38 * legLen, 0));

    // ── Shin (knee pivot) ──
    const knee = new THREE.Group(); knee.position.set(0, -0.38 * legLen, 0); thigh.add(knee);
    knee.add(mk(cyl(0.062, 0.054, 0.34 * legLen, 10), bm,  0, -0.17 * legLen, 0));
    // Shin guard
    knee.add(mk(box(0.075, 0.20 * legLen, 0.038), bm2,  0, -0.17 * legLen,  0.068));
    knee.add(mk(box(0.012, 0.16 * legLen, 0.008), tm,  0, -0.17 * legLen,  0.090));

    // ── Ankle + boot ──
    const ankle = new THREE.Group(); ankle.position.set(0, -0.34 * legLen, 0); knee.add(ankle);
    // Boot upper
    ankle.add(mk(box(0.100, 0.080, 0.175), bm,     0, -0.040, 0.020));
    // Boot sole (accent)
    ankle.add(mk(box(0.096, 0.022, 0.178), am,      0, -0.085, 0.022));
    // Toe cap
    ankle.add(mk(box(0.090, 0.055, 0.055), bm2,     0, -0.040, 0.110));

    return { leg, thigh, knee, ankle };
  };

  const lLeg = mkLeg('l');
  const rLeg = mkLeg('r');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── TORSO GROUP (pivots at hips) ─────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const torso = new THREE.Group(); torso.position.set(0, 0.82 * bodyH, 0); g.add(torso);

  // Pelvis / hip armour
  torso.add(mk(box(0.36 * bodyW, 0.14, 0.22), bm,   0, 0, 0));
  torso.add(mk(box(0.30 * bodyW, 0.06, 0.18), am,   0, -0.08, 0));   // pelvis accent band

  // Abdomen / waist (narrower)
  torso.add(mk(box(0.30 * bodyW, 0.16, 0.20), um,   0, 0.15, 0));    // flex undersuit
  torso.add(mk(box(0.08 * bodyW, 0.14, 0.21), bm2,  -0.12 * bodyW, 0.14, 0)); // side plate L
  torso.add(mk(box(0.08 * bodyW, 0.14, 0.21), bm2,   0.12 * bodyW, 0.14, 0)); // side plate R

  // ── Chest group (pivots for upper body aim twist) ─────────────────────
  const chest = new THREE.Group(); chest.position.set(0, 0.30, 0); torso.add(chest);

  // Main chest block
  chest.add(mk(box(0.48 * bodyW, 0.30, 0.24), bm,   0, 0, 0));
  // Front chest armour plate
  chest.add(mk(box(0.38 * bodyW, 0.22, 0.032), bm2,  0, 0.01,  0.136));
  // Central glowing chest piece
  chest.add(mk(box(0.14 * bodyW, 0.12, 0.014), am,   0, 0.02,  0.154));
  // Chest vent slits (4 horizontal accent lines)
  for (let i = 0; i < 4; i++) {
    chest.add(mk(box(0.28 * bodyW, 0.008, 0.008), tm,  0, -0.04 + i * 0.028,  0.156));
  }
  // Shoulder pauldrons
  chest.add(mk(box(0.14 * bodyW, 0.10, 0.25), bm2,  -0.32 * bodyW,  0.12, 0));
  chest.add(mk(box(0.14 * bodyW, 0.10, 0.25), bm2,   0.32 * bodyW,  0.12, 0));
  // Pauldron accent edges
  chest.add(mk(box(0.008, 0.10, 0.25), tm,  -0.39 * bodyW,  0.12, 0));
  chest.add(mk(box(0.008, 0.10, 0.25), tm,   0.39 * bodyW,  0.12, 0));
  // Back plate
  chest.add(mk(box(0.44 * bodyW, 0.28, 0.018), bm2,  0, 0, -0.130));

  // ── NECK ──────────────────────────────────────────────────────────────────
  const neck = new THREE.Group(); neck.position.set(0, 0.195, 0); chest.add(neck);
  neck.add(mk(cyl(0.068, 0.078, 0.10, 8), bm,   0,  0.05, 0));
  neck.add(mk(cyl(0.056, 0.060, 0.06, 8), um,   0,  0.08, 0)); // collar flex ring

  // ── HEAD ──────────────────────────────────────────────────────────────────
  const head = new THREE.Group(); head.position.set(0, 0.13, 0); neck.add(head);

  // Skull (rounded box)
  head.add(mk(box(0.240, 0.200, 0.230), bm,   0,  0.010, 0));
  head.add(mk(sph(0.128, 10, 6, 0, Math.PI*2, 0, Math.PI*0.55), bm,  0,  0.108, 0)); // dome
  // Jaw / chin block
  head.add(mk(box(0.195, 0.065, 0.055), bm2,  0, -0.070,  0.090));
  // Cheek guards
  head.add(mk(box(0.030, 0.090, 0.110), bm2,  -0.118,  0.010, 0));
  head.add(mk(box(0.030, 0.090, 0.110), bm2,   0.118,  0.010, 0));
  // Ear tech discs
  head.add(mk(cyl(0.030, 0.030, 0.018, 8), am,  -0.132,  0.015, 0,  0, 0, Math.PI/2));
  head.add(mk(cyl(0.030, 0.030, 0.018, 8), am,   0.132,  0.015, 0,  0, 0, Math.PI/2));

  // Visor slot (dark inset)
  head.add(mk(box(0.205, 0.058, 0.025), vm,   0,  0.020,  0.118));
  // Visor glow — one bright horizontal bar
  head.add(mk(box(0.188, 0.020, 0.012), tm,   0,  0.022,  0.132));
  // Lower face grille / mouthpiece
  head.add(mk(box(0.155, 0.040, 0.022), vm,   0, -0.035,  0.118));
  for (let i = 0; i < 3; i++) {
    head.add(mk(box(0.130, 0.005, 0.006), tm,  0, -0.030 + i*0.014, 0.130));
  }

  // ── Per-variant head gear ───────────────────────────────────────────────
  switch (variant) {
    case 0: // Mohawk / crest fin
      head.add(mk(box(0.030, 0.095, 0.200), am,  0,  0.168,  0));
      break;
    case 1: // Twin antenna
      head.add(mk(cyl(0.010, 0.016, 0.130, 6), am,  -0.072,  0.205, -0.020));
      head.add(mk(cyl(0.010, 0.016, 0.130, 6), am,   0.072,  0.205, -0.020));
      head.add(mk(sph(0.020), am,  -0.072,  0.278, -0.020));
      head.add(mk(sph(0.020), am,   0.072,  0.278, -0.020));
      break;
    case 2: // Helmet ridge / samurai crest
      head.add(mk(box(0.040, 0.055, 0.230), am,  0,  0.165,  0));
      head.add(mk(box(0.022, 0.035, 0.195), tm,  0,  0.175,  0));
      break;
    case 3: // Full-face gas mask / wide visor
      head.add(mk(box(0.228, 0.082, 0.024), am,  0, -0.010,  0.120));
      head.add(mk(box(0.210, 0.065, 0.010), tm,  0, -0.010,  0.134));
      break;
    case 4: // Horns / devil
      head.add(mk(cyl(0.0, 0.022, 0.10, 5), am,  -0.095,  0.200,  0,  0, 0, -0.3));
      head.add(mk(cyl(0.0, 0.022, 0.10, 5), am,   0.095,  0.200,  0,  0, 0,  0.3));
      break;
    case 5: // Visor fin (sniper-style)
      head.add(mk(box(0.010, 0.040, 0.145), bm2,  0, -0.012,  0.145));
      head.add(mk(box(0.188, 0.012, 0.010), tm,   0,  0.030,  0.135));
      break;
    case 6: // Round dome sensor pack
      head.add(mk(sph(0.058, 8, 6), am,  0,  0.178,  0));
      head.add(mk(cyl(0.012, 0.012, 0.065, 6), tm,  0,  0.226,  0));
      break;
    case 7: // Cyber crown / halo ring
      head.add(mk(cyl(0.130, 0.130, 0.012, 16, 1, true), am,  0,  0.220,  0));
      break;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── ARMS ─────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const mkArm = (side) => {
    const sx     = side === 'l' ? -1 : 1;
    const shOfsX = sx * 0.310 * bodyW;

    const shoulder = new THREE.Group(); shoulder.position.set(shOfsX, 0.12, 0); chest.add(shoulder);
    shoulder.rotation.z = sx * 0.10;

    // ── Upper arm ──
    const upperArm = new THREE.Group(); shoulder.add(upperArm);
    upperArm.add(mk(cyl(0.058, 0.052, 0.290, 10), bm,   0, -0.145, 0));
    // Bicep armour plate
    upperArm.add(mk(box(0.055, 0.180, 0.038), bm2,  sx * 0.055, -0.130, 0.015));
    // Accent stripe
    upperArm.add(mk(box(0.010, 0.155, 0.008), tm,   sx * 0.074, -0.128, 0.022));
    // Elbow ball joint
    upperArm.add(mk(sph(0.055, 8, 6), bm,   0, -0.290, 0));

    // ── Forearm (elbow pivot) ──
    const elbow = new THREE.Group(); elbow.position.set(0, -0.290, 0); upperArm.add(elbow);
    elbow.add(mk(cyl(0.050, 0.043, 0.265, 10), bm,   0, -0.132, 0));
    // Forearm armour shell
    elbow.add(mk(box(0.048, 0.185, 0.038), bm2,  sx * 0.048, -0.128, 0.018));
    elbow.add(mk(box(0.008, 0.160, 0.006), tm,   sx * 0.067, -0.125, 0.026));
    // Wrist accent ring
    elbow.add(mk(cyl(0.046, 0.046, 0.016, 10, 1, true), am,   0, -0.258, 0));

    // ── Hand ──
    const hand = new THREE.Group(); hand.position.set(0, -0.268, 0); elbow.add(hand);
    // Palm
    hand.add(mk(box(0.090, 0.072, 0.058), bm,   0, -0.036, 0.002));
    // Knuckle ridge
    hand.add(mk(box(0.085, 0.018, 0.018), bm2,  0, -0.004, 0.034));
    // Finger stub (simplified — one block)
    hand.add(mk(box(0.078, 0.045, 0.030), bm,   0, -0.054, 0.030));

    return { shoulder, upperArm, elbow, hand };
  };

  const lArm = mkArm('l');
  const rArm = mkArm('r');

  // ─────────────────────────────────────────────────────────────────────────
  // ── STORE BONE REFERENCES ────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  const u = g.userData;
  u.hipPivot  = hipPivot;
  u.torso     = torso;
  u.chest     = chest;
  u.neck      = neck;
  u.head      = head;
  // Leg bones
  u.lHip   = lLeg.leg;   u.lThigh  = lLeg.thigh;  u.lKnee  = lLeg.knee;  u.lAnkle = lLeg.ankle;
  u.rHip   = rLeg.leg;   u.rThigh  = rLeg.thigh;  u.rKnee  = rLeg.knee;  u.rAnkle = rLeg.ankle;
  // Arm bones
  u.lShoulder = lArm.shoulder; u.lElbow = lArm.elbow; u.lHand = lArm.hand;
  u.rShoulder = rArm.shoulder; u.rElbow = rArm.elbow; u.rHand = rArm.hand;

  // ── Animation state ───────────────────────────────────────────────────────
  u.animT       = Math.random() * Math.PI * 2;   // random phase offset per bot
  u.idleSwayT   = Math.random() * 20;
  u.blinkT      = 0;
  u.aimPitch    = 0;
  u.prevState   = '';
  u.stateT      = 0;   // time in current state
  u.shootRecoilT= 0;   // recoil timer
  u.crouchBlend = 0;   // 0 = stand, 1 = full crouch (smooth blend)
  u.bodyH       = bodyH;
  u.legLen      = legLen;

  // ── Accent glow light ─────────────────────────────────────────────────────
  const glow = new THREE.PointLight(charDef.accentColor, 0.9, 2.8);
  glow.position.set(0, 1.15, 0.08); g.add(glow);
  u.glowLight = glow;

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTER ANIMATION SYSTEM v2
// States: idle | walk | run | strafe | attack | crouch | crouchWalk |
//         reload | death | jump
// ═══════════════════════════════════════════════════════════════════════════

function animateCharMesh(mesh, speed, state, delta, aimYaw, aimPitch) {
  const u = mesh.userData;
  if (!u.torso) return;

  const dt   = Math.min(delta / 1000, 0.05);  // cap at 50ms
  const bH   = u.bodyH  || 1.0;
  const lL   = u.legLen || 1.0;

  // ── State / speed classification ─────────────────────────────────────────
  const spd     = Math.min(speed, 20);
  const isRun   = spd > 6.0;
  const isWalk  = spd > 0.6 && !isRun;
  const isMove  = spd > 0.6;
  const isAim   = state === 'attack' || state === 'strafe' || state === 'flank';
  const isCover = state === 'cover'  || state === 'reload';
  const isDead  = state === 'dead'   || state === 'die';

  // Track state transitions for blend timers
  if (u.prevState !== state) { u.stateT = 0; u.prevState = state; }
  u.stateT += dt;

  // ── Master time accumulators ──────────────────────────────────────────────
  const cycleFreq = isRun ? spd * 0.048 : isWalk ? spd * 0.055 : dt * 0.55;
  u.animT      += isMove ? cycleFreq : dt * 0.50;
  u.idleSwayT  += dt * 0.85;
  const t    = u.animT;
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);

  // ── Smoothstep helper ─────────────────────────────────────────────────────
  const lerp  = (a, b, f) => a + (b - a) * f;
  const damp  = (cur, tgt, spd2) => lerp(cur, tgt, Math.min(1, spd2 * dt));

  // ── CROUCH BLEND ─────────────────────────────────────────────────────────
  const crouchTarget = isCover ? 1.0 : 0.0;
  u.crouchBlend = damp(u.crouchBlend, crouchTarget, 8);
  const cb = u.crouchBlend;

  // ── TORSO Y — footstep vertical bob ──────────────────────────────────────
  const baseTorsoY = bH * 0.82;
  const bobAmt     = isRun ? 0.038 : isWalk ? 0.018 : 0;
  const bob        = Math.abs(Math.sin(t * 2)) * bobAmt;
  const crouchDrop = cb * 0.34 * bH;

  u.torso.position.y  = baseTorsoY + bob - crouchDrop;
  u.hipPivot.position.y = baseTorsoY - crouchDrop;

  // ── TORSO LEAN & TWIST ────────────────────────────────────────────────────
  // Forward lean when running
  const runLean        = isRun ? 0.18 : isWalk ? 0.04 : 0;
  const crouchLean     = cb * 0.28;
  u.torso.rotation.x   = damp(u.torso.rotation.x, runLean + crouchLean, 6);
  // Side sway (weight shift)
  u.torso.rotation.z   = isMove ? damp(u.torso.rotation.z, -sinT * 0.05, 8) : damp(u.torso.rotation.z, 0, 4);

  // ── CHEST aim twist ───────────────────────────────────────────────────────
  const chestYaw = isAim ? (aimYaw || 0) * 0.22 : 0;
  u.chest.rotation.y   = damp(u.chest.rotation.y, chestYaw, 7);
  const chestPitch     = isAim ? (aimPitch || 0) * 0.40 + crouchLean * 0.5 : crouchLean * 0.3;
  u.chest.rotation.x   = damp(u.chest.rotation.x, chestPitch, 6);

  // ── HEAD ─────────────────────────────────────────────────────────────────
  const idleLookY = Math.sin(u.idleSwayT * 0.38) * 0.14;
  const idleLookX = Math.sin(u.idleSwayT * 0.22) * 0.06;
  const aimNeckY  = isAim ? (aimYaw  || 0) * 0.30 : idleLookY;
  const aimNeckX  = isAim ? (aimPitch|| 0) * 0.45 : idleLookX;
  u.neck.rotation.y = damp(u.neck.rotation.y, aimNeckY, 8);
  u.neck.rotation.x = damp(u.neck.rotation.x, aimNeckX, 8);

  // ── LEGS ─────────────────────────────────────────────────────────────────
  if (u.lThigh && u.rThigh) {
    let lThighX = 0, rThighX = 0;
    let lKneeX  = 0, rKneeX  = 0;
    let lAnkX   = 0, rAnkX   = 0;

    if (isRun) {
      // Exaggerated running gait
      lThighX =  sinT * 0.80;
      rThighX = -sinT * 0.80;
      lKneeX  = Math.max(0,  sinT) * 0.90;
      rKneeX  = Math.max(0, -sinT) * 0.90;
      lAnkX   = -lThighX * 0.30;
      rAnkX   = -rThighX * 0.30;
    } else if (isWalk) {
      lThighX =  sinT * 0.55;
      rThighX = -sinT * 0.55;
      lKneeX  = Math.max(0,  sinT) * 0.50;
      rKneeX  = Math.max(0, -sinT) * 0.50;
      lAnkX   = -lThighX * 0.25;
      rAnkX   = -rThighX * 0.25;
    } else if (isCover) {
      // Crouch stance — legs bent outward and flexed
      lThighX = 0.30;  rThighX = 0.30;
      lKneeX  = 0.65;  rKneeX  = 0.65;
      lAnkX   = -0.18; rAnkX   = -0.18;
      u.lHip.rotation.z =  damp(u.lHip.rotation.z,  0.10, 6);
      u.rHip.rotation.z =  damp(u.rHip.rotation.z, -0.10, 6);
    }

    // Apply crouch blend to legs when walking/running
    if (isCover) {
      u.lThigh.rotation.x = damp(u.lThigh.rotation.x, lThighX, 8);
      u.rThigh.rotation.x = damp(u.rThigh.rotation.x, rThighX, 8);
      u.lKnee.rotation.x  = damp(u.lKnee.rotation.x,  lKneeX,  8);
      u.rKnee.rotation.x  = damp(u.rKnee.rotation.x,  rKneeX,  8);
      u.lAnkle.rotation.x = damp(u.lAnkle.rotation.x, lAnkX,   8);
      u.rAnkle.rotation.x = damp(u.rAnkle.rotation.x, rAnkX,   8);
    } else {
      u.lThigh.rotation.x = lerp(u.lThigh.rotation.x, lThighX, isMove ? 0.35 : 0.12);
      u.rThigh.rotation.x = lerp(u.rThigh.rotation.x, rThighX, isMove ? 0.35 : 0.12);
      u.lKnee.rotation.x  = lerp(u.lKnee.rotation.x,  lKneeX,  isMove ? 0.35 : 0.12);
      u.rKnee.rotation.x  = lerp(u.rKnee.rotation.x,  rKneeX,  isMove ? 0.35 : 0.12);
      u.lAnkle.rotation.x = lerp(u.lAnkle.rotation.x, lAnkX,   0.25);
      u.rAnkle.rotation.x = lerp(u.rAnkle.rotation.x, rAnkX,   0.25);
      // Reset hip splay when not crouching
      if (u.lHip) u.lHip.rotation.z = damp(u.lHip.rotation.z,  0, 6);
      if (u.rHip) u.rHip.rotation.z = damp(u.rHip.rotation.z,  0, 6);
    }
  }

  // ── ARMS ─────────────────────────────────────────────────────────────────
  if (u.lShoulder && u.rShoulder) {
    let lShX=0, lShZ=0, lElX=0;
    let rShX=0, rShZ=0, rElX=0;

    if (isAim) {
      // ── Combat aim pose ──────────────────────────────────────────────────
      const pitch = (aimPitch || u.aimPitch || 0);
      // Right (gun) arm — punching forward, elbow tucked
      rShX = -0.60 + pitch * 0.55;
      rShZ = -0.22;
      rElX =  0.60;
      // Left (support) arm — out and bracing
      lShX = -0.50 + pitch * 0.38;
      lShZ =  0.28;
      lElX =  0.72;

      // Shoot recoil pulse
      u.shootRecoilT = Math.max(0, (u.shootRecoilT || 0) - dt * 8);
      const recoil   = u.shootRecoilT;
      rShX -= recoil * 0.35;

    } else if (isRun) {
      // ── Running — big pumping arms ──────────────────────────────────────
      lShX = -sinT * 0.60;
      rShX =  sinT * 0.60;
      lElX =  Math.max(0, -sinT) * 0.55;
      rElX =  Math.max(0,  sinT) * 0.55;
      lShZ =  0.08; rShZ = -0.08;
    } else if (isWalk) {
      // ── Walking — natural pendulum ───────────────────────────────────────
      lShX = -sinT * 0.38;
      rShX =  sinT * 0.38;
      lElX =  Math.max(0, -sinT) * 0.28;
      rElX =  Math.max(0,  sinT) * 0.28;
      lShZ =  0.08; rShZ = -0.08;
    } else if (isCover) {
      // ── Crouching ready pose ─────────────────────────────────────────────
      rShX = -0.45; rShZ = -0.15; rElX = 0.50;
      lShX = -0.38; lShZ =  0.22; lElX = 0.65;
    } else {
      // ── Idle — subtle breathing sway + relaxed hang ──────────────────────
      const breathe = Math.sin(u.idleSwayT * 0.55) * 0.03;
      lShX = breathe;  rShX = -breathe;
      lElX = 0.08;     rElX =  0.08;
      lShZ = 0.08;     rShZ = -0.08;
    }

    const blend = isMove ? 0.30 : 0.14;
    u.lShoulder.rotation.x = lerp(u.lShoulder.rotation.x, lShX, blend);
    u.lShoulder.rotation.z = lerp(u.lShoulder.rotation.z, lShZ, blend);
    u.lElbow.rotation.x    = lerp(u.lElbow.rotation.x,    lElX, blend);
    u.rShoulder.rotation.x = lerp(u.rShoulder.rotation.x, rShX, blend);
    u.rShoulder.rotation.z = lerp(u.rShoulder.rotation.z, rShZ, blend);
    u.rElbow.rotation.x    = lerp(u.rElbow.rotation.x,    rElX, blend);
  }

  // ── GLOW LIGHT pulse ─────────────────────────────────────────────────────
  if (u.glowLight) {
    u.glowLight.intensity = 0.7 + Math.sin(u.idleSwayT * 1.8) * 0.18 + (u.shootRecoilT || 0) * 1.2;
  }

  // ── DEATH POSE (if BotAI _deathAnim is active, engine.js handles the fall,
  //    but here we snap the body into a ragdoll-like pose) ───────────────────
  if (isDead) {
    u.lThigh && (u.lThigh.rotation.x = damp(u.lThigh.rotation.x,  0.6, 4));
    u.rThigh && (u.rThigh.rotation.x = damp(u.rThigh.rotation.x,  0.4, 4));
    u.lKnee  && (u.lKnee.rotation.x  = damp(u.lKnee.rotation.x,  -0.3, 4));
    u.rKnee  && (u.rKnee.rotation.x  = damp(u.rKnee.rotation.x,   0.5, 4));
    u.lShoulder && (u.lShoulder.rotation.x = damp(u.lShoulder.rotation.x, 1.2, 3));
    u.rShoulder && (u.rShoulder.rotation.x = damp(u.rShoulder.rotation.x, 0.8, 3));
    u.lShoulder && (u.lShoulder.rotation.z = damp(u.lShoulder.rotation.z, 0.6, 3));
    u.rShoulder && (u.rShoulder.rotation.z = damp(u.rShoulder.rotation.z,-0.9, 3));
    u.chest  && (u.chest.rotation.x  = damp(u.chest.rotation.x,   0.4, 3));
    u.neck   && (u.neck.rotation.x   = damp(u.neck.rotation.x,    0.5, 3));
    if (u.glowLight) u.glowLight.intensity *= 0.92; // glow fades on death
  }
}

// ─────────────────────────────────────────────
// PLAYER CONTROLLER
// ─────────────────────────────────────────────
class PlayerController {
  constructor(camera, scene, charId, config) {
    this.camera = camera; this.scene = scene;
    this.charDef = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
    this.config = { sensitivity: 0.002, fov: 90, invertY: false, ...config };
    this.position = new THREE.Vector3(0, 1.8, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.isGrounded = false; this.height = 1.8;
    this.health = this.charDef.maxHealth; this.shield = this.charDef.maxShield;
    this.maxHealth = this.charDef.maxHealth; this.maxShield = this.charDef.maxShield;
    this.isAlive = true; this.isInvincible = false;
    this.kills = 0; this.deaths = 0; this.assists = 0;
    this.isPlayer = true; this.team = 'a'; this.name = 'YOU'; this.id = 'local';
    this.isSprinting = false; this.isCrouching = false; this.isAiming = false;
    this.speedMult = 1; this.damageMult = 1;
    this.abilityCooldowns = { e: 0, q: 0, f: 0 };
    // Sprint stamina: 100 = full, drains while sprinting, regens when not
    this.stamina = 100; this.maxStamina = 100;
    this._sprintDrainRate = 25;   // per second
    this._sprintRegenRate = 18;   // per second (slower regen)
    this._sprintRegenDelay = 1200; // ms before regen starts after sprint
    this._lastSprintTime = 0;
    this.isScoping = false; // right-click zoom / scope state
    this.weaponSystem = new WeaponSystem(scene);
    this.weaponSystem._ownerRef = this;
    this.weaponSystem._ownerTeam = 'a';
    this.weaponSystem.equip(this.charDef.weapon || 'assaultRifle');
    this._setupViewmodel();
    this.keys = {}; this.mouse = {}; this._prevFire = false;
    this._bindInput();
    // Coyote time + jump buffer for better game feel
    this._coyoteTime = 0;
    this._jumpBuffer = 0;
  }

  _setupViewmodel() {
    if (this._vm) this.camera.remove(this._vm);
    this._vm = new THREE.Group();
    if (this.weaponSystem.viewMesh) {
      const m = this.weaponSystem.viewMesh.clone();
      const isMelee = this.weaponSystem.isMelee();
      if (isMelee) {
        m.position.set(0.18, -0.16, -0.28); m.rotation.set(-0.3, Math.PI + 0.2, 0.15);
      } else {
        m.position.set(0.2, -0.2, -0.38); m.rotation.y = Math.PI;
      }
      this._vm.add(m);
    }
    this.camera.add(this._vm);
  }

  _bindInput() {
    this._kd = e => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR' && !this.weaponSystem.isMelee()) this.weaponSystem.startReload();
      if (e.code === 'KeyE') this._ability('e');
      if (e.code === 'KeyQ') this._ability('q');
      if (e.code === 'KeyF') this._ability('f');
      if (e.code === 'Space') this._jumpBuffer = 200;
    };
    this._ku = e => { this.keys[e.code] = false; };
    this._mm = e => {
      if (document.pointerLockElement !== document.getElementById('game-canvas')) return;
      const s = this.config.sensitivity;
      this.yaw   -= e.movementX * s;
      // movementY > 0 = mouse moved down = look down = NEGATIVE pitch in Three.js YXZ (positive = up)
      this.pitch -= e.movementY * s * (this.config.invertY ? -1 : 1);
      this.pitch  = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
    };
    this._md = e => { this.mouse[e.button] = true; };
    this._mu = e => { this.mouse[e.button] = false; };
    this._rc = e => { if (e.button === 2) { this.isAiming = !this.isAiming; this.isScoping = this.isAiming; e.preventDefault(); } };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup',   this._ku);
    document.addEventListener('mousemove', this._mm);
    document.addEventListener('mousedown', this._md);
    document.addEventListener('mouseup',   this._mu);
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  _ability(key) {
    if (this.abilityCooldowns[key] > 0 || !this.isAlive) return;
    const ab = this.charDef.abilities[key]; if (!ab) return;
    this.abilityCooldowns[key] = ab.cooldown * 1000;
    const t = ab.type;
    const pos = this.position.clone();
    const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
    this._abilityFlash(ab);

    // Broadcast ability to multiplayer peers
    if (window._game?.net?.isConnected) {
      window._game.net.sendAbilityEvent(this, key);
    }

    // ── Helpers: targeting enemies (real instances only) ──
    const _getAllEnemies = () => {
      const targets = [];
      if (window._allUnits) {
        for (const u of window._allUnits) {
          if (!u || !u.isAlive) continue;
          if (u.isPlayer) continue;
          // Only enemies (different team), but accept ffa entries too
          if (u.team !== undefined && u.team === this.team) continue;
          targets.push(u);
        }
      }
      return targets;
    };
    const _getNearestEnemy = (maxRange = 999) => {
      let nearest = null, nearD = maxRange;
      for (const u of _getAllEnemies()) {
        const d = this.position.distanceTo(u.position);
        if (d < nearD) { nearD = d; nearest = u; }
      }
      return nearest;
    };
    const _getEnemiesInRadius = (center, radius) =>
      _getAllEnemies().filter(u => u.position.distanceTo(center) < radius);

    // Route all damage through game._applyDamage so kills fire respawn,
    // score updates, kill-streak, and multiplayer events correctly.
    const _dmg = (u, amount) => {
      if (!u || !u.isAlive) return;
      const g = window._game;
      if (g && typeof g._applyDamage === 'function') {
        const killed = g._applyDamage(u, amount);
        if (killed && !u.isPlayer && !u.isRemote) {
          if (g.player) {
            g.player.kills++;
            g.hud?.killNotif?.(u.name || 'ENEMY');
            g.hud?.killfeed?.('YOU', u.name || 'ENEMY', ab.name || 'ABILITY', true);
            g._addScore?.(g.player.team || 'a', 'local');
            g._recordKill?.();
            g._spawnScorePopup?.(100, 'ABILITY KILL');
          }
        }
        if (killed && u.isRemote && g.net?.isConnected) {
          g.net.sendDamageEvent(u.id, 9999, g.net._getMyName(), ab.name || 'ABILITY');
        }
      } else if (typeof u.takeDamage === 'function') {
        u.takeDamage(amount);
      }
      if (u.position) this._spawnExecuteEffect(u.position.clone());
    };
    const _applyAoeDmg = (center, radius, dmg) => {
      for (const u of _getEnemiesInRadius(center, radius)) _dmg(u, dmg);
    };
    const _flashScreen = (color, dur=400) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:9998;opacity:0.85;transition:opacity ${dur}ms ease`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), dur); });
    };

    if (t === 'dash') {
      // Powerful dash: invincible during, leaves damaging afterimage trail
      const d = new THREE.Vector3(fwd.x, 0.15, fwd.z).normalize();
      this.velocity.x = d.x * 38;
      this.velocity.z = d.z * 38;
      this.velocity.y = Math.max(this.velocity.y + 4, 6);
      this.isInvincible = true;
      this.isGrounded = false;
      this._spawnAfterimage(pos);
      // Damage enemies in dash path
      const dashEnd = pos.clone().addScaledVector(d, 10);
      _applyAoeDmg(pos.clone().addScaledVector(d, 5), 3, ab.name.includes('Blade') ? 80 : 50);
      setTimeout(() => { this.isInvincible = false; }, 300);

    } else if (t === 'movement') {
      // Wall Run / Speed Surge: major speed + air control
      this.speedMult = 3.5; this.isGrounded = false;
      this.velocity.y = Math.max(this.velocity.y, 10);
      this.velocity.x += fwd.x * 28;
      this.velocity.z += fwd.z * 28;
      this.damageMult = 1.4; // bonus damage while rushing
      this._spawnBoostAura(pos, ab);
      const dur = ab.name.includes('Surge') ? 3000 : 4000;
      setTimeout(() => { this.speedMult = 1; this.damageMult = 1; }, dur);

    } else if (t === 'teleport') {
      // Teleport: reliable long-range blink + deal damage at destination
      this._spawnTeleportDecal(pos);
      const teleDir = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const range = ab.name.includes('Dimension') ? 18 : 14;
      const dest = pos.clone().addScaledVector(teleDir, range);
      dest.y = Math.max(dest.y, 0.5);
      this.position.copy(dest);
      this.position.y += 0.8;
      this.velocity.set(0, 0, 0);
      this._spawnTeleportDecal(dest);
      // Brief invincibility on arrival
      this.isInvincible = true;
      setTimeout(() => { this.isInvincible = false; }, 350);
      // Damage enemies caught at teleport destination
      _applyAoeDmg(dest, 4, 35);

    } else if (t === 'boost') {
      const durMap = { 'Overclock': 6000, 'Apex Predator': 8000, 'Ragnarok': 6000, 'Death Machine': 8000, 'Spin Up': 4000, 'Precision Protocol': 6000, 'Speed Surge': 3000, 'Blood Frenzy': 8000, 'RAMPAGE': 6000 };
      const dur = durMap[ab.name] || 6000;
      const dmgBoost = (ab.name.includes('Ragnarok') || ab.name.includes('RAMPAGE') || ab.name.includes('Predator')) ? 2.5 : ab.name.includes('Damage') ? 2.0 : ab.name.includes('Spin') ? 0.9 : 1.7;
      const spdBoost = ab.name.includes('Surge') ? 3.5 : ab.name.includes('Protocol') ? 1.0 : ab.name.includes('Spin') ? 0.3 : 1.6;
      this.speedMult = spdBoost; this.damageMult = dmgBoost;
      if (ab.name.includes('Ragnarok') || ab.name.includes('RAMPAGE')) {
        this.isInvincible = true;
        setTimeout(() => { this.isInvincible = false; }, dur);
      }
      if (ab.name.includes('Apex') || ab.name.includes('Overclock')) {
        // Infinite ammo effect: keep refilling clip
        this._boostInfiniteAmmo = true;
        setTimeout(() => { this._boostInfiniteAmmo = false; }, dur);
      }
      this._spawnBoostAura(pos, ab);
      setTimeout(() => { this.speedMult = 1; this.damageMult = 1; }, dur);
      _flashScreen(`rgba(255,200,0,0.3)`, 300);

    } else if (t === 'invis' || t === 'phantom') {
      const dur = t === 'phantom' ? 5000 : (ab.name.includes('Cloak') ? 10000 : 3500);
      this.isInvisible = true;
      if (this._vm) this._vm.visible = false;
      if (t === 'phantom') {
        this.isInvincible = true; this.speedMult = 1.9; this.damageMult = 2.0;
        setTimeout(() => { this.isInvincible = false; this.speedMult = 1; this.damageMult = 1; }, dur);
      } else {
        this.speedMult = 1.3;
        setTimeout(() => { this.speedMult = 1; }, dur);
      }
      this._spawnInvisEffect(pos);
      setTimeout(() => {
        this.isInvisible = false;
        if (this._vm) this._vm.visible = true;
        this._spawnInvisEffect(this.position.clone());
        // Breaking invis bursts for +25% speed briefly
        this.speedMult = Math.max(this.speedMult, 1.25);
        setTimeout(() => { if (this.speedMult === 1.25) this.speedMult = 1; }, 1200);
      }, dur);

    } else if (t === 'shield') {
      const dur = ab.name.includes('Siege') ? 8000 : ab.name.includes('Iron Skin') ? 3000 : ab.name.includes('Bulwark') ? 3000 : 2500;
      const dmgReduction = ab.name.includes('Iron') ? 0.70 : 0.999; // 70% or full invincibility
      this.isInvincible = true;
      if (ab.name.includes('Siege')) {
        this.speedMult = 0; this.damageMult = 2.5;
        setTimeout(() => { this.speedMult = 1; this.damageMult = 1; }, dur);
      }
      // Reflect damage back (Kira Reflect)
      if (ab.name.includes('Reflect')) {
        this._reflectActive = true;
        setTimeout(() => { this._reflectActive = false; }, dur);
      }
      this._spawnShieldBubble(pos, dur);
      setTimeout(() => { this.isInvincible = false; }, dur);

    } else if (t === 'grapple') {
      const gDir = fwd.clone(); gDir.y += 0.3; gDir.normalize();
      this.velocity.x = gDir.x * 52;
      this.velocity.y = Math.max(gDir.y * 52, 16);
      this.velocity.z = gDir.z * 52;
      this.isGrounded = false;
      // Damage enemy at landing spot
      const grappleEnd = pos.clone().addScaledVector(gDir, 16);
      setTimeout(() => { _applyAoeDmg(this.position, 4, 45); }, 400);

    } else if (t === 'aoe') {
      // AoE abilities — significantly boosted damage and radius
      const aultMap = { 'Nova Burst': {r:12,dmg:200}, 'Inferno': {r:14,dmg:55,dps:true,dur:4000}, 'Singularity': {r:16,dmg:180}, 'Thunderstorm': {r:12,dmg:50,dps:true,dur:6000}, 'Biohazard': {r:16,dmg:20,dps:true,dur:10000}, 'Permafrost': {r:14,dmg:60,slow:true,dur:8000}, 'Frost Nova': {r:8,dmg:80}, 'Storm Bolt': {r:6,dmg:90}, "Ancient's Wrath": {r:14,dmg:140}, 'Gale Force': {r:8,dmg:60}, 'Cyclone': {r:10,dmg:80}, 'Power Slam': {r:8,dmg:110}, 'THIS IS SPARTA': {r:5,dmg:120}, 'Storm of Blades': {r:16,dmg:180}, 'Eye of Ra': {r:9999,dmg:110}, 'Earthquake': {r:20,dmg:160}, 'The Flood': {r:16,dmg:20,dps:true,dur:8000}, 'Eruption': {r:12,dmg:280}, 'Total Swarm': {r:9999,dmg:15,dps:true,dur:6000}, 'Judgment': {r:10,dmg:220}, 'Crushed by Void': {r:15,dmg:280}, 'System Crash': {r:20,dmg:0,disable:true}, 'Death Lotus': {r:6,dmg:70}, 'Sands of Time': {r:12,dmg:0,slow:true,dur:4000}, 'Thousand Cuts': {r:9999,dmg:80,teleport:true}, 'Zero-G Zone': {r:16,dmg:0,float:true,dur:3000}, 'Tidal Wave': {r:10,dmg:60,push:true}, 'Swarm Cloud': {r:8,dmg:5,dps:true,dur:6000}, 'Rock Surge': {r:5,dmg:80,launch:true}, 'Magma Fist': {r:3,dmg:60} };
      const cfg = aultMap[ab.name] || { r:10, dmg:120 };
      const aoePos = cfg.teleport ? pos : pos.clone().addScaledVector(fwd, ab.name.includes('Slam') || ab.name.includes('Eruption') ? 3 : 6);
      this._spawnAoEEffect(aoePos, cfg.r > 20 ? 18 : cfg.r, ab);
      if (cfg.dps) {
        this._abilityAoE = { pos: aoePos, radius: cfg.r, dmg: cfg.dmg, duration: cfg.dur || 5000 };
      } else if (cfg.disable) {
        // EMP / System Crash: disable all enemies briefly
        for (const u of _getAllEnemies()) {
          u._stunExpiry = performance.now() + 5000;
          const old = u.speedMult || 1; u.speedMult = 0;
          setTimeout(() => { if (u) u.speedMult = old || 1; }, 5000);
        }
        _flashScreen('rgba(0,200,255,0.5)', 500);
      } else if (cfg.slow) {
        for (const u of _getEnemiesInRadius(aoePos, cfg.r)) {
          const old = u.speedMult || 1; u.speedMult = 0.35;
          setTimeout(() => { if(u) u.speedMult = old || 1; }, cfg.dur || 4000);
        }
        _applyAoeDmg(aoePos, cfg.r, cfg.dmg);
      } else if (cfg.push) {
        for (const u of _getEnemiesInRadius(aoePos, cfg.r)) {
          if (u.velocity) { const d = u.position.clone().sub(aoePos).normalize(); u.velocity.x += d.x*22; u.velocity.y += 8; u.velocity.z += d.z*22; }
          _dmg(u, cfg.dmg);
        }
      } else if (cfg.launch) {
        for (const u of _getEnemiesInRadius(aoePos, cfg.r)) {
          if (u.velocity) { u.velocity.y += 18; }
          _dmg(u, cfg.dmg);
        }
      } else if (cfg.float) {
        for (const u of _getEnemiesInRadius(aoePos, cfg.r)) {
          if (u.velocity) { u.velocity.y += 14; }
          const old = u.speedMult || 1; u.speedMult = 0.25;
          setTimeout(() => { if(u) u.speedMult = old || 1; }, cfg.dur || 3000);
        }
      } else if (cfg.teleport) {
        // Thousand Cuts: teleport to every enemy and hit them
        const enemies = _getAllEnemies();
        let delay = 0;
        for (const u of enemies.slice(0, 7)) {
          setTimeout(() => {
            if (!u.isAlive) return;
            this.position.copy(u.position).add(new THREE.Vector3(1.5, 0, 0));
            _dmg(u, cfg.dmg);
          }, delay);
          delay += 120;
        }
        setTimeout(() => {
          // Return to original pos
        }, delay);
      } else {
        _applyAoeDmg(aoePos, cfg.r, cfg.dmg);
      }

    } else if (t === 'smoke') {
      const smkPos = pos.clone().addScaledVector(fwd, 7); smkPos.y += 0.5;
      this._spawnSmokeCloud(smkPos, 5000);
      // Smoke also slows enemies inside it
      const _checkSmoke = () => {
        for (const u of _getEnemiesInRadius(smkPos, 5)) {
          u.speedMult = Math.min(u.speedMult || 1, 0.5);
        }
      };
      const smokeInterval = setInterval(_checkSmoke, 300);
      setTimeout(() => { clearInterval(smokeInterval); for(const u of _getEnemiesInRadius(smkPos, 5)) u.speedMult = 1; }, 5000);

    } else if (t === 'grenade') {
      // Throw grenade that deals real AoE damage on landing
      const vel = fwd.clone().multiplyScalar(24); vel.y += 12;
      this._throwGrenade(pos.clone().add(new THREE.Vector3(0,1.2,0)), vel, 'fire', 5000);
      // Register detonation AoE
      const gPos = pos.clone().addScaledVector(fwd, 12); gPos.y = 0;
      setTimeout(() => {
        _applyAoeDmg(gPos, 7, 90);
        this._spawnAoEEffect(gPos, 7, ab);
      }, 1200);

    } else if (t === 'flash') {
      const vel = fwd.clone().multiplyScalar(20); vel.y += 9;
      this._throwGrenade(pos.clone().add(new THREE.Vector3(0,1,0)), vel, 'flash', 300);
      // Temporarily slow enemies in area and flash screen
      const fPos = pos.clone().addScaledVector(fwd, 10);
      setTimeout(() => {
        _flashScreen('rgba(255,255,255,0.92)', 600);
        for (const u of _getEnemiesInRadius(fPos, 8)) {
          const old = u.speedMult || 1; u.speedMult = 0.25;
          setTimeout(() => { if(u) u.speedMult = old || 1; }, 2500);
        }
      }, 700);

    } else if (t === 'heal') {
      const healAmt = ab.name.includes('Revival') ? this.maxHealth : ab.name.includes('Nano') ? 80 : ab.name.includes('Holy') ? 50 : 45;
      const oldHp = this.health;
      this.health = Math.min(this.maxHealth, this.health + healAmt);
      this.shield = Math.min(this.charDef.maxShield, this.shield + 20);
      this._spawnHealRing(pos);
      // Show healed amount
      const gained = Math.round(this.health - oldHp);
      if (gained > 0) {
        const fl2 = document.createElement('div');
        fl2.style.cssText = 'position:fixed;top:42%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:22px;color:#00ff88;text-shadow:0 0 20px #00ff88;pointer-events:none;z-index:9999;animation:abilityPop 1.4s ease forwards';
        fl2.textContent = `+${gained} HP`; document.body.appendChild(fl2); setTimeout(() => fl2.remove(), 1400);
      }

    } else if (t === 'scan') {
      const scanDur = ab.name.includes('Omniscience') ? 10000 : ab.name.includes('Recon') ? 8000 : ab.name.includes('Haunt') ? 6000 : 5000;
      const scanRadius = ab.name.includes('Omniscience') || ab.name.includes('Takeover') ? 9999 : ab.name.includes('Recon') ? 40 : 32;
      this._spawnScanPulse(pos, scanDur);
      this._activateScan(scanRadius, scanDur);
      // Network Takeover: also disable all enemies
      if (ab.name.includes('Takeover')) {
        for (const u of _getAllEnemies()) {
          const old = u.speedMult || 1; u.speedMult = 0.3;
          setTimeout(() => { if(u) u.speedMult = old || 1; }, 8000);
        }
        _flashScreen('rgba(0,255,100,0.3)', 500);
      }

    } else if (t === 'trap') {
      const trapPos = pos.clone().addScaledVector(fwd, 6); trapPos.y = 0.05;
      this._placeTrap(trapPos);

    } else if (t === 'turret') {
      const turretPos = pos.clone().addScaledVector(fwd, 5); turretPos.y = 0.05;
      this._deployTurret(turretPos, 15000);

    } else if (t === 'hack') {
      // Disable closest enemy's movement + boost for 4s
      const hackTarget = _getNearestEnemy(20);
      if (hackTarget) {
        hackTarget._debuffMult = 1.5; hackTarget._debuffExpiry = performance.now() + 4000;
        const old = hackTarget.speedMult || 1; hackTarget.speedMult = 0;
        setTimeout(() => { if(hackTarget) { hackTarget.speedMult = old||1; hackTarget._debuffMult = 1; } }, 4000);
        this._spawnHackEffect(hackTarget.position.clone());
      }
      this._spawnHackEffect(pos.clone().addScaledVector(fwd, 4));

    } else if (t === 'utility') {
      // Disruption Field: slow + debuff all nearby enemies
      const dPos = pos.clone().addScaledVector(fwd, 4);
      this._spawnDisruptionField(dPos, 4000);
      for (const u of _getEnemiesInRadius(dPos, 7)) {
        u._debuffMult = 1.4; u._debuffExpiry = performance.now() + 4000;
        const old = u.speedMult || 1; u.speedMult = 0.5;
        setTimeout(() => { if(u) { u.speedMult = old||1; u._debuffMult = 1; } }, 4000);
      }

    } else if (t === 'revive') {
      // Revive beacon: heal self + create persistent healing zone
      this.health = Math.min(this.maxHealth, this.health + 40);
      this.shield = this.charDef.maxShield;
      this._spawnReviveBeacon(pos.clone(), 8000);
      this._spawnHealRing(pos);

    } else if (t === 'drain') {
      // Life Drain: siphon HP from nearest enemy over 3s — increased effectiveness
      this._activeDrain = { startTime: performance.now(), duration: 3500, dps: 35 };
      const drainTarget = _getNearestEnemy(12);
      if (drainTarget) {
        drainTarget._debuffMult = 1.3; drainTarget._debuffExpiry = performance.now() + 3500;
        this._spawnDrainEffect(drainTarget.position.clone());
      } else {
        this._spawnDrainEffect(pos.clone().addScaledVector(fwd, 4));
      }

    } else if (t === 'debuff') {
      // Hex Curse: mark ALL enemies in 20m for 6s massive damage multiplier
      let count = 0;
      for (const u of _getEnemiesInRadius(pos, 20)) {
        u._debuffMult = 2.2; u._debuffExpiry = performance.now() + 6000;
        this._spawnDebuffEffect(u.position.clone());
        count++;
      }
      if (count === 0) {
        // Target nearest enemy even if no one in range
        const n = _getNearestEnemy(40);
        if (n) { n._debuffMult = 2.2; n._debuffExpiry = performance.now() + 6000; this._spawnDebuffEffect(n.position.clone()); }
      }

    } else if (t === 'execute') {
      // Soul Rend: kill enemies below 20% HP + deal 200 to healthy ones nearby
      let executed = 0;
      for (const u of _getEnemiesInRadius(pos, 18)) {
        const hpPct = u.health / (u.maxHealth || 100);
        if (hpPct < 0.22) {
          _dmg(u, 99999); executed++;
        } else {
          _dmg(u, 60); // chunk damage even if not dying
        }
      }
      // High Noon: guaranteed kill on nearest low-HP enemy regardless of range
      if (ab.name.includes('High Noon') || ab.name.includes('All In')) {
        const target = _getNearestEnemy(50);
        if (target && target.health / (target.maxHealth||100) < 0.35) {
          _dmg(target, 99999);
        }
      }
      if (executed > 0) {
        const fl2 = document.createElement('div');
        fl2.style.cssText = 'position:fixed;top:36%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:22px;font-weight:900;color:#ff0044;text-shadow:0 0 20px #ff0044;pointer-events:none;z-index:9999;animation:abilityPop 1.2s ease forwards';
        fl2.textContent = `☠ EXECUTE x${executed}`; document.body.appendChild(fl2); setTimeout(() => fl2.remove(), 1200);
      }

    } else if (t === 'beam') {
      // Solar Ray / Spectrum Beam: continuous damaging beam — boosted DPS
      const dps = ab.name.includes('Spectrum') ? 80 : ab.name.includes('Solar') ? 55 : 45;
      const beamDur = ab.name.includes('Spectrum') ? 4000 : 3000;
      this._activeBeam = { startTime: performance.now(), duration: beamDur, dps, dir: fwd.clone() };
      this._spawnBeamEffect(pos.clone(), fwd.clone(), beamDur);

    } else if (t === 'projectile') {
      // Arcane Bolt / Spear Throw: powerful piercing projectile
      const vel = fwd.clone().multiplyScalar(28); vel.y += 1;
      this._throwGrenade(pos.clone().add(new THREE.Vector3(0,1.2,0)), vel, 'arcane', 200);
      // Also deal damage to anything in path immediately
      const projPos = pos.clone().addScaledVector(fwd, 4);
      _applyAoeDmg(projPos, 1.5, ab.name.includes('Spear') ? 100 : 85);

    } else if (t === 'siege') {
      const dur = 8000;
      this.speedMult = 0; this.isInvincible = true; this.damageMult = 3.0;
      this._spawnBoostAura(pos, ab);
      _flashScreen('rgba(255,150,0,0.3)', 300);
      setTimeout(() => { this.speedMult = 1; this.isInvincible = false; this.damageMult = 1; }, dur);

    } else if (t === 'summon') {
      const dur = 10000;
      this.damageMult = 2.2; this.speedMult = 1.4; this.isInvincible = true;
      this._spawnBoostAura(pos, ab);
      this._spawnMechEffect(pos.clone(), dur);
      // Mech slam on deploy
      _applyAoeDmg(pos, 10, 100);
      setTimeout(() => { this.damageMult = 1; this.speedMult = 1; this.isInvincible = false; }, dur);

    } else if (t === 'random') {
      // Casino All In: RNG outcome — all outcomes are powerful
      const roll = Math.random();
      if (roll < 0.33) {
        // JACKPOT: massive AoE nuke
        _applyAoeDmg(pos, 14, 600);
        this._spawnAoEEffect(pos.clone(), 14, ab);
        _flashScreen('rgba(255,100,0,0.6)', 400);
      } else if (roll < 0.66) {
        // FULL RESTORE: heal + shield + speedboost
        this.health = this.maxHealth; this.shield = this.charDef.maxShield;
        this.speedMult = 1.6; this.damageMult = 1.6;
        this._spawnHealRing(pos);
        setTimeout(() => { this.speedMult = 1; this.damageMult = 1; }, 6000);
        _flashScreen('rgba(0,255,100,0.4)', 400);
      } else {
        // STUN ALL: freeze all enemies 5s
        for (const u of _getAllEnemies()) {
          const old = u.speedMult||1; u.speedMult = 0;
          setTimeout(() => { if(u) u.speedMult = old||1; }, 5000);
        }
        this._spawnAoEEffect(pos.clone(), 12, ab);
        _flashScreen('rgba(200,0,255,0.4)', 400);
      }

    } else if (t === 'transform') {
      const dur = 10000;
      this.damageMult = 2.5; this.speedMult = 1.5; this.isInvincible = true;
      this._spawnBoostAura(pos, ab);
      _flashScreen('rgba(150,0,255,0.4)', 400);
      setTimeout(() => { this.damageMult = 1; this.speedMult = 1; this.isInvincible = false; }, dur);

    } else if (t === 'melee') {
      // Holy Strike / Iaido Slash: powerful melee strike
      const meleeDmg = ab.name.includes('Holy') ? 100 : ab.name.includes('Iaido') ? 130 : 80;
      const target = _getNearestEnemy(5);
      if (target) {
        _dmg(target, meleeDmg);
        if (ab.name.includes('Holy')) { this.health = Math.min(this.maxHealth, this.health + 35); this._spawnHealRing(pos); }
      }
      // AoE around self too
      _applyAoeDmg(pos, 4, Math.round(meleeDmg * 0.5));
    }
  }


  // ── ABILITY VFX ────────────────────────────────────────────────────────

  _spawnDrainEffect(pos) {
    const col = new THREE.Color(0xff0044);
    const lt = new THREE.PointLight(col, 5, 6); lt.position.copy(pos); this.scene.add(lt);
    const t0 = performance.now();
    const tick = () => { const p = (performance.now()-t0)/3000; lt.intensity = 5*(1-p); if(p<1) requestAnimationFrame(tick); else this.scene.remove(lt); };
    requestAnimationFrame(tick);
  }
  _spawnDebuffEffect(pos) {
    const col = new THREE.Color(0x880000);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7,0.07,8,24), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9}));
    ring.position.copy(pos).add(new THREE.Vector3(0,1,0)); ring.rotation.x = -Math.PI/2; this.scene.add(ring);
    const t0 = performance.now();
    const tick = () => { const p=(performance.now()-t0)/600; ring.scale.setScalar(1+p*2); ring.material.opacity=Math.max(0,0.9*(1-p)); if(p<1) requestAnimationFrame(tick); else this.scene.remove(ring); };
    requestAnimationFrame(tick);
  }
  _spawnExecuteEffect(pos) {
    const lt = new THREE.PointLight(0xff0000, 18, 8); lt.position.copy(pos); this.scene.add(lt);
    const t0 = performance.now();
    const tick = () => { const p=(performance.now()-t0)/500; lt.intensity=18*(1-p); if(p<1) requestAnimationFrame(tick); else this.scene.remove(lt); };
    requestAnimationFrame(tick);
    const fl = document.createElement('div');
    fl.style.cssText = 'position:fixed;top:36%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:22px;font-weight:900;color:#ff0044;text-shadow:0 0 20px #ff0044;pointer-events:none;z-index:9999;animation:abilityPop 1.2s ease forwards';
    fl.textContent = '☠ EXECUTE'; document.body.appendChild(fl); setTimeout(()=>fl.remove(),1200);
  }
  _spawnBeamEffect(pos, dir, dur) {
    const col = new THREE.Color(this.charDef.accentColor);
    const lt = new THREE.PointLight(col, 8, 10); lt.position.copy(pos).addScaledVector(dir, 5); this.scene.add(lt);
    const t0 = performance.now();
    const tick = () => { const t = performance.now()-t0; lt.intensity = 6+Math.sin(t*0.01)*2; lt.position.copy(this.position).addScaledVector(dir,5); if(t<dur) requestAnimationFrame(tick); else this.scene.remove(lt); };
    requestAnimationFrame(tick);
  }
  _spawnMechEffect(pos, dur) {
    const col = new THREE.Color(this.charDef.accentColor);
    const lt = new THREE.PointLight(col, 10, 8); lt.position.copy(pos).add(new THREE.Vector3(0,2,0)); this.scene.add(lt);
    const t0 = performance.now();
    const tick = () => { const t=performance.now()-t0; lt.intensity=8+Math.sin(t*0.006)*2; if(t<dur) requestAnimationFrame(tick); else this.scene.remove(lt); };
    requestAnimationFrame(tick);
    const fl = document.createElement('div');
    fl.style.cssText = 'position:fixed;top:36%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:20px;font-weight:900;color:#ffcc00;text-shadow:0 0 20px #ffcc00;pointer-events:none;z-index:9999;animation:abilityPop 1.2s ease forwards';
    fl.textContent = '🦾 TITAN DEPLOYED'; document.body.appendChild(fl); setTimeout(()=>fl.remove(),1200);
  }

  // ── Ability VFX (kept from original, condensed) ──────────────────────────
  _abilityFlash(ab) {
    const col = new THREE.Color(this.charDef.accentColor);
    const fl = new THREE.PointLight(col, 12, 8); fl.position.copy(this.position).add(new THREE.Vector3(0,1,0)); this.scene.add(fl);
    const t0 = performance.now();
    const tick = () => { const p = Math.min(1,(performance.now()-t0)/350); fl.intensity = 12*(1-p); if(p<1) requestAnimationFrame(tick); else this.scene.remove(fl); };
    requestAnimationFrame(tick);
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:38%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:18px;font-weight:900;text-shadow:0 0 18px currentColor;pointer-events:none;z-index:9999;animation:abilityPop 1.2s ease forwards';
    div.style.color = this.charDef.color; div.textContent = ab.icon + ' ' + ab.name.toUpperCase();
    document.body.appendChild(div); setTimeout(()=>div.remove(),1200);
  }
  _spawnAfterimage(pos) {
    const col = new THREE.Color(this.charDef.accentColor);
    const m = new THREE.Mesh(THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.25,1.2,4,8) : new THREE.BoxGeometry(0.5,1.8,0.3), new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.55}));
    m.position.copy(pos); this.scene.add(m);
    const t0=performance.now(); const fade=()=>{ const p=(performance.now()-t0)/500; m.material.opacity=Math.max(0,0.55*(1-p)); if(p<1)requestAnimationFrame(fade); else this.scene.remove(m); }; requestAnimationFrame(fade);
  }
  _spawnTeleportDecal(pos) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.6,0.05,8,24),new THREE.MeshBasicMaterial({color:this.charDef.accentColor,transparent:true,opacity:0.9}));
    ring.position.copy(pos); ring.position.y=0.05; ring.rotation.x=-Math.PI/2; this.scene.add(ring);
    const t0=performance.now(); const ex=()=>{ const p=(performance.now()-t0)/700; ring.scale.setScalar(1+p*2); ring.material.opacity=Math.max(0,0.9*(1-p)); if(p<1)requestAnimationFrame(ex); else this.scene.remove(ring); }; requestAnimationFrame(ex);
  }
  _spawnBoostAura(pos, ab) {
    const col=new THREE.Color(this.charDef.accentColor);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.06,8,36),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.8}));
    ring.position.copy(pos).add(new THREE.Vector3(0,0.2,0)); ring.rotation.x=-Math.PI/2; this.scene.add(ring);
    const lt=new THREE.PointLight(col,6,5); lt.position.copy(pos).add(new THREE.Vector3(0,1,0)); this.scene.add(lt);
    const t0=performance.now(), dur=6000;
    const pulse=()=>{ const t=performance.now()-t0; ring.scale.setScalar(1+Math.sin(t*0.005)*0.12); lt.intensity=4+Math.sin(t*0.008)*2; if(t<dur)requestAnimationFrame(pulse); else{this.scene.remove(ring);this.scene.remove(lt);} };
    requestAnimationFrame(pulse);
  }
  _spawnInvisEffect(pos) {
    const col=new THREE.Color(this.charDef.accentColor);
    for(let i=0;i<10;i++){ const p=new THREE.Mesh(new THREE.SphereGeometry(0.06+Math.random()*0.06,4,4),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9})); const a=(i/10)*Math.PI*2; p.position.set(pos.x+Math.cos(a)*0.5,pos.y+0.5+Math.random()*1.4,pos.z+Math.sin(a)*0.5); this.scene.add(p); const t0=performance.now(); const tick=()=>{ const t=(performance.now()-t0)/600; p.position.y+=0.012; p.material.opacity=Math.max(0,0.9*(1-t)); if(t<1)requestAnimationFrame(tick); else this.scene.remove(p); }; requestAnimationFrame(tick); }
  }
  _spawnShieldBubble(pos, dur) {
    const col=new THREE.Color(this.charDef.accentColor);
    const bubble=new THREE.Mesh(new THREE.SphereGeometry(1.1,18,14),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.22,side:THREE.BackSide,depthWrite:false}));
    bubble.position.copy(pos).add(new THREE.Vector3(0,0.9,0)); this.scene.add(bubble);
    const lt=new THREE.PointLight(col,4,4); lt.position.copy(bubble.position); this.scene.add(lt);
    const t0=performance.now(); const pulse=()=>{ const t=performance.now()-t0; bubble.material.opacity=0.18+Math.sin(t*0.006)*0.06; lt.intensity=3+Math.sin(t*0.008)*1; if(t<dur)requestAnimationFrame(pulse); else{this.scene.remove(bubble);this.scene.remove(lt);} };
    requestAnimationFrame(pulse);
  }
  _spawnAoEEffect(pos, radius, ab) {
    const col=new THREE.Color(this.charDef.accentColor);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,0.12,8,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.9}));
    ring.position.copy(pos); ring.rotation.x=-Math.PI/2; this.scene.add(ring);
    const lt=new THREE.PointLight(col,12,radius*1.5); lt.position.copy(pos).add(new THREE.Vector3(0,1,0)); this.scene.add(lt);
    const t0=performance.now(); const ex=()=>{ const p=(performance.now()-t0)/700; ring.scale.setScalar(1+p*0.4); ring.material.opacity=Math.max(0,0.9*(1-p)); lt.intensity=Math.max(0,12*(1-p)); if(p<1)requestAnimationFrame(ex); else{this.scene.remove(ring);this.scene.remove(lt);} };
    requestAnimationFrame(ex);
  }
  _spawnSmokeCloud(pos, dur) {
    const smoke=new THREE.Mesh(new THREE.SphereGeometry(3.5,8,6),new THREE.MeshBasicMaterial({color:0x445566,transparent:true,opacity:0.55,depthWrite:false}));
    smoke.position.copy(pos); this.scene.add(smoke);
    const t0=performance.now(); const tick=()=>{ if(performance.now()-t0<dur)requestAnimationFrame(tick); else{const fade=()=>{ smoke.material.opacity=Math.max(0,smoke.material.opacity-0.012); if(smoke.material.opacity>0)requestAnimationFrame(fade); else this.scene.remove(smoke); }; requestAnimationFrame(fade); } };
    requestAnimationFrame(tick);
  }
  _spawnFireZone(pos, radius, dur) {
    const col=0xff4400;
    const disk=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,0.15,18),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.4,depthWrite:false}));
    disk.position.copy(pos); disk.position.y=0.1; this.scene.add(disk);
    const lt=new THREE.PointLight(col,4,radius*1.5); lt.position.copy(pos).add(new THREE.Vector3(0,1,0)); this.scene.add(lt);
    const t0=performance.now(); const tick=()=>{ const t=performance.now()-t0; lt.intensity=3+Math.sin(t*0.012)*1.5; if(t<dur)requestAnimationFrame(tick); else{this.scene.remove(disk);this.scene.remove(lt);} };
    requestAnimationFrame(tick);
  }
  _throwGrenade(startPos, vel, type, lingerDur) {
    const col=type==='flash'?0xffffaa:0xff4400;
    const g=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),new THREE.MeshBasicMaterial({color:col}));
    g.position.copy(startPos); this.scene.add(g);
    const v=vel.clone(); const t0=performance.now();
    const fly=()=>{ const dt=0.016; v.y-=14*dt; g.position.addScaledVector(v,dt); if(performance.now()-t0>1500||g.position.y<0.2){ this.scene.remove(g); if(type==='fire')this._spawnFireZone(g.position.clone(),4,lingerDur); else if(type==='flash'){const fl=document.createElement('div');fl.style.cssText='position:fixed;inset:0;background:#fff;opacity:0.85;pointer-events:none;z-index:9999;transition:opacity 1.5s';document.body.appendChild(fl);requestAnimationFrame(()=>{fl.style.opacity='0';setTimeout(()=>fl.remove(),1500);}); } return; } requestAnimationFrame(fly); };
    requestAnimationFrame(fly);
  }
  _spawnHealRing(pos) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,0.06,8,36),new THREE.MeshBasicMaterial({color:0x00ff88,transparent:true,opacity:0.9}));
    ring.position.copy(pos).add(new THREE.Vector3(0,0.3,0)); ring.rotation.x=-Math.PI/2; this.scene.add(ring);
    const lt=new THREE.PointLight(0x00ff88,5,6); lt.position.copy(ring.position); this.scene.add(lt);
    const t0=performance.now(); const ex=()=>{ const p=(performance.now()-t0)/800; ring.scale.setScalar(1+p*1.5); ring.material.opacity=Math.max(0,0.9*(1-p)); lt.intensity=Math.max(0,5*(1-p)); if(p<1)requestAnimationFrame(ex); else{this.scene.remove(ring);this.scene.remove(lt);} };
    requestAnimationFrame(ex);
    const hpDiv=document.createElement('div'); hpDiv.style.cssText='position:fixed;top:42%;left:50%;transform:translateX(-50%);font-family:Orbitron,monospace;font-size:22px;color:#00ff88;text-shadow:0 0 20px #00ff88;pointer-events:none;z-index:9999;animation:abilityPop 1.4s ease forwards'; hpDiv.textContent='+HP'; document.body.appendChild(hpDiv); setTimeout(()=>hpDiv.remove(),1400);
  }
  _spawnScanPulse(pos) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.04,8,36),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.9}));
    ring.position.copy(pos).add(new THREE.Vector3(0,0.5,0)); ring.rotation.x=-Math.PI/2; this.scene.add(ring);
    const t0=performance.now(); const ex=()=>{ const p=(performance.now()-t0)/1200; ring.scale.setScalar(1+p*40); ring.material.opacity=Math.max(0,0.7*(1-p)); if(p<1)requestAnimationFrame(ex); else this.scene.remove(ring); }; requestAnimationFrame(ex);
  }
  _activateScan(radius, duration) {
    // Expose scan state to game.js minimap + world labels
    window._scanActive = true;
    window._scanRadius = radius;
    window._scanExpiry = performance.now() + duration;

    // Build list of enemy unit IDs within radius (all bots/players)
    const myPos = this.position;
    const enemies = window._allUnits || [];
    const revealed = new Set();
    for (const u of enemies) {
      if (!u || u.team === this.team) continue;
      const dx = u.position.x - myPos.x, dz = u.position.z - myPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist <= radius) {
        if (u.id) revealed.add(u.id);
        if (u.peerId) revealed.add(u.peerId);
      }
    }
    window._scannedEnemies = [...revealed];

    // Screen flash: blue pulse
    const fl = document.createElement('div');
    fl.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle,rgba(0,150,255,0.22) 0%,rgba(0,80,200,0.06) 60%,transparent 100%);pointer-events:none;z-index:9990;transition:opacity 0.8s';
    document.body.appendChild(fl);
    requestAnimationFrame(() => { fl.style.opacity = '0'; setTimeout(() => fl.remove(), 800); });

    // Clear scan after duration
    clearTimeout(this._scanTimeout);
    this._scanTimeout = setTimeout(() => {
      window._scanActive = false;
      window._scannedEnemies = [];
      window._scanRadius = 0;
    }, duration);
  }

  _placeTrap(pos) {
    const col=new THREE.Color(this.charDef.accentColor);
    const trap=new THREE.Mesh(new THREE.TorusGeometry(0.4,0.05,8,18),new THREE.MeshBasicMaterial({color:col}));
    trap.position.copy(pos); trap.position.y=0.05; trap.rotation.x=-Math.PI/2; this.scene.add(trap);
    const lt=new THREE.PointLight(col,2,3); lt.position.copy(pos).add(new THREE.Vector3(0,0.3,0)); this.scene.add(lt);
    this._activeTrap={pos:pos.clone(),mesh:trap,light:lt,active:true};
    const t0=performance.now(); const pulse=()=>{ if(!this._activeTrap?.active){this.scene.remove(trap);this.scene.remove(lt);return;} const t=performance.now()*0.003; lt.intensity=1.5+Math.sin(t)*0.8; if(performance.now()-t0<12000)requestAnimationFrame(pulse); else{this.scene.remove(trap);this.scene.remove(lt);this._activeTrap=null;} }; requestAnimationFrame(pulse);
  }
  _deployTurret(pos, dur) {
    const col=new THREE.Color(this.charDef.accentColor);
    const base=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.4),new THREE.MeshStandardMaterial({color:0x333333,metalness:0.8}));
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.4,8),new THREE.MeshStandardMaterial({color:0x555555,metalness:0.9}));
    barrel.rotation.z=Math.PI/2; barrel.position.set(0.3,0.15,0);
    const lt=new THREE.PointLight(col,2,4); lt.position.set(0,0.5,0);
    const turret=new THREE.Group(); turret.add(base,barrel,lt);
    turret.position.copy(pos); this.scene.add(turret);
    this._activeTurret={mesh:turret,pos:pos.clone(),active:true,lastShot:0};
    const t0=performance.now(); const tick=()=>{ if(!this._activeTurret?.active){this.scene.remove(turret);return;} const age=performance.now()-t0; lt.intensity=1.5+Math.sin(age*0.005)*0.5; if(age<dur)requestAnimationFrame(tick); else{this.scene.remove(turret);this._activeTurret=null;} };
    requestAnimationFrame(tick);
    setTimeout(()=>{if(this._activeTurret){this.scene.remove(this._activeTurret.mesh);this._activeTurret=null;}},dur);
  }
  _spawnHackEffect(pos) {
    const col=new THREE.Color(this.charDef.accentColor);
    for(let i=0;i<8;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.06),new THREE.MeshBasicMaterial({color:col,transparent:true})); const a=(i/8)*Math.PI*2,r=1.2+Math.random(); p.position.set(pos.x+Math.cos(a)*r,pos.y+0.5+Math.random()*1.5,pos.z+Math.sin(a)*r); this.scene.add(p); const t0=performance.now(); const tick=()=>{ const t=(performance.now()-t0)/4000; p.rotation.x+=0.05; p.rotation.y+=0.08; p.material.opacity=Math.max(0,0.8*(1-t)); if(t<1)requestAnimationFrame(tick); else this.scene.remove(p); }; requestAnimationFrame(tick); }
  }
  _spawnDisruptionField(pos, dur) {
    const mat=new THREE.MeshBasicMaterial({color:0x4400ff,transparent:true,opacity:0.15,side:THREE.DoubleSide});
    const disk=new THREE.Mesh(new THREE.CylinderGeometry(4,4,0.2,24),mat);
    disk.position.copy(pos); this.scene.add(disk);
    const lt=new THREE.PointLight(0x4400ff,3,8); lt.position.copy(pos).add(new THREE.Vector3(0,1,0)); this.scene.add(lt);
    const t0=performance.now(); const fade=()=>{ const p=(performance.now()-t0)/dur; disk.material.opacity=Math.max(0,0.15*(1-p)); lt.intensity=Math.max(0,3*(1-p)); if(p<1)requestAnimationFrame(fade); else{this.scene.remove(disk);this.scene.remove(lt);} };
    requestAnimationFrame(fade);
  }
  _spawnReviveBeacon(pos, dur) {
    const col=new THREE.Color(0xff44aa);
    const beacon=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,1.2,8),new THREE.MeshStandardMaterial({color:0xcc2288,emissive:col,emissiveIntensity:1.5}));
    beacon.position.copy(pos).add(new THREE.Vector3(0,0.6,0));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.6,0.04,8,24),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.8}));
    ring.position.copy(pos).add(new THREE.Vector3(0,0.1,0)); ring.rotation.x=-Math.PI/2;
    const lt=new THREE.PointLight(col,3,5); lt.position.copy(beacon.position);
    this.scene.add(beacon); this.scene.add(ring); this.scene.add(lt);
    const t0=performance.now(); const pulse=()=>{ const t=performance.now()*0.002; lt.intensity=2+Math.sin(t)*1; ring.scale.setScalar(1+Math.sin(t*2)*0.1); if(performance.now()-t0<dur)requestAnimationFrame(pulse); else{this.scene.remove(beacon);this.scene.remove(ring);this.scene.remove(lt);} };
    requestAnimationFrame(pulse);
  }

  // ── Main update ───────────────────────────────────────────────────────────
  update(delta, colliders) {
    if (!this.isAlive) return null;
    const dt = delta / 1000;

    // Camera rotation
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    // Movement
    let mx = 0, mz = 0;
    if (this.keys['KeyW']  || this.keys['ArrowUp'])    mz = -1;
    if (this.keys['KeyS']  || this.keys['ArrowDown'])  mz =  1;
    if (this.keys['KeyA']  || this.keys['ArrowLeft'])  mx = -1;
    if (this.keys['KeyD']  || this.keys['ArrowRight']) mx =  1;
    const len = Math.sqrt(mx*mx + mz*mz);
    if (len > 0) { mx /= len; mz /= len; }

    const wantSprint = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && len > 0;
    // Limited sprint: only sprint if stamina > 0
    this.isSprinting = wantSprint && this.stamina > 0;
    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - this._sprintDrainRate * dt);
      this._lastSprintTime = performance.now();
    } else {
      // Regen stamina after delay
      if (performance.now() - this._lastSprintTime > this._sprintRegenDelay) {
        this.stamina = Math.min(this.maxStamina, this.stamina + this._sprintRegenRate * dt);
      }
    }
    this.isCrouching = !!(this.keys['ControlLeft'] || this.keys['KeyC']);
    const baseSpeed = 10 * (this.charDef.speed || 1.0) * this.speedMult;
    const speed = this.isSprinting ? baseSpeed * 1.55 : this.isCrouching ? baseSpeed * 0.5 : baseSpeed;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = fwd.clone().multiplyScalar(-mz).addScaledVector(rgt, mx);

    this.velocity.x += (move.x * speed - this.velocity.x) * (this.isGrounded ? 0.28 : 0.06);
    this.velocity.z += (move.z * speed - this.velocity.z) * (this.isGrounded ? 0.28 : 0.06);

    // Gravity
    if (!this.isGrounded) this.velocity.y -= 26 * dt;

    // Jump with coyote time + buffer
    if (this.isGrounded) this._coyoteTime = 120;
    else this._coyoteTime = Math.max(0, this._coyoteTime - delta);
    this._jumpBuffer = Math.max(0, this._jumpBuffer - delta);

    if (this._jumpBuffer > 0 && this._coyoteTime > 0) {
      this.velocity.y = 11.5;
      this._coyoteTime = 0; this._jumpBuffer = 0;
      this.isGrounded = false;
    }

    // Move + collide
    this.position.addScaledVector(this.velocity, dt);

    // Ground check — player feet = position.y - height, eyes = position.y
    const groundY = this._getGround(colliders);
    const eyeH = this.isCrouching ? 1.1 : this.height;
    // Player origin is at eye level; feet are eyeH below
    const feetY = this.position.y - eyeH;
    if (feetY <= groundY + 0.05) {
      this.position.y = groundY + eyeH; // feet exactly on ground surface
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.isGrounded = true;
    } else { this.isGrounded = false; }

    if (colliders) this._resolveWalls(colliders);
    this.position.x = Math.max(-195, Math.min(195, this.position.x));
    this.position.z = Math.max(-195, Math.min(195, this.position.z));

    // Camera position — set BEFORE shooting so bullet origin is correct
    const eyeOffset = this.isCrouching ? 0 : 0.25;
    this.camera.position.set(this.position.x, this.position.y + eyeOffset, this.position.z);

    // Weapon-specific scope/ADS FOV
    const wid = this.weaponSystem.weaponId;
    const scopeFovMult = {
      sniperRifle: 0.22,    // 8x sniper scope — very narrow
      railgun:     0.28,    // powerful scope
      burstRifle:  0.52,    // 2x holographic
      assaultRifle:0.58,    // 1.5x ACOG
      pistol:      0.68,    // iron sights
      revolver:    0.65,    // iron sights
      smg:         0.72,    // reflex dot
      shotgun:     0.75,    // bead sight (wider)
      plasmaRifle: 0.55,    // plasma optic
      minigun:     0.82,    // no scope — just slight zoom
      // melee: no scope
      katana:      1.0,
      hammerfist:  1.0,
      energyBlade: 1.0,
    };
    const fovMult = scopeFovMult[wid] !== undefined ? scopeFovMult[wid] : 0.62;
    const tFov = this.isAiming ? this.config.fov * fovMult : this.config.fov;
    this.camera.fov += (tFov - this.camera.fov) * 0.16;
    this.camera.updateProjectionMatrix();
    // Notify scope overlay via window flag
    window._scopeState = { active: this.isAiming, weaponId: wid };

    // Viewmodel bob + sway
    if (this._vm) {
      const t = performance.now() * 0.001;
      const bob = len > 0 && this.isGrounded ? Math.sin(t * (this.isSprinting ? 13 : 7)) * (this.isSprinting ? 0.022 : 0.009) : 0;
      const isMelee = this.weaponSystem.isMelee();
      const baseX = isMelee ? 0.18 : (this.isAiming ? 0.08 : 0.2);
      const baseZ = isMelee ? -0.28 : -0.38;
      this._vm.position.y = -0.2 + bob;
      this._vm.position.x += (baseX - this._vm.position.x) * 0.2;
      this._vm.position.z += (baseZ - this._vm.position.z) * 0.2;
      this._vm.rotation.z = this.weaponSystem.recoilX;
      this._vm.rotation.x = -this.weaponSystem.recoilY * 0.5;
    }

    // Shooting
    const now = performance.now();
    const isFiring = !!this.mouse[0];
    const auto    = this.weaponSystem.stats?.auto && isFiring;
    const single  = !this.weaponSystem.stats?.auto && isFiring && !this.weaponSystem.isMelee() && !this._prevFire;
    const melee   = this.weaponSystem.isMelee() && isFiring && !this._prevFire;
    this._prevFire = isFiring;

    const wsUpdate = this.weaponSystem.update(delta, isFiring);
    if (wsUpdate?.burstFire) {
      const burstRes = this.weaponSystem.shoot(this.camera, now);
      if (burstRes) return { shot: true, ...burstRes };
    }

    if (auto || single || melee) {
      if (melee) this._meleeSwingAnim();
      const res = this.weaponSystem.shoot(this.camera, now);
      if (res) return { shot: true, ...res };
    }

    for (const k of ['e','q','f']) if (this.abilityCooldowns[k] > 0) this.abilityCooldowns[k] = Math.max(0, this.abilityCooldowns[k] - delta);
    return null;
  }

  _meleeSwingAnim() {
    if (!this._vm || this._swinging) return;
    this._swinging = true;
    const t0 = performance.now();
    const orig = { x: this._vm.rotation.x, y: this._vm.rotation.y, z: this._vm.rotation.z };
    const swing = () => {
      const p = Math.min(1, (performance.now() - t0) / 200);
      const curve = p < 0.5 ? p * 2 : (1 - p) * 2;
      this._vm.rotation.x = orig.x - curve * 0.8;
      this._vm.rotation.z = orig.z + curve * 0.4;
      if (p < 1) requestAnimationFrame(swing);
      else { this._vm.rotation.x = orig.x; this._vm.rotation.z = orig.z; this._swinging = false; }
    };
    requestAnimationFrame(swing);
  }

  _getGround(colliders) {
    if (!colliders) return 0;
    let maxY = -Infinity;
    const eyeH = this.isCrouching ? 1.1 : this.height;
    for (const c of colliders) {
      if (c.isGround) { maxY = Math.max(maxY, c.y || 0); continue; }
      if (!c.box) continue;
      const footX = this.position.x, footZ = this.position.z;
      if (footX > c.box.min.x - 0.4 && footX < c.box.max.x + 0.4 &&
          footZ > c.box.min.z - 0.4 && footZ < c.box.max.z + 0.4) {
        const topY = c.box.max.y;
        const feetY = this.position.y - eyeH;
        if (topY > -Infinity && feetY <= topY + 0.6 && feetY >= topY - 2.0) {
          maxY = Math.max(maxY, topY);
        }
      }
    }
    return maxY === -Infinity ? 0 : maxY;
  }

  _resolveWalls(cols) {
    const pad = 0.45;
    const eyeH = this.isCrouching ? 1.1 : this.height;
    const feetY = this.position.y - eyeH;
    for (const c of cols) {
      if (!c.box) continue;
      const topY = c.box.max.y;
      // Skip if we're standing on top of this box
      if (feetY >= topY - 0.05) continue;
      // Skip if we're fully above the box
      if (this.position.y > topY + 0.4) continue;
      if (this.position.x > c.box.min.x - pad && this.position.x < c.box.max.x + pad &&
          this.position.z > c.box.min.z - pad && this.position.z < c.box.max.z + pad &&
          this.position.y > c.box.min.y && this.position.y < c.box.max.y + eyeH) {
        const ox = Math.min(Math.abs(this.position.x - c.box.min.x), Math.abs(this.position.x - c.box.max.x));
        const oz = Math.min(Math.abs(this.position.z - c.box.min.z), Math.abs(this.position.z - c.box.max.z));
        if (ox < oz) { this.position.x = this.position.x < (c.box.min.x + c.box.max.x)/2 ? c.box.min.x - pad : c.box.max.x + pad; this.velocity.x = 0; }
        else         { this.position.z = this.position.z < (c.box.min.z + c.box.max.z)/2 ? c.box.min.z - pad : c.box.max.z + pad; this.velocity.z = 0; }
      }
    }
  }

  takeDamage(amount) {
    if (!this.isAlive || this.isInvincible) return 0;
    let dmg = Math.max(1, Math.floor(amount));
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    this.health = Math.max(0, this.health - dmg);
    if (this.health <= 0) { this.health = 0; this.isAlive = false; this.deaths++; }
    // Reuse a single pre-created damage flash overlay instead of spawning DOM nodes
    if (!this._dmgFlash) {
      this._dmgFlash = document.createElement('div');
      this._dmgFlash.style.cssText = 'position:fixed;inset:0;background:rgba(255,0,0,0.22);pointer-events:none;z-index:8888;opacity:0;transition:opacity 0.06s';
      document.body.appendChild(this._dmgFlash);
    }
    this._dmgFlash.style.opacity = '1';
    clearTimeout(this._dmgFlashTO);
    this._dmgFlashTO = setTimeout(() => { if(this._dmgFlash) this._dmgFlash.style.opacity = '0'; }, 60);
    return amount;
  }

  respawn(sp) {
    this.isAlive = true; this.health = this.maxHealth; this.shield = this.charDef.maxShield;
    this.position.copy(sp); this.velocity.set(0, 0, 0);
    this.isInvincible = true; setTimeout(() => { this.isInvincible = false; }, 2500);
    this.weaponSystem.equip(this.charDef.weapon || 'assaultRifle');
    this._setupViewmodel();
  }

  getState() {
    return { position: this.position.clone(), yaw: this.yaw, pitch: this.pitch,
             health: this.health, shield: this.shield, isAlive: this.isAlive,
             ammo: this.weaponSystem.ammo, reserve: this.weaponSystem.reserve,
             isReloading: this.weaponSystem.isReloading,
             abilityCooldowns: { ...this.abilityCooldowns }, kills: this.kills, deaths: this.deaths,
             stamina: this.stamina, maxStamina: this.maxStamina };
  }

  destroy() {
    document.removeEventListener('keydown',   this._kd);
    document.removeEventListener('keyup',     this._ku);
    document.removeEventListener('mousemove', this._mm);
    document.removeEventListener('mousedown', this._md);
    document.removeEventListener('mouseup',   this._mu);
    if (this._vm && this.camera) this.camera.remove(this._vm);
  }
}

// ─────────────────────────────────────────────
// BOT AI — TACTICAL, ANIMATED, SMART
// ─────────────────────────────────────────────
const BOT_NAMES = [
  'ALPHA-7','NEXUS-3','VECTOR','GHOST-X','CIPHER','UNIT-9','PHANTOM',
  'BINARY','ROGUE-5','APEX-BOT','STATIC','PULSE','WRAITH-II','STORM',
  'VIPER-4','ORACLE-X','TITAN-9','BLAZE','VOID','ECHO'
];

class BotAI {
  constructor(scene, charId, team, spawnPos, difficulty) {
    this.scene   = scene;
    this.charDef = CHARACTERS.find(c => c.id === charId) || CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    this.team    = team;
    this.name    = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    this.id      = 'bot_' + Math.random().toString(36).substr(2, 6);
    this.isPlayer = false;
    this.charId  = charId;

    // ── Difficulty tuning ───────────────────
    const P = {
      easy:   { acc: 0.20, react: 2800, fr: 0.22, spd: 0.48, sightRange: 18, burstMax: 2, jumpChance: 0.03, meleeRange: 3.8 },
      medium: { acc: 0.50, react: 800,  fr: 0.55, spd: 0.78, sightRange: 38, burstMax: 4, jumpChance: 0.09, meleeRange: 3.2 },
      hard:   { acc: 0.76, react: 280,  fr: 0.88, spd: 1.00, sightRange: 56, burstMax: 7, jumpChance: 0.16, meleeRange: 2.8 }
    };
    this.p = P[difficulty] || P.medium;

    this._burstCount = 0; this._burstPause = 0;
    this.health = this.charDef.maxHealth; this.shield = this.charDef.maxShield;
    this.maxHealth = this.charDef.maxHealth; this.maxShield = this.charDef.maxShield;
    this.isAlive = true; this.isInvincible = false;
    this.kills = 0; this.deaths = 0; this.assists = 0;
    this.position = spawnPos.clone(); this.velocity = new THREE.Vector3();
    this.rotation = 0; this.isGrounded = true;
    this._groundY = 0;
    this.speed = 7.5 * this.charDef.speed * this.p.spd;

    const wid = this.charDef.weapon || 'assaultRifle';
    const ws = WEAPON_STATS[wid] || WEAPON_STATS.assaultRifle;
    this.wStats = ws; this.weaponId = wid;
    this.isMeleeWeapon = ws.type === 'melee';
    this.ammo = this.isMeleeWeapon ? 999 : ws.magSize;
    this.reserve = this.isMeleeWeapon ? 999 : ws.reserveAmmo;
    this.isReloading = false; this.reloadTimer = 0; this.lastShot = 0;
    this.state = 'patrol';
    this.reactionT = 0; this.reacted = false;
    this.strafeDir = 1; this.strafeT = 0;
    this.patrolPts = []; this.patrolIdx = 0; this.patrolWait = 0;
    this.stuckT = 0; this.prevPos = this.position.clone();
    this.jumpT = Math.random() * 3000;
    this._lastSeenPos = null; this._lastSeenTime = 0;
    this._coverPos = null; this._coverT = 0;
    this._flankAngle = Math.random() * Math.PI * 2;
    this._abilityCooldown = 0;
    this._grenadeT = 8000 + Math.random() * 12000; // grenade timer
    this._peekT = 0; // peek from cover timer
    this._suppressT = 0; // suppression fire mode
    this._aimOffset = new THREE.Vector3(); // jitter on aim
    this._aimOffsetT = 0;
    this._lastHealthRegen = 0;
    this._engageRange = this.p.sightRange; // same sight range for all weapon types; melee close-range handled in _transition

    // Nav waypoint system
    this._navWaypoints = null;
    this._navIdx = 0;
    this._navTimer = 0;
    this._jumpTimer = 0;
    this._platformQueue = []; // queued platform jumps

    // Build humanoid mesh
    this.mesh = buildCharMesh(charId, this.charDef, false);
    this.mesh.position.copy(this.position);
    this.mesh.userData.isBot = true;
    this.mesh.userData.botRef = this;
    // Tint team glow
    this.mesh.traverse(c => {
      if (c.isPointLight) c.color.setHex(team === 'a' ? 0x0055ff : 0xff2200);
    });
    scene.add(this.mesh);
    this._buildHPBar();
    this._buildBotWeapon();
  }

  _buildBotWeapon() {
    const ws = this.wStats;
    if (!ws || ws.type === 'melee') return;
    // Attach gun to the right forearm
    const wg = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: ws.color, metalness: 0.8, roughness: 0.2 });
    const am = new THREE.MeshStandardMaterial({ color: ws.accentColor, metalness: 0.9, roughness: 0.1, emissive: new THREE.Color(ws.accentColor), emissiveIntensity: 0.3 });
    wg.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.32), bm));
    const acc = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.10), am);
    acc.position.z = 0.18; wg.add(acc);
    // Muzzle
    const muz = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 6), am);
    muz.rotation.x = Math.PI/2; muz.position.z = 0.25; wg.add(muz);

    // Try to attach to right hand group, fallback to mesh root
    const rHand = this.mesh.userData.rElbow;
    if (rHand) {
      wg.position.set(0, -0.30, 0.04);
      wg.rotation.x = Math.PI / 2;
      rHand.add(wg);
    } else {
      wg.position.set(0.25, 1.05, 0.12);
      wg.rotation.y = -Math.PI / 2;
      this.mesh.add(wg);
    }
    this._weaponGroup = wg;
  }

  _buildHPBar() {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.085), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide, depthWrite: false })));
    this.hbFill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.085), new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, depthWrite: false }));
    this.hbFill.position.z = 0.001; grp.add(this.hbFill);
    this.shFill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.055), new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, depthWrite: false }));
    const shBg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.055), new THREE.MeshBasicMaterial({ color: 0x111133, side: THREE.DoubleSide, depthWrite: false }));
    shBg.position.set(0, -0.10, 0); this.shFill.position.set(0, -0.10, 0.001); grp.add(shBg, this.shFill);
    grp.position.y = 2.4; this.mesh.add(grp); this.hpBarGrp = grp;
  }

  setGroundY(y) { this._groundY = y; this.position.y = Math.max(this.position.y, y + 0.9); }

  setPatrolPoints(pts) {
    this.patrolPts = pts && pts.length ? pts : [];
    if (this.patrolPts.length <= 1) {
      const base = this.patrolPts[0] || this.position;
      this.patrolPts = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 14 + Math.random() * 28;
        this.patrolPts.push(new THREE.Vector3(
          Math.max(-85, Math.min(85, base.x + Math.cos(a)*r)),
          base.y,
          Math.max(-85, Math.min(85, base.z + Math.sin(a)*r))
        ));
      }
    }
  }

  setColliders(cols) {
    this._colliders = cols;
  }

  update(delta, enemies) {
    // Always tick death animation regardless of isAlive
    this._tickDeath(delta);

    if (!this.isAlive) return null;

    this.strafeT        -= delta;
    this.jumpT          -= delta;
    this._abilityCooldown -= delta;
    this._grenadeT      -= delta;
    this._peekT         -= delta;
    this._suppressT     -= delta;
    this._aimOffsetT    -= delta;
    this._navTimer      -= delta;
    this._jumpTimer     -= delta;

    // ── BOT ABILITY USAGE ────────────────────────────────────────────────────
    // Bots intelligently use their character abilities during combat
    if (this._abilityCooldown <= 0 && enemies?.length > 0) {
      const enemy = this._nearest(enemies);
      if (enemy && this.isAlive) {
        const dist = this.position.distanceTo(enemy.position);
        const hp = this.health / this.maxHealth;
        const abilities = this.charDef?.abilities;
        if (abilities) {
          // Determine which ability to try to use based on situation
          const roll = Math.random();
          let usedAbility = null;

          // Check each ability key in priority order
          const abKeys = ['f', 'e', 'q']; // ult first if ready, then E/Q
          for (const k of abKeys) {
            const ab = abilities[k]; if (!ab) continue;
            if (this._botAbilityCDs && this._botAbilityCDs[k] > 0) continue;
            const t = ab.type;

            // Logic: when to use each type
            let shouldUse = false;
            if (t === 'heal' && hp < 0.45) shouldUse = true;
            else if (t === 'shield' && hp < 0.35 && dist < 14) shouldUse = true;
            else if (t === 'dash' && dist > 6 && this.state === 'chase') shouldUse = roll < 0.4;
            else if (t === 'boost' && (hp > 0.55 && dist < 20)) shouldUse = roll < 0.5;
            else if (t === 'aoe' && dist < (ab.isUlt ? 16 : 12)) shouldUse = roll < 0.7;
            else if (t === 'grenade' && dist > 5 && dist < 20) shouldUse = roll < 0.55;
            else if (t === 'smoke' && hp < 0.3) shouldUse = true;
            else if (t === 'invis' && hp < 0.25) shouldUse = true;
            else if (t === 'teleport' && dist > 10 && this.state === 'chase') shouldUse = roll < 0.35;
            else if (t === 'debuff' && dist < 20) shouldUse = roll < 0.6;
            else if (t === 'drain' && dist < 8) shouldUse = roll < 0.65;
            else if (t === 'execute' && enemy.health / (enemy.maxHealth||100) < 0.35) shouldUse = true;
            else if (t === 'trap' && dist < 16) shouldUse = roll < 0.4;
            else if (t === 'siege' && dist < 14 && hp > 0.4) shouldUse = roll < 0.3;
            else if (t === 'phantom' && hp < 0.35) shouldUse = true;
            else if (t === 'random') shouldUse = roll < 0.45;
            else if (t === 'transform') shouldUse = (hp > 0.5 && dist < 18) ? roll < 0.4 : false;
            else if (t === 'summon') shouldUse = hp > 0.45 && roll < 0.5;
            else if (t === 'beam' && dist < 22) shouldUse = roll < 0.55;
            else if (t === 'melee' && dist < 4) shouldUse = roll < 0.7;
            else if (t === 'scan') shouldUse = roll < 0.3;
            else if (t === 'utility' || t === 'hack') shouldUse = dist < 20 && roll < 0.5;
            else if (t === 'grapple' && dist > 12) shouldUse = roll < 0.4;
            else if (t === 'movement' && dist > 8) shouldUse = roll < 0.35;
            else if (t === 'revive') shouldUse = hp < 0.5;

            if (!shouldUse) continue;

            // Execute ability effect on bot
            usedAbility = k;
            if (!this._botAbilityCDs) this._botAbilityCDs = {e:0,q:0,f:0};
            this._botAbilityCDs[k] = (ab.cooldown || 12) * 1000;
            this._botUseAbility(ab, enemy, dist);
            break;
          }

          // Set global cooldown between bot ability attempts (shorter for hard bots)
          if (usedAbility) {
            this._abilityCooldown = (this.p.acc > 0.7 ? 3000 : this.p.acc > 0.45 ? 5000 : 8000) + Math.random() * 3000;
          } else {
            this._abilityCooldown = 1200 + Math.random() * 1800;
          }
        }
      }
    }
    // Tick bot ability cooldowns
    if (this._botAbilityCDs) {
      for (const k of ['e','q','f']) if (this._botAbilityCDs[k] > 0) this._botAbilityCDs[k] -= delta;
    }

    // Reload tick
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const n = Math.min(this.wStats.magSize - this.ammo, this.reserve);
        this.ammo += n; this.reserve -= n;
      }
    }

    // Passive shield regen (hard bots only)
    if (this.p.acc >= 0.72 && this.shield < this.maxShield) {
      this._lastHealthRegen += delta;
      if (this._lastHealthRegen > 4000) { this.shield = Math.min(this.maxShield, this.shield + 8); this._lastHealthRegen = 0; }
    }

    // Refresh aim jitter periodically
    if (this._aimOffsetT <= 0) {
      this._aimOffsetT = 120 + Math.random() * 180;
      const jitter = (1 - this.p.acc) * 0.6;
      this._aimOffset.set((Math.random()-0.5)*jitter, (Math.random()-0.5)*jitter*0.5, (Math.random()-0.5)*jitter);
    }

    const enemy = this._nearest(enemies);
    this._transition(enemy, delta);

    let bullets = null;
    if      (this.state === 'patrol')  this._patrol(delta);
    else if (this.state === 'chase')   this._chase(delta, enemy);
    else if (this.state === 'attack')  bullets = this._attack(enemy, delta);
    else if (this.state === 'strafe')  { this._strafe(delta, enemy); bullets = this._attack(enemy, delta); }
    else if (this.state === 'flank')   { this._flank(delta, enemy); bullets = this._attack(enemy, delta); }
    else if (this.state === 'cover')   { this._moveToCover(delta); if (this._peekT <= 0) bullets = this._attack(enemy, delta); }
    else if (this.state === 'flee')    this._flee(delta, enemy);
    else if (this.state === 'search')  this._search(delta);
    else if (this.state === 'reload')  this._moveRandomly(delta);
    else if (this.state === 'suppress') { this._strafe(delta, enemy); bullets = this._attack(enemy, delta); }

    this._physics(delta);

    // Ally scatter
    if (this._allyPositions?.length) {
      for (const ap of this._allyPositions) {
        const dx = this.position.x - ap.x, dz = this.position.z - ap.z;
        const d2 = dx*dx + dz*dz;
        if (d2 < 9 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (3 - d) / 3 * 4;
          this.velocity.x += (dx/d) * push;
          this.velocity.z += (dz/d) * push;
        }
      }
    }

    this.mesh.position.copy(this.position);

    // Face enemy or direction of movement
    let targetRot = this.rotation;
    if (enemy && (this.state === 'attack' || this.state === 'strafe' || this.state === 'flank' || this.state === 'suppress')) {
      targetRot = Math.atan2(enemy.position.x - this.position.x, enemy.position.z - this.position.z);
    } else if (this.velocity.length() > 0.5) {
      targetRot = Math.atan2(this.velocity.x, this.velocity.z);
    }
    // Smooth rotation
    let dRot = targetRot - this.rotation;
    while (dRot > Math.PI)  dRot -= Math.PI * 2;
    while (dRot < -Math.PI) dRot += Math.PI * 2;
    this.rotation += dRot * 0.20;
    this.mesh.rotation.y = this.rotation;

    // Compute aim pitch toward enemy for animations
    let aimPitch = 0;
    if (enemy) {
      const dy = enemy.position.y + 1.2 - this.position.y;
      const dh = Math.sqrt((enemy.position.x-this.position.x)**2 + (enemy.position.z-this.position.z)**2);
      aimPitch = Math.atan2(dy, dh);
      if (this.mesh.userData) this.mesh.userData.aimPitch = aimPitch;
    }

    // Weapon aim angle
    if (this._weaponGroup && enemy) {
      const dy = enemy.position.y - this.position.y;
      const dh = this.position.distanceTo(enemy.position);
      this._weaponGroup.rotation.x = -Math.atan2(dy + 0.5, dh) * 0.6;
    }

    // Run full humanoid animation
    const speed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
    // Pass whether we just fired this frame for recoil animation
    if (bullets && bullets.length > 0 && this.mesh.userData) {
      this.mesh.userData.shootRecoilT = 1.0; // will decay in animateCharMesh
    }
    // Pass death state
    const animState = !this.isAlive ? 'dead' : this.state;
    animateCharMesh(this.mesh, speed, animState, delta, this.rotation, aimPitch);

    this._updateHPBar();
    this._tickHitFlash(delta);
    this._tickHitSparks(delta);

    // Stuck detection — jump + sidestep to escape
    const moved = this.position.distanceTo(this.prevPos);
    if (moved < 0.04 && (this.state === 'chase' || this.state === 'patrol' || this.state === 'flank' || this.state === 'cover')) {
      this.stuckT += delta;
      if (this.stuckT > 900) {
        this.stuckT = 0;
        // Jump + push sideways to get past obstacle
        if (this.isGrounded) {
          this.velocity.y = 10 + Math.random() * 3;
          this.isGrounded = false;
        }
        const escapeAngle = this.rotation + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2) + (Math.random()-0.5)*0.8;
        this.velocity.x += Math.sin(escapeAngle) * this.speed * 1.4;
        this.velocity.z += Math.cos(escapeAngle) * this.speed * 1.4;
        // pick a fresh patrol point so bot doesn't keep running at same wall
        if (this.patrolPts.length) {
          this.patrolIdx = (this.patrolIdx + 1) % this.patrolPts.length;
        }
      }
    } else { this.stuckT = 0; }
    this.prevPos.copy(this.position);

    return bullets;
  }

  _nearest(enemies) {
    if (!enemies?.length) return null;
    let best = null, bd = Infinity;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const d = this.position.distanceTo(e.position);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  _transition(enemy, delta) {
    // Reload check
    if (!this.isMeleeWeapon && this.ammo === 0 && !this.isReloading) { this.state = 'reload'; this._startReload(); return; }
    if (!this.isMeleeWeapon && this.isReloading) { this.state = 'reload'; return; }
    if (this._burstPause > 0) this._burstPause -= delta;

    const hp   = this.health / this.maxHealth;
    const dist = enemy ? this.position.distanceTo(enemy.position) : Infinity;

    // Near death: flee unless melee (melee should chase/fight)
    if (hp < 0.12 && dist < 45 && !this.isMeleeWeapon) { this.state = 'flee'; return; }

    // Hurt: retreat to cover for ranged weapons
    if (hp < 0.38 && dist < 28 && !this._coverPos && !this.isMeleeWeapon) {
      this._pickCoverPos(enemy);
      this._peekT = 2000 + Math.random() * 1500;
    }
    if (this._coverPos && hp < 0.50 && this._coverT > 0 && !this.isMeleeWeapon) { this.state = 'cover'; return; }

    if (!enemy || !enemy.isAlive) {
      this.state = this._lastSeenPos ? 'search' : 'patrol';
      this.reacted = false; this.reactionT = 0;
      return;
    }

    this._lastSeenPos = enemy.position.clone();
    this._lastSeenTime = Date.now();

    if (dist <= this._engageRange) {
      // Reaction delay
      if (!this.reacted) {
        this.reactionT += delta;
        if (this.reactionT >= this.p.react) { this.reacted = true; this.reactionT = 0; }
        else { this.state = 'chase'; return; }
      }

      const optRange = this.isMeleeWeapon ? 2.5 : this.wStats.range * 0.42;

      if (this.isMeleeWeapon) {
        if (dist > 2.2) this.state = 'chase';
        else this.state = 'attack';
      } else {
        const rng = Math.random();
        if (dist > optRange * 1.6) {
          this.state = 'chase';
        } else if (dist < optRange * 0.18 && this.p.acc < 0.55) {
          this.state = 'flee'; // too close for ranged — back up
        } else if (this._suppressT > 0) {
          this.state = 'suppress';
        } else if (this.strafeT > 0) {
          this.state = 'strafe'; // strafe while shooting
        } else if (rng < 0.20 && hp > 0.55) {
          this.state = 'flank';
          this._flankAngle = Math.atan2(this.position.z - enemy.position.z, this.position.x - enemy.position.x) + Math.PI * (Math.random() > 0.5 ? 0.5 : -0.5);
        } else if (rng < 0.30 && hp > 0.70 && dist < 22) {
          this.state = 'suppress';
          this._suppressT = 1200 + Math.random() * 1000;
        } else {
          this.state = 'attack';
        }
      }

      if (this.strafeT <= 0) {
        this.strafeT = 700 + Math.random() * 1200;
        this.strafeDir *= -1;
      }
    } else if (dist < this._engageRange * 2.4) {
      this.state = 'chase';
      this.reacted = false; this.reactionT = 0;
    } else {
      this.state = 'patrol';
      this.reacted = false;
    }

    // Smart jumping for elevation differences
    if (this.jumpT <= 0 && this.isGrounded) {
      const elevDiff = enemy ? enemy.position.y - this.position.y : 0;
      const jumpChance = this.p.jumpChance * (elevDiff > 1.8 ? 3.5 : 1.0) * (this.state === 'chase' ? 1.8 : 1.0);
      if (Math.random() < jumpChance) {
        this.velocity.y = 9.5 + Math.random() * 2;
        this.isGrounded = false;
        this.jumpT = 2000 + Math.random() * 3500;
      }
    }
  }

  _patrol(delta) {
    // In KOTH mode, patrol TOWARD the capture zone
    if (this._kothZonePos) {
      const dx = this._kothZonePos.x - this.position.x;
      const dz = this._kothZonePos.z - this.position.z;
      const d  = Math.sqrt(dx*dx+dz*dz);
      if (d > 3) {
        const s = this.speed * 0.70;
        this.velocity.x += (dx/d * s - this.velocity.x) * 0.12;
        this.velocity.z += (dz/d * s - this.velocity.z) * 0.12;
      }
      return;
    }
    if (!this.patrolPts.length) return;
    this.patrolWait -= delta; if (this.patrolWait > 0) return;
    const t = this.patrolPts[this.patrolIdx];
    if (!t) return;
    const dx = t.x - this.position.x, dz = t.z - this.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < 2.5) {
      this.patrolIdx = (this.patrolIdx + 1) % this.patrolPts.length;
      this.patrolWait = 400 + Math.random() * 800;
      return;
    }
    const s = this.speed * 0.60;
    this.velocity.x += (dx/d * s - this.velocity.x) * 0.12;
    this.velocity.z += (dz/d * s - this.velocity.z) * 0.12;
  }

  _chase(delta, e) {
    if (!e) return;
    const dx = e.position.x - this.position.x, dz = e.position.z - this.position.z;
    const d = Math.sqrt(dx*dx + dz*dz) || 1;
    const spd = this.isMeleeWeapon ? this.speed * 1.25 : this.speed;
    this.velocity.x += (dx/d * spd - this.velocity.x) * 0.16;
    this.velocity.z += (dz/d * spd - this.velocity.z) * 0.16;

    // Jump toward enemy if enemy is significantly higher
    if (e.position.y > this.position.y + 2.0 && this.isGrounded && this._jumpTimer <= 0) {
      this.velocity.y = 10 + Math.min(4, (e.position.y - this.position.y) * 0.4);
      this.isGrounded = false;
      this._jumpTimer = 1500;
    }
  }

  _attack(e, delta) {
    if (!e || !e.isAlive || !this.reacted) return null;
    if (this._burstPause > 0) return null;

    const now = performance.now();

    // MELEE
    if (this.isMeleeWeapon) {
      const dist = this.position.distanceTo(e.position);
      const mRange = this.wStats.meleeRadius || this.wStats.range || 2.5;
      if (dist > mRange + 0.5) return null;
      const fireInterval = 60000 / this.wStats.fireRate;
      if (now - this.lastShot < fireInterval) return null;
      this.lastShot = now;
      return [{
        id: 'melee_' + Math.random().toString(36).substr(2,6),
        position: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
        direction: e.position.clone().sub(this.position).normalize(),
        speed: 0, damage: this.wStats.damage,
        range: this.wStats.meleeRadius || 2.5,
        meleeArc: this.wStats.meleeArc || 2.0,
        distanceTraveled: 0, alive: true, isMelee: true,
        ownerId: this.id, ownerTeam: this.team
      }];
    }

    // GUN
    if (this.isReloading || this.ammo <= 0) return null;
    // p.fr is 0..1: hard=0.88 fires close to max RPM, easy=0.22 fires much slower
    const fireInterval = (60000 / this.wStats.fireRate) * (1 + (1 - this.p.fr) * 3.5);
    if (now - this.lastShot < fireInterval) return null;
    this.lastShot = now;
    this.ammo = Math.max(0, this.ammo - 1);
    this._burstCount++;
    if (this._burstCount >= this.p.burstMax) {
      this._burstCount = 0;
      this._burstPause = Math.round(120 / this.p.fr) + Math.random() * Math.round(250 / this.p.fr);
    }

    // Predictive aiming: lead moving targets
    const origin = this.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    const travelTime = this.position.distanceTo(e.position) / 130;
    // e.position is eye-level for player (y ~ 1.8), center for bots (y ~ 0.95)
    // Aim at chest: for player aim at e.position - 0.5 (torso), for bot aim at e.position + 0.2
    const eIsPlayer = !!e.isPlayer;
    const chestOffset = eIsPlayer ? -0.5 : 0.2;
    const predicted = e.position.clone().add(
      e.velocity ? e.velocity.clone().multiplyScalar(travelTime * this.p.acc) : new THREE.Vector3()
    );
    const aimTarget = predicted.clone().add(new THREE.Vector3(0, chestOffset, 0)).add(this._aimOffset);
    const idealDir = aimTarget.sub(origin).normalize();

    // Spread based on accuracy
    const sp = (1 - this.p.acc) * 0.12;
    idealDir.x += (Math.random() - 0.5) * sp;
    idealDir.y += (Math.random() - 0.5) * sp * 0.45;
    idealDir.z += (Math.random() - 0.5) * sp;
    idealDir.normalize();

    const bullets = [];
    const pellets = this.wStats.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const d = idealDir.clone();
      if (p > 0) { d.x += (Math.random()-0.5)*0.10; d.z += (Math.random()-0.5)*0.10; d.normalize(); }
      bullets.push({
        id: 'b_' + Math.random().toString(36).substr(2,6),
        position: origin.clone(), direction: d,
        speed: 130, damage: this.wStats.damage,
        range: this.wStats.range, distanceTraveled: 0,
        alive: true, isMelee: false,
        ownerId: this.id, ownerTeam: this.team
      });
    }
    this._botMuzzleFlash();
    return bullets;
  }

  // ── BOT ABILITY EXECUTION ─────────────────────────────────────────────────
  _botUseAbility(ab, enemy, dist) {
    const t = ab.type;
    const pos = this.position.clone();
    const toEnemy = enemy ? enemy.position.clone().sub(pos).normalize() : new THREE.Vector3(0,0,1);

    // Visual feedback: ability flash on bot
    const col = new THREE.Color(this.charDef?.accentColor || 0x00ffff);
    const lt = new THREE.PointLight(col, 14, 9); lt.position.copy(pos).add(new THREE.Vector3(0,1.2,0)); this.scene.add(lt);
    const t0 = performance.now();
    const tick = () => { const p=(performance.now()-t0)/500; lt.intensity=14*(1-p); if(p<1) requestAnimationFrame(tick); else this.scene.remove(lt); };
    requestAnimationFrame(tick);

    // Apply effect
    if (t === 'dash' || t === 'movement') {
      // Dash toward enemy
      const d = toEnemy.clone(); d.y = 0.15; d.normalize();
      this.velocity.x = d.x * 32; this.velocity.z = d.z * 32; this.velocity.y = 7;
      this.isGrounded = false; this.isInvincible = true;
      setTimeout(() => { this.isInvincible = false; }, 300);
      if (!window._botGrenades) window._botGrenades = [];
      window._botGrenades.push({ pos: pos.clone().addScaledVector(d, 5), radius: 3, damage: 40, t: performance.now() });

    } else if (t === 'teleport') {
      const dest = pos.clone().addScaledVector(toEnemy, Math.min(dist - 2, 16));
      dest.y = Math.max(dest.y, this._groundY + 0.5);
      this.position.copy(dest); this.velocity.set(0, 0, 0);

    } else if (t === 'boost' || t === 'siege' || t === 'transform' || t === 'summon') {
      const dur = ab.isUlt ? 8000 : 5000;
      const oldSpd = this.speed;
      this.speed *= 1.5; this.damageMult = (this.damageMult || 1) * 1.8;
      if (t === 'siege') { this.isInvincible = true; this.damageMult = (this.damageMult||1)*1.5; }
      setTimeout(() => { this.speed = oldSpd; this.damageMult = 1; this.isInvincible = false; }, dur);
      if (!window._botGrenades) window._botGrenades = [];
      window._botGrenades.push({ pos: pos, radius: 5, damage: 30, t: performance.now() });

    } else if (t === 'shield' || t === 'invis' || t === 'phantom') {
      const dur = ab.isUlt ? 5000 : 3000;
      this.isInvincible = true;
      if (t === 'phantom') { const oldSpd = this.speed; this.speed *= 1.6; setTimeout(() => this.speed = oldSpd, dur); }
      setTimeout(() => { this.isInvincible = false; }, dur);

    } else if (t === 'heal' || t === 'revive') {
      const healAmt = ab.name?.includes('Nano') ? 80 : ab.name?.includes('Revival') ? this.maxHealth : 50;
      this.health = Math.min(this.maxHealth, this.health + healAmt);
      this.shield = Math.min(this.maxShield, this.shield + 20);

    } else if (t === 'aoe' || t === 'grenade' || t === 'melee') {
      if (!window._botGrenades) window._botGrenades = [];
      const radius = ab.isUlt ? 14 : 8;
      const damage = ab.isUlt ? (ab.name?.includes('Nova') ? 200 : 150) : (ab.name?.includes('Slam') || ab.name?.includes('Strike') ? 90 : 70);
      const aoePos = enemy ? enemy.position.clone() : pos.clone().addScaledVector(toEnemy, 6);
      window._botGrenades.push({ pos: aoePos, radius, damage, t: performance.now() });
      // Extra light flash at target
      const el2 = new THREE.PointLight(col, 18, radius*1.2); el2.position.copy(aoePos); this.scene.add(el2);
      const t1 = performance.now();
      const tick2 = () => { const p=(performance.now()-t1)/600; el2.intensity=18*(1-p); if(p<1) requestAnimationFrame(tick2); else this.scene.remove(el2); };
      requestAnimationFrame(tick2);

    } else if (t === 'smoke' || t === 'utility' || t === 'trap') {
      // Bot uses smoke/trap as cover near self
      if (!window._botGrenades) window._botGrenades = [];
      window._botGrenades.push({ pos: pos.clone(), radius: 6, damage: 15, t: performance.now() });

    } else if (t === 'drain' || t === 'debuff' || t === 'execute' || t === 'hack') {
      // Apply via game._applyDamage so kills trigger respawn and score
      if (enemy) {
        const dmg = t === 'execute' ? (enemy.health/enemy.maxHealth < 0.25 ? 99999 : 80) : t === 'drain' ? 60 : 50;
        if (window._game && typeof window._game._applyDamage === 'function') {
          window._game._applyDamage(enemy, dmg);
        } else {
          enemy.takeDamage(dmg);
        }
        if (t !== 'execute') { enemy._debuffMult = 1.5; enemy._debuffExpiry = performance.now() + 3000; }
      }

    } else if (t === 'scan') {
      // Bot scan — just a visual, no real effect needed
      const lt2 = new THREE.PointLight(0x00ffaa, 8, 30); lt2.position.copy(pos).add(new THREE.Vector3(0,1.5,0)); this.scene.add(lt2);
      setTimeout(() => this.scene.remove(lt2), 300);

    } else if (t === 'beam') {
      if (enemy) {
        const dmg = 60;
        if (window._game && typeof window._game._applyDamage === 'function') {
          window._game._applyDamage(enemy, dmg);
        } else {
          enemy.takeDamage(dmg);
        }
        if (!window._botGrenades) window._botGrenades = [];
        window._botGrenades.push({ pos: enemy.position.clone(), radius: 2, damage: dmg, t: performance.now() });
      }

    } else if (t === 'grapple') {
      this.velocity.x = toEnemy.x * 45; this.velocity.y = 16; this.velocity.z = toEnemy.z * 45;
      this.isGrounded = false;

    } else if (t === 'random') {
      const roll = Math.random();
      if (roll < 0.5 && enemy) {
        if (!window._botGrenades) window._botGrenades = [];
        window._botGrenades.push({ pos: enemy.position.clone(), radius: 12, damage: 400, t: performance.now() });
      } else {
        this.health = Math.min(this.maxHealth, this.health + 80);
      }
    } else if (t === 'flash') {
      if (!window._botGrenades) window._botGrenades = [];
      const fPos = enemy ? enemy.position.clone() : pos.clone().addScaledVector(toEnemy, 10);
      window._botGrenades.push({ pos: fPos, radius: 7, damage: 20, t: performance.now() });
    }
  }

  _botMuzzleFlash() {
    if (!this._muzzleLight) {
      this._muzzleLight = new THREE.PointLight(0xffaa44, 0, 5);
      this.scene.add(this._muzzleLight);
    }
    const fwd = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    this._muzzleLight.position.copy(this.position).addScaledVector(fwd, 0.7).add(new THREE.Vector3(0, 1.4, 0));
    this._muzzleLight.intensity = 7;
    clearTimeout(this._muzzleT);
    this._muzzleT = setTimeout(() => { if (this._muzzleLight) this._muzzleLight.intensity = 0; }, 65);
  }

  _flank(delta, e) {
    if (!e) return;
    this._flankAngle += delta * 0.0008;
    const r = 10 + Math.random() * 4;
    const tx = e.position.x + Math.cos(this._flankAngle) * r;
    const tz = e.position.z + Math.sin(this._flankAngle) * r;
    const dx = tx - this.position.x, dz = tz - this.position.z;
    const d = Math.sqrt(dx*dx + dz*dz) || 1;
    this.velocity.x += (dx/d * this.speed - this.velocity.x) * 0.13;
    this.velocity.z += (dz/d * this.speed - this.velocity.z) * 0.13;
  }

  _pickCoverPos(enemy) {
    if (!enemy) return;
    const dx = this.position.x - enemy.position.x, dz = this.position.z - enemy.position.z;
    const d = Math.sqrt(dx*dx+dz*dz) || 1;
    // Pick a position 12-18 units away, behind current position (away from enemy)
    const coverDist = 12 + Math.random() * 6;
    const lateralOffset = (Math.random()-0.5) * 10;
    this._coverPos = new THREE.Vector3(
      this.position.x + (dx/d)*coverDist + (-dz/d)*lateralOffset,
      0,
      this.position.z + (dz/d)*coverDist + (dx/d)*lateralOffset
    );
    this._coverT = 4000 + Math.random() * 2000;
  }

  _moveToCover(delta) {
    this._coverT -= delta;
    if (!this._coverPos || this._coverT <= 0 || this.position.distanceTo(this._coverPos) < 2) {
      this._coverPos = null; this.state = 'patrol'; return;
    }
    const dx = this._coverPos.x - this.position.x, dz = this._coverPos.z - this.position.z;
    const d = Math.sqrt(dx*dx+dz*dz) || 1;
    this.velocity.x += (dx/d * this.speed*1.2 - this.velocity.x) * 0.20;
    this.velocity.z += (dz/d * this.speed*1.2 - this.velocity.z) * 0.20;
  }

  _strafe(delta, e) {
    if (!e) return;
    const dx = e.position.x - this.position.x, dz = e.position.z - this.position.z;
    const d = Math.sqrt(dx*dx + dz*dz) || 1;
    this.velocity.x += (-dz/d * this.strafeDir * this.speed * 0.88 - this.velocity.x) * 0.16;
    this.velocity.z += ( dx/d * this.strafeDir * this.speed * 0.88 - this.velocity.z) * 0.16;
    // Maintain optimal range
    const optDist = this.isMeleeWeapon ? 2.5 : this.wStats.range * 0.38;
    const pushBack = d - optDist;
    if (Math.abs(pushBack) > 2.5) {
      this.velocity.x += (dx/d * (pushBack > 0 ? 2.2 : -2.2) - this.velocity.x) * 0.08;
      this.velocity.z += (dz/d * (pushBack > 0 ? 2.2 : -2.2) - this.velocity.z) * 0.08;
    }
  }

  _flee(delta, e) {
    if (!e) return;
    const dx = this.position.x - e.position.x, dz = this.position.z - e.position.z;
    const d = Math.sqrt(dx*dx + dz*dz) || 1;
    this.velocity.x += (dx/d * this.speed * 1.35 - this.velocity.x) * 0.18;
    this.velocity.z += (dz/d * this.speed * 1.35 - this.velocity.z) * 0.18;
    if (this.isGrounded && Math.random() < 0.06) {
      this.velocity.y = 9.5; this.isGrounded = false;
    }
  }

  _search(delta) {
    if (!this._lastSeenPos) return;
    const dx = this._lastSeenPos.x - this.position.x, dz = this._lastSeenPos.z - this.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < 2.5 || (Date.now() - this._lastSeenTime) > 8000) {
      this._lastSeenPos = null; this.state = 'patrol'; return;
    }
    this.velocity.x += (dx/d * this.speed * 0.65 - this.velocity.x) * 0.10;
    this.velocity.z += (dz/d * this.speed * 0.65 - this.velocity.z) * 0.10;
  }

  _moveRandomly(delta) {
    if (this._navTimer > 0) return;
    this._navTimer = 1000 + Math.random() * 1500;
    const a = Math.random() * Math.PI * 2;
    this.velocity.x += Math.cos(a) * this.speed * 0.45;
    this.velocity.z += Math.sin(a) * this.speed * 0.45;
  }

  _startReload() {
    if (this.isReloading || this.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = this.wStats.reloadTime * 1.1;
  }

  _physics(delta) {
    const dt = delta / 1000;
    // Gravity
    if (!this.isGrounded) this.velocity.y += -24 * dt;

    // Move in X and Z separately so wall sliding works
    this.position.x += this.velocity.x * dt;
    this._resolveWallsBot('x');
    this.position.z += this.velocity.z * dt;
    this._resolveWallsBot('z');
    this.position.y += this.velocity.y * dt;

    // Ground check against flat ground AND platform tops
    const groundY = this._getGroundBot();
    const botH = 0.95; // half-height: bot visual center is ~1.9 units tall, pivot at feet
    if (this.position.y - botH <= groundY + 0.02) {
      this.position.y = groundY + botH; // sit exactly on surface
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Friction — frame-rate independent (0.88 per second allows bots to maintain speed)
    const fric = Math.pow(0.88, delta / 1000);
    this.velocity.x *= fric; this.velocity.z *= fric;
    // Clamp to arena bounds
    this.position.x = Math.max(-190, Math.min(190, this.position.x));
    this.position.z = Math.max(-190, Math.min(190, this.position.z));

    // Edge avoidance for sky/floating maps — if ground under forward step drops away, steer back
    if (this.isGrounded && this._colliders) {
      const hasNoGlobalFloor = !this._colliders.some(c => c.isGround && !c.isSkyKill);
      if (hasNoGlobalFloor) {
        const stepDist = 1.6;
        const fwdX = this.position.x + Math.sin(this.rotation) * stepDist;
        const fwdZ = this.position.z + Math.cos(this.rotation) * stepDist;
        let fwdGround = -999;
        for (const c of this._colliders) {
          if (!c.box) continue;
          const b = c.box;
          if (fwdX > b.min.x - 0.5 && fwdX < b.max.x + 0.5 && fwdZ > b.min.z - 0.5 && fwdZ < b.max.z + 0.5) {
            const topY = b.max.y;
            if (topY > fwdGround && topY <= this.position.y + 1.0) fwdGround = topY;
          }
        }
        // If ground ahead drops more than 3 units, steer sharply away
        if (fwdGround < this.position.y - 3.0) {
          this.velocity.x -= Math.sin(this.rotation) * this.speed * 1.2;
          this.velocity.z -= Math.cos(this.rotation) * this.speed * 1.2;
          if (this.patrolPts.length) this.patrolIdx = (this.patrolIdx + 1) % this.patrolPts.length;
        }
      }
    }
  }

  _getGroundBot() {
    const cols = this._colliders;
    if (!cols) return this._groundY || 0;
    let maxY = this._groundY !== undefined ? this._groundY : 0;
    const botH = 0.95;
    for (const c of cols) {
      if (c.isGround) { if (!c.isSkyKill) maxY = Math.max(maxY, c.y || 0); continue; }
      if (!c.box) continue;
      const b = c.box;
      if (this.position.x > b.min.x - 0.45 && this.position.x < b.max.x + 0.45 &&
          this.position.z > b.min.z - 0.45 && this.position.z < b.max.z + 0.45) {
        const topY = b.max.y;
        const feetY = this.position.y - botH;
        // Only snap onto top if feet are near the surface (not inside the box)
        if (topY > maxY && feetY <= topY + 0.6 && feetY >= topY - 1.8) {
          maxY = topY;
        }
      }
    }
    return maxY;
  }

  _resolveWallsBot(axis) {
    const cols = this._colliders;
    if (!cols) return;
    const pad = 0.42;
    for (const c of cols) {
      if (!c.box) continue;
      const b = c.box;
      // Only push laterally if we are inside the box vertically (not standing on top)
      const footY = this.position.y - 0.9;
      if (footY >= b.max.y - 0.05) continue; // standing on top — skip wall push
      if (this.position.y < b.min.y + 0.1)   continue; // below box — skip
      if (axis === 'x') {
        if (this.position.x > b.min.x - pad && this.position.x < b.max.x + pad &&
            this.position.z > b.min.z - pad && this.position.z < b.max.z + pad) {
          const midX = (b.min.x + b.max.x) / 2;
          if (this.position.x < midX) { this.position.x = b.min.x - pad; }
          else                        { this.position.x = b.max.x + pad; }
          this.velocity.x *= -0.1; // bounce slightly to avoid re-penetration
        }
      } else {
        if (this.position.x > b.min.x - pad && this.position.x < b.max.x + pad &&
            this.position.z > b.min.z - pad && this.position.z < b.max.z + pad) {
          const midZ = (b.min.z + b.max.z) / 2;
          if (this.position.z < midZ) { this.position.z = b.min.z - pad; }
          else                        { this.position.z = b.max.z + pad; }
          this.velocity.z *= -0.1;
        }
      }
    }
  }

  _updateHPBar() {
    if (!this.hbFill) return;
    const r = Math.max(0, this.health / this.maxHealth);
    this.hbFill.scale.x = Math.max(0.001, r);
    this.hbFill.position.x = (r - 1) * 0.45;
    this.hbFill.material.color.setHex(r > 0.5 ? 0x00ff88 : r > 0.25 ? 0xffaa00 : 0xff2200);
    if (this.shFill && this.maxShield > 0) {
      const sr = Math.max(0, this.shield / this.maxShield);
      this.shFill.scale.x = Math.max(0.001, sr);
      this.shFill.position.x = (sr - 1) * 0.45;
    }
    if (this.hpBarGrp) {
      // Billboard: face the camera by using the inverse of the world Y rotation
      // We can't easily get camera here so just negate mesh.rotation.y
      this.hpBarGrp.rotation.y = -this.mesh.rotation.y;
    }
  }

  takeDamage(amount) {
    if (!this.isAlive) return 0;
    if (this.isInvincible) return 0;
    let dmg = Math.max(1, Math.floor(amount));

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
    }
    this.health = Math.max(0, this.health - dmg);

    this._hitFlashT = 130;
    if (!this._matCache) this._buildMatCache();
    for (const m of this._matCache) { m.emissive.setHex(0xff2200); m.emissiveIntensity = 3.5; }

    if (!window._dmgQueue) window._dmgQueue = [];
    window._dmgQueue.push({ pos: this.position.clone().add(new THREE.Vector3(0, 2.5, 0)), amount: Math.round(dmg), t: performance.now() });

    // Hit spark VFX
    this._spawnHitSparks(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)));

    this.reacted = true;
    if (this.state === 'patrol' || this.state === 'search') this.state = 'chase';

    if (this.health <= 0) {
      this.health = 0; this.isAlive = false; this.deaths++;
      this._die();
    }
    return amount;
  }

  _spawnHitSparks(pos) {
    if (!this.scene) return;
    // Use shared pool — no geometry/material allocation per hit
    if (!BotAI._sparkPool) {
      const geo = new THREE.SphereGeometry(0.04, 3, 3);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true });
      BotAI._sparkPool = [];
      for (let i = 0; i < 20; i++) {
        const m = new THREE.Mesh(geo, mat.clone());
        m.visible = false;
        m._isPooled = true;
        BotAI._sparkPool.push({ mesh: m, alive: false, vel: new THREE.Vector3() });
      }
    }
    // Always ensure sparks are in THIS bot's scene (may have changed between matches)
    if (!this._sparksAdded || this._sparksScene !== this.scene) {
      for (const s of BotAI._sparkPool) {
        if (s._inScene !== this.scene) {
          this.scene.add(s.mesh);
          s._inScene = this.scene;
        }
      }
      this._sparksAdded = true;
      this._sparksScene = this.scene;
    }
    const now = performance.now();
    let spawned = 0;
    for (const s of BotAI._sparkPool) {
      if (s.alive || spawned >= 5) continue;
      s.mesh.position.copy(pos);
      s.vel.set((Math.random()-0.5)*8, Math.random()*6+2, (Math.random()-0.5)*8);
      s.t0 = now; s.alive = true; s.mesh.visible = true; s.mesh.material.opacity = 1;
      spawned++;
    }
  }
  _tickHitSparks(delta) {
    if (!BotAI._sparkPool) return;
    const dt = delta / 1000;
    for (const s of BotAI._sparkPool) {
      if (!s.alive) continue;
      const age = (performance.now() - s.t0) / 1000;
      if (age > 0.45) { s.alive = false; s.mesh.visible = false; continue; }
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 18 * dt;
      s.mesh.material.opacity = Math.max(0, 1 - age * 2.8);
    }
  }

  _buildMatCache() {
    this._matCache = []; this._matOrigEmissive = []; this._matOrigEI = [];
    this.mesh.traverse(c => {
      if (!c.isMesh || !c.material) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of mats) {
        if (m.emissive !== undefined) {
          this._matCache.push(m);
          this._matOrigEmissive.push(m.emissive.clone());
          this._matOrigEI.push(m.emissiveIntensity || 0);
        }
      }
    });
  }

  _tickHitFlash(delta) {
    if (!this._hitFlashT || this._hitFlashT <= 0) return;
    this._hitFlashT -= delta;
    if (this._hitFlashT <= 0) {
      this._hitFlashT = 0;
      if (!this._matCache) return;
      for (let i = 0; i < this._matCache.length; i++) {
        this._matCache[i].emissive.copy(this._matOrigEmissive[i]);
        this._matCache[i].emissiveIntensity = this._matOrigEI[i];
      }
    }
  }

  _die() {
    // Store death time so _tickDeath() can animate without spawning a rAF chain per bot
    this._deathT0 = performance.now();
    this._deathAnim = true;
  }

  _tickDeath(delta) {
    if (!this._deathAnim) return;
    const elapsed = performance.now() - this._deathT0;
    const pct = Math.min(1, elapsed / 600);
    this.mesh.rotation.x = pct * Math.PI / 2;
    this.mesh.position.y = this.position.y - pct * 0.6;
    if (pct >= 1) {
      this._deathAnim = false;
      // Hide mesh after fall — check 3.5s have passed
      if (elapsed > 4100) {
        if (this.scene && this.mesh.parent) this.scene.remove(this.mesh);
      }
    }
  }

  respawn(sp) {
    this._respawnPending = false;
    this._deathAnim = false;
    this.isAlive = true; this.health = this.maxHealth; this.shield = this.charDef.maxShield;
    this.position.copy(sp); this.velocity.set(0, 0, 0);
    this.mesh.rotation.x = 0; this.mesh.position.copy(this.position);
    if (!this.mesh.parent) this.scene.add(this.mesh);
    if (!this.isMeleeWeapon) this.ammo = this.wStats.magSize;
    this.isReloading = false;
    this.state = 'patrol'; this.reacted = false; this._coverPos = null;
  }
}


// ─────────────────────────────────────────────
// MAP BUILDER — Large enclosed arenas with
// full parkour, interior structures, multi-level
// ─────────────────────────────────────────────
class MapBuilder {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.spawnPoints = { a: [], b: [] };
    this.shopPositions = [];
  }

  build(mapId) {
    this.colliders = []; this.spawnPoints = { a: [], b: [] }; this.shopPositions = [];
    const fns = {
      neonCity:    () => this._neonCity(),
      jungle:      () => this._jungle(),
      desertRuins: () => this._desert(),
      neonJungle:  () => this._neonJungle(),
      cyberDesert: () => this._cyberDesert(),
      factory:     () => this._factory(),
      skyPlatforms:() => this._sky(),
      // Small maps for player-vs-player mode
      boxFight:    () => this._boxFight(),
      corridor:    () => this._corridor(),
      arena:       () => this._arena(),
    };
    (fns[mapId] || fns.neonCity)();
    return { colliders: this.colliders, spawnPoints: this.spawnPoints, shopPositions: this.shopPositions };
  }

  _texMat(col, em=0, ei=0.2, met=0.3, rou=0.6, tileType=null) {
    const mat = new THREE.MeshStandardMaterial({ color: col, metalness: met, roughness: rou,
      emissive: new THREE.Color(em||0), emissiveIntensity: em ? ei : 0 });
    if (tileType) {
      if (!MapBuilder._texCache) MapBuilder._texCache = {};
      if (!MapBuilder._texCache[tileType]) {
        const size = 128;
        const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#444'; ctx.fillRect(0,0,size,size);
        if (tileType === 'neon') { ctx.strokeStyle='rgba(0,245,255,0.15)';ctx.lineWidth=1;for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(i*16,0);ctx.lineTo(i*16,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*16);ctx.lineTo(size,i*16);ctx.stroke();} }
        else if (tileType === 'metal') { ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*16,0);ctx.lineTo(i*16,size);ctx.stroke();}ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=3;[40,80,110].forEach(y=>{ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();}); }
        else if (tileType === 'stone') { ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=2;[[0,0,90,55],[0,57,70,55],[0,114,80,55]].forEach(([x,y,w,h])=>{ctx.strokeRect(x,y,Math.min(w,size-x),Math.min(h,size-y));}); }
        else if (tileType === 'sand') { for(let i=0;i<80;i++){const x=Math.random()*size,y=Math.random()*size;ctx.fillStyle='rgba(200,165,80,0.3)';ctx.fillRect(x,y,2,2);} }
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4,4);
        MapBuilder._texCache[tileType] = tex;
      }
      mat.map = MapBuilder._texCache[tileType];
    }
    return mat;
  }

  _mat(col, em=0, ei=0.2, met=0.3, rou=0.6) { return this._texMat(col,em,ei,met,rou); }

  _box(w,h,d,x,y,z,col,em=0,opts={}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      this._mat(col,em,opts.ei??0.2,opts.m??0.3,opts.r??0.55));
    const cy = y+h/2;
    mesh.position.set(x,cy,z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.colliders.push({box: new THREE.Box3(
      new THREE.Vector3(x-w/2,cy-h/2,z-d/2),
      new THREE.Vector3(x+w/2,cy+h/2,z+d/2))});
    return mesh;
  }

  _wall(w,h,d,x,y,z,col,em=0,opts={}) { return this._box(w,h,d,x,y,z,col,em,opts); }

  _ramp(w,h,d,x,y,z,col,rotY=0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), this._mat(col,0,0,0.3,0.8));
    const cy = y+h/2; mesh.position.set(x,cy,z);
    mesh.rotation.y = rotY; mesh.rotation.x = -Math.PI/10;
    mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
    this.colliders.push({box: new THREE.Box3(new THREE.Vector3(x-w/2-0.2,y-0.2,z-d/2-0.2),new THREE.Vector3(x+w/2+0.2,cy+h/2+0.2,z+d/2+0.2))});
    return mesh;
  }

  _stairs(x,z,dir,steps,stepW,stepH,stepD,col,startY=0) {
    for(let i=0;i<steps;i++){
      const sx=x+(dir==='x'?i*stepD:0), sz=z+(dir==='z'?i*stepD:0), sy=startY+i*stepH;
      this._box(stepW,stepH,stepD,sx,sy,sz,col,0,{m:0.3,r:0.8});
    }
  }

  _cyl(rt,rb,h,x,y,z,col,em=0) {
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10),this._mat(col,em,0.3,0.5,0.3));
    const cy=y+h/2; m.position.set(x,cy,z); m.castShadow=true; this.scene.add(m);
    const r=Math.max(rt,rb);
    this.colliders.push({box:new THREE.Box3(new THREE.Vector3(x-r,cy-h/2,z-r),new THREE.Vector3(x+r,cy+h/2,z+r))});
  }

  _light(x,y,z,col,int=2,dist=20) {
    const l=new THREE.PointLight(col,int,dist); l.position.set(x,y,z); this.scene.add(l);
  }

  _amb(sky,fog,fn,ff,ai=0.45) {
    this.scene.background=new THREE.Color(sky);
    this.scene.fog=new THREE.Fog(fog,fn,ff);
    this.scene.add(new THREE.AmbientLight(0xffffff,ai));
    const d=new THREE.DirectionalLight(0xffffff,1.0);
    d.position.set(60,120,40); d.castShadow=true;
    d.shadow.mapSize.width=d.shadow.mapSize.height=1024;
    d.shadow.camera.left=d.shadow.camera.bottom=-150;
    d.shadow.camera.right=d.shadow.camera.top=150;
    this.scene.add(d);
  }

  _spawns(ax,az,bx,bz,s=8) {
    [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1.5],[0,1.5],[-1.5,0],[1.5,0]].forEach(([ox,oz]) => {
      this.spawnPoints.a.push(new THREE.Vector3(ax+ox*s*0.5,1,az+oz*s*0.5));
      this.spawnPoints.b.push(new THREE.Vector3(bx+ox*s*0.5,1,bz+oz*s*0.5));
    });
  }

  _addShop(x,z,color=0x00f5ff) {
    const base=new THREE.Mesh(new THREE.BoxGeometry(3.5,0.3,3.5),this._mat(0x111122,0,0,0.8,0.2));
    base.position.set(x,0.15,z); base.receiveShadow=true; this.scene.add(base);
    const body=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.1,0.4),this._mat(0x0a1a2a,0,0,0.9,0.1));
    body.position.set(x,0.85,z); this.scene.add(body);
    const screen=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.7,0.05),new THREE.MeshStandardMaterial({color:0,emissive:new THREE.Color(color),emissiveIntensity:0.9}));
    screen.position.set(x,0.95,z+0.23); this.scene.add(screen);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.22,0.04),new THREE.MeshBasicMaterial({color}));
    sign.position.set(x,1.65,z+0.22); this.scene.add(sign);
    [[-1.1,0.02],[1.1,0.02]].forEach(([ox,oz])=>{
      const p=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.2,6),new THREE.MeshStandardMaterial({color,emissive:new THREE.Color(color),emissiveIntensity:0.5}));
      p.position.set(x+ox,1.1,z+oz); this.scene.add(p);
    });
    const lt=new THREE.PointLight(color,2.5,9); lt.position.set(x,2.2,z); this.scene.add(lt);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.04,6,18),new THREE.MeshStandardMaterial({color,emissive:new THREE.Color(color),emissiveIntensity:1.0}));
    ring.position.set(x,1.55,z-0.6); ring.rotation.x=Math.PI/2; this.scene.add(ring);
    ring.userData.spinShop=true;
    if(!MapBuilder._shopRings) MapBuilder._shopRings=[];
    MapBuilder._shopRings.push(ring);
    this.shopPositions.push({x,z,color});
    this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,0.85,z),new THREE.Vector3(2.4,1.7,0.6))});
  }

  // ── Enclosed Arena border walls ──
  _arenaWalls(size, wallH, col, em=0) {
    const t = 2; // wall thickness
    this._box(size*2+t*2, wallH, t, 0, 0, -size, col, em, {m:0.5}); // N
    this._box(size*2+t*2, wallH, t, 0, 0,  size, col, em, {m:0.5}); // S
    this._box(t, wallH, size*2, -size, 0, 0, col, em, {m:0.5}); // W
    this._box(t, wallH, size*2,  size, 0, 0, col, em, {m:0.5}); // E
  }

  // ── NEON CITY — huge enclosed cyberpunk arena ─────────────────────────────
  _neonCity() {
    this._amb(0x020509, 0x020509, 60, 220);
    const floorMat = this._texMat(0x0d1117, 0, 0, 0.1, 0.9, 'neon');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(280,280), floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});

    // Neon grid road lines
    for(let i=-7;i<=7;i++){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(0.15,280),new THREE.MeshBasicMaterial({color:0x00f5ff,transparent:true,opacity:0.10}));
      m.rotation.x=-Math.PI/2; m.position.set(i*14,0.01,0); this.scene.add(m);
      const m2=m.clone(); m2.rotation.y=Math.PI/2; m2.position.set(0,0.01,i*14); this.scene.add(m2);
    }

    // ── ARENA PERIMETER WALLS ──────────────────
    this._arenaWalls(90, 18, 0x080f1e, 0x00f5ff);
    // Corner towers
    [[-88,0,-88],[88,0,-88],[-88,0,88],[88,0,88]].forEach(([x,y,z],i) => {
      const ac = [0x00f5ff,0xff6600,0x00aaff,0xff2200][i];
      this._box(10,30,10,x,y,z,0x06101e,ac,{ei:0.25}); this._light(x,30,z,ac,3,25);
      [8,16,24].forEach(ly => this._box(11,0.6,11,x,ly,z,0x0a1826,ac,{ei:0.3}));
      // Catwalk from corner tower to inner wall ledge
      if (x < 0 && z < 0) this._box(24,0.5,2,-76,16,-76,0x1a2a3a,0x00f5ff,{ei:0.2});
    });

    // ── TEAM A BASE (northwest) ────────────────
    // Main tower
    this._box(14,28,14,-58,0,-58,0x080e1c,0x00f5ff,{ei:0.15}); this._light(-58,28,-58,0x00f5ff,2.5,30);
    this._box(10,0.6,10,-58,28,-58,0x112233,0x00f5ff,{ei:0.3}); // rooftop
    this._box(6,0.6,6,-58,35,-58,0x1a2a3a,0x00aaff,{ei:0.4});   // upper
    this._box(3,0.6,3,-58,41,-58,0x223344,0x00f5ff,{ei:0.6});   // sniper

    // Secondary buildings
    this._box(10,18,10,-40,0,-58,0x0a1422,0x00aaff,{ei:0.12}); this._light(-40,18,-58,0x00aaff,2,22);
    this._box(12,24,12,-58,0,-40,0x080e1c,0xff6600,{ei:0.14}); this._light(-58,24,-40,0xff6600,2.5,26);
    this._box(8,14,8,-44,0,-44,0x0a1a2a,0x00f5ff,{ei:0.12});

    // Stairs & ramps into A base
    this._stairs(-64,-52,'x',7,4,3,4,0x0a1520,0);
    this._stairs(-52,-64,'z',7,4,3,4,0x0a1520,0);
    this._ramp(3.5,6,12,-50,0,-44,0x1a2233);
    this._ramp(3.5,6,12,-44,0,-50,0x1a2233,Math.PI/2);

    // Internal catwalk network A-side
    this._box(20,0.5,2,-49,18,-58,0x1a2a3a,0x00f5ff,{ei:0.2});  // A rooftop bridge 1
    this._box(2,0.5,20,-58,18,-49,0x1a2a3a,0x00aaff,{ei:0.2});  // A rooftop bridge 2
    this._box(14,0.5,2,-51,10,-44,0x1a2233,0x00f5ff,{ei:0.15}); // mid height catwalk
    this._box(2,0.5,14,-44,10,-51,0x1a2233,0x00f5ff,{ei:0.15});

    // Cover low walls inside A base
    [[-52,-52],[-46,-52],[-52,-46],[-46,-46]].forEach(([px,pz]) =>
      this._box(4,2,1.2,px,0,pz,0x1a2233,0x00f5ff,{ei:0.15}));

    // ── TEAM B BASE (southeast) ──────────────
    this._box(14,28,14,58,0,58,0x1a0808,0xff4400,{ei:0.15}); this._light(58,28,58,0xff4400,2.5,30);
    this._box(10,0.6,10,58,28,58,0x331211,0xff4400,{ei:0.3});
    this._box(6,0.6,6,58,35,58,0x3a1a1a,0xff2200,{ei:0.4});
    this._box(3,0.6,3,58,41,58,0x441a1a,0xff4400,{ei:0.6});
    this._box(10,18,10,40,0,58,0x1a0e0a,0xff8800,{ei:0.12}); this._light(40,18,58,0xff8800,2,22);
    this._box(12,24,12,58,0,40,0x180808,0xff0022,{ei:0.14}); this._light(58,24,40,0xff0022,2.5,26);
    this._box(8,14,8,44,0,44,0x1a0a0a,0xff4400,{ei:0.12});
    this._stairs(60,48,'x',7,4,3,4,0x1a0a0a,0);
    this._stairs(48,60,'z',7,4,3,4,0x1a0a0a,0);
    this._ramp(3.5,6,12,50,0,44,0x2a1a1a);
    this._ramp(3.5,6,12,44,0,50,0x2a1a1a,Math.PI/2);
    this._box(20,0.5,2,49,18,58,0x2a1a1a,0xff4400,{ei:0.2});
    this._box(2,0.5,20,58,18,49,0x2a1a1a,0xff6600,{ei:0.2});
    this._box(14,0.5,2,51,10,44,0x2a1a1a,0xff4400,{ei:0.15});
    this._box(2,0.5,14,44,10,51,0x2a1a1a,0xff4400,{ei:0.15});
    [[52,52],[46,52],[52,46],[46,46]].forEach(([px,pz]) =>
      this._box(4,2,1.2,px,0,pz,0x2a1a1a,0xff4400,{ei:0.15}));

    // ── MID ZONE — central arena with multi-level parkour ──
    // Outer cover walls in mid
    [[22,2.5,1.5,0,0,-14],[22,2.5,1.5,0,0,14],[1.5,2.5,22,-14,0,0],[1.5,2.5,22,14,0,0]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0x1a2233,0x00aaff,{ei:0.25}));

    // Central raised platform
    this._box(12,1.5,12,0,0,0,0x1a2a3a,0x00f5ff,{ei:0.45});
    this._box(7,0.6,7,0,5,0,0x223344,0x00f5ff,{ei:0.4});
    this._box(4,0.6,4,0,9,0,0x2a3a4a,0x00aaff,{ei:0.5});
    this._box(2,4,2,0,13,0,0x1a3a5a,0x00f5ff,{ei:0.7}); // spire

    // Ramps up to center platform from all 4 sides
    [[6,0,0,0],[  -6,0,0,Math.PI],[0,0,6,Math.PI/2],[0,0,-6,-Math.PI/2]].forEach(([dx,dy,dz,ry]) =>
      this._ramp(3,1.5,6,dx,0,dz,0x1a2a3a,ry));

    // Mid floating platforms — stepped vertically
    [[-24,7,0],[24,7,0],[0,7,-24],[0,7,24],
     [-18,10,18],[18,10,-18],[-18,10,-18],[18,10,18],
     [-30,4,-12],[30,4,12],[-12,4,-30],[12,4,30]].forEach(([x,y,z],i) => {
      const col = i%3===0?0x1a2233:i%3===1?0x221a33:0x1a3322;
      const ac  = i%3===0?0x00aaff:i%3===1?0xaa44ff:0x00ff88;
      this._box(7,0.5,7,x,y,z,col,ac,{ei:0.35}); this._light(x,y+3,z,ac,1.8,14);
    });

    // Connecting bridges across mid
    this._box(28,0.5,2,0,7,0,0x1a2233,0x00aaff,{ei:0.2});  // E-W bridge at height 7
    this._box(2,0.5,28,0,7,0,0x1a2233,0x00aaff,{ei:0.2});  // N-S bridge

    // Tall parkour pillars mid-lane
    [[-28,0,0],[28,0,0],[0,0,-28],[0,0,28],[-20,0,-20],[20,0,20]].forEach(([x,y,z]) => {
      this._box(2.5,16,2.5,x,y,z,0x1a2233,0x00f5ff,{ei:0.2});
      this._light(x,16,z,0x00f5ff,1.5,12);
      [4,8,12].forEach(ly => this._box(3.5,0.5,3.5,x,ly,z,0x223344,0x00f5ff,{ei:0.3}));
    });

    // ── CORRIDORS connecting bases to mid ──
    // North corridor (A→mid)
    this._box(8,5,30,-20,0,-40,0x0d1420,0x00aaff,{ei:0.08}); // corridor walls
    this._box(8,5,30, 20,0,-40,0x0d1420,0x00aaff,{ei:0.08});
    // South corridor
    this._box(8,5,30,-20,0,40,0x140d0d,0xff4400,{ei:0.08});
    this._box(8,5,30, 20,0,40,0x140d0d,0xff4400,{ei:0.08});
    // Overhead catwalk on corridors
    this._box(6,0.5,30,-20,5,-40,0x1a2a3a,0x00f5ff,{ei:0.2});
    this._box(6,0.5,30, 20,5, 40,0x2a1a1a,0xff4400,{ei:0.2});

    // Neon accent lighting
    const cols=[0x00f5ff,0xff6b00,0xff0080,0x00ff88,0xaa00ff];
    for(let i=0;i<14;i++){
      const a=(i/14)*Math.PI*2, r=50+Math.random()*32;
      this._light(Math.cos(a)*r,10+Math.random()*22,Math.sin(a)*r,cols[i%5],2,24);
    }

    this._addShop(0,0,0x00f5ff);
    this._addShop(-32,-32,0x00aaff);
    this._addShop(32,32,0xff4400);
    // Spawn in open side areas — completely clear of all structures
    this.spawnPoints.a = [
      new THREE.Vector3(-70, 1, 30), new THREE.Vector3(-74, 1, 24),
      new THREE.Vector3(-74, 1, 36), new THREE.Vector3(-78, 1, 30),
      new THREE.Vector3(-70, 1, 20), new THREE.Vector3(-70, 1, 40),
      new THREE.Vector3(-80, 1, 24), new THREE.Vector3(-80, 1, 36)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 70, 1,-30), new THREE.Vector3( 74, 1,-24),
      new THREE.Vector3( 74, 1,-36), new THREE.Vector3( 78, 1,-30),
      new THREE.Vector3( 70, 1,-20), new THREE.Vector3( 70, 1,-40),
      new THREE.Vector3( 80, 1,-24), new THREE.Vector3( 80, 1,-36)
    ];
  }

  // ── JUNGLE TEMPLE — enclosed dense arena ─────────────────────────────────
  _jungle() {
    this._amb(0x061208, 0x081408, 14, 100, 0.48);
    this.scene.fog = new THREE.Fog(0x061208, 14, 95);
    const floorMat = this._texMat(0x1a2a0a, 0, 0, 0.05, 0.98, 'stone');
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});

    // Jungle arena perimeter — stone walls with vine-covered look
    this._arenaWalls(88, 20, 0x3a2a1a, 0);
    // Wall battlements
    for(let i=-6;i<=6;i++){
      this._box(3,4,2, i*14,-1,-88,0x4a3a2a,0,{r:0.95});
      this._box(3,4,2, i*14,-1, 88,0x4a3a2a,0,{r:0.95});
      this._box(2,4,3,-88,-1,i*14,0x4a3a2a,0,{r:0.95});
      this._box(2,4,3, 88,-1,i*14,0x4a3a2a,0,{r:0.95});
    }

    // Dense tree ring (not in center)
    for(let i=0;i<50;i++){
      const a=(i/50)*Math.PI*2, r=42+Math.random()*36;
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      if(Math.abs(x)<26&&Math.abs(z)<26) continue;
      this._tree(x,z);
    }
    // A few trees in mid to break sightlines
    [[-10,8],[10,-8],[8,10],[-8,-10]].forEach(([x,z])=>this._tree(x,z));

    // ── TEAM A BASE — elevated stone fort ──────
    [[-60,-60]].forEach(([bx,bz]) => {
      // Fort walls
      this._box(28,8,2,bx,-1,bz-14,0x4a3a2a,0,{r:0.95}); // N wall
      this._box(28,8,2,bx,-1,bz+14,0x4a3a2a,0,{r:0.95}); // S wall
      this._box(2,8,28,bx-14,-1,bz,0x4a3a2a,0,{r:0.95}); // W wall
      this._box(2,8,28,bx+14,-1,bz,0x4a3a2a,0,{r:0.95}); // E wall
      // Fort floor (raised courtyard)
      this._box(26,1,26,bx,1.5,bz,0x5a4a3a,0,{r:0.9});
      // Corner towers
      [[-14,-14],[14,-14],[-14,14],[14,14]].forEach(([ox,oz]) => {
        this._box(6,14,6,bx+ox,-1,bz+oz,0x5a4a3a,0,{r:0.9});
        this._box(6.5,0.5,6.5,bx+ox,13,bz+oz,0x6a5a4a,0,{r:0.85});
        [4,9].forEach(ly=>this._box(7,0.5,7,bx+ox,ly,bz+oz,0x6a5a4a,0,{r:0.85}));
      });
      // Walkway around fort interior
      this._box(2,0.5,24,bx-13,8,bz,0x6a5a4a,0,{r:0.85});
      this._box(2,0.5,24,bx+13,8,bz,0x6a5a4a,0,{r:0.85});
      this._box(24,0.5,2,bx,8,bz-13,0x6a5a4a,0,{r:0.85});
      this._box(24,0.5,2,bx,8,bz+13,0x6a5a4a,0,{r:0.85});
      // Steps into fort
      this._stairs(bx+7,bz+14,'z',5,4,1.6,3,0x5a4a3a,2);
      // Central obelisk
      this._box(3,12,3,bx,2,bz,0x7a6a5a,0,{r:0.8});
      this._box(4,0.5,4,bx,14,bz,0x8a7a6a,0,{r:0.8});
    });

    // ── TEAM B BASE — mirrored ─────────────────
    [[60,60]].forEach(([bx,bz]) => {
      this._box(28,8,2,bx,-1,bz-14,0x4a3a2a,0,{r:0.95});
      this._box(28,8,2,bx,-1,bz+14,0x4a3a2a,0,{r:0.95});
      this._box(2,8,28,bx-14,-1,bz,0x4a3a2a,0,{r:0.95});
      this._box(2,8,28,bx+14,-1,bz,0x4a3a2a,0,{r:0.95});
      this._box(26,1,26,bx,1.5,bz,0x5a4a3a,0,{r:0.9});
      [[-14,-14],[14,-14],[-14,14],[14,14]].forEach(([ox,oz]) => {
        this._box(6,14,6,bx+ox,-1,bz+oz,0x5a4a3a,0,{r:0.9});
        this._box(6.5,0.5,6.5,bx+ox,13,bz+oz,0x6a5a4a,0,{r:0.85});
        [4,9].forEach(ly=>this._box(7,0.5,7,bx+ox,ly,bz+oz,0x6a5a4a,0,{r:0.85}));
      });
      this._box(2,0.5,24,bx-13,8,bz,0x6a5a4a,0,{r:0.85});
      this._box(2,0.5,24,bx+13,8,bz,0x6a5a4a,0,{r:0.85});
      this._box(24,0.5,2,bx,8,bz-13,0x6a5a4a,0,{r:0.85});
      this._box(24,0.5,2,bx,8,bz+13,0x6a5a4a,0,{r:0.85});
      this._stairs(bx-7,bz-14,'z',5,4,1.6,-3,0x5a4a3a,2);
      this._box(3,12,3,bx,2,bz,0x7a6a5a,0,{r:0.8});
      this._box(4,0.5,4,bx,14,bz,0x8a7a6a,0,{r:0.8});
    });

    // ── TEMPLE COMPLEX (center) ────────────────
    // Outer compound walls
    [[32,2.5,2,0,-1,-18],[32,2.5,2,0,-1,18],[2,2.5,32,-16,-1,0],[2,2.5,32,16,-1,0]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0x4a3a2a,0,{r:0.95}));
    // Gates (gaps in walls)
    // Temple pillars
    [[-10,-10],[10,-10],[-10,10],[10,10],[-10,0],[10,0],[0,-10],[0,10]].forEach(([px,pz]) =>
      this._cyl(0.6,0.7,10,px,-1,pz,0x5a4a3a));
    // Stepped pyramid
    [[14,0.9,14,0,-1,0],[10,0.9,10,0,0,0],[7,1.0,7,0,0.9,0],[4,1.2,4,0,1.9,0],[2.5,2,2.5,0,3.1,0]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0x8a7a5a,0,{r:0.85}));
    // Stairs to pyramid from all 4 sides
    for(let s=0;s<4;s++){
      const a=s*(Math.PI/2), cos=Math.cos(a), sinA=Math.sin(a);
      for(let i=0;i<4;i++){
        const dist=8-i*1.8, sy=i*0.9;
        this._box(3,0.6,2,dist*cos,sy-1,dist*sinA,0x9a8a6a,0,{r:0.9});
      }
    }
    // Raised outer platforms
    [[-22,0],[22,0],[0,-22],[0,22],[-16,16],[16,-16],[-16,-16],[16,16]].forEach(([px,pz],i) => {
      const h=3+i%3*1.5;
      this._box(5,h,5,px,-1,pz,0x4a3a2a,0,{r:0.95});
      this._box(5,0.5,5,px,h-1,pz,0x5a4a3a,0,{r:0.9});
      // Parkour step to platform
      this._box(3,h*0.5,2,px+(px>0?-3.5:3.5),h*0.25-1,pz,0x4a3a2a,0,{r:0.95});
    });
    // Bridges from outer platforms
    this._box(22,0.5,2,0,5,0,0x6b4423,0,{r:1});
    this._box(2,0.5,22,0,5,0,0x6b4423,0,{r:1});

    // Ambient jungle lights
    const gc=[0x00ff44,0x44ff88,0x00ffaa,0x88ff44];
    for(let i=0;i<16;i++){
      const x=(Math.random()-0.5)*160, z=(Math.random()-0.5)*160;
      this._light(x,3+Math.random()*6,z,gc[i%4],1.4,18);
    }

    this._addShop(0,-5,0x00ff44);
    this._addShop(-36,0,0x44ff88);
    this._addShop(36,0,0x44ff88);
    // Spawn along open side lanes — clear of forts and dense tree ring
    this.spawnPoints.a = [
      new THREE.Vector3(-78, 1,-12), new THREE.Vector3(-78, 1, -4),
      new THREE.Vector3(-78, 1,  4), new THREE.Vector3(-78, 1, 12),
      new THREE.Vector3(-82, 1, -8), new THREE.Vector3(-82, 1,  8),
      new THREE.Vector3(-74, 1, -6), new THREE.Vector3(-74, 1,  6)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 78, 1, 12), new THREE.Vector3( 78, 1,  4),
      new THREE.Vector3( 78, 1, -4), new THREE.Vector3( 78, 1,-12),
      new THREE.Vector3( 82, 1,  8), new THREE.Vector3( 82, 1, -8),
      new THREE.Vector3( 74, 1,  6), new THREE.Vector3( 74, 1, -6)
    ];
  }

  _tree(x,z) {
    const h=6+Math.random()*10, r=0.28+Math.random()*0.14;
    const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.5,h,6),new THREE.MeshStandardMaterial({color:0x3a2210,roughness:1}));
    t.position.set(x,h/2,z); this.scene.add(t);
    this.colliders.push({box:new THREE.Box3(new THREE.Vector3(x-0.5,0,z-0.5),new THREE.Vector3(x+0.5,h,z+0.5))});
    [0x0a3a08,0x0d4a0a,0x0a5a0c].forEach((lc,i)=>{
      const l=new THREE.Mesh(new THREE.ConeGeometry(2.5-i*0.4,3+i,6),new THREE.MeshStandardMaterial({color:lc,roughness:0.9}));
      l.position.set(x,h-1+i*2,z); this.scene.add(l);
    });
  }

  // ── DESERT RUINS — arena with pyramid + fortresses ───────────────────────
  _desert() {
    this._amb(0x1a1208, 0xc8a850, 40, 180);
    const floorMat = this._texMat(0xc8a850,0,0,0.05,0.98,'sand');
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});
    const sun=new THREE.DirectionalLight(0xffa844,1.8); sun.position.set(80,100,40); sun.castShadow=true; this.scene.add(sun);

    // Sandstone arena perimeter walls
    this._arenaWalls(88, 12, 0xc8a850, 0);
    // Battlements on walls
    for(let i=-5;i<=5;i++){
      [[i*16,-88],[i*16,88]].forEach(([x,z]) => this._box(5,5,2,x,12,z,0xb89840,0,{r:0.95}));
      [[-88,i*16],[88,i*16]].forEach(([x,z]) => this._box(2,5,5,x,12,z,0xb89840,0,{r:0.95}));
    }
    // Corner obelisks
    [[-88,-88],[88,-88],[-88,88],[88,88]].forEach(([x,z]) => {
      this._box(4,28,4,x,-1,z,0xaa8830,0,{r:0.9}); this._light(x,28,z,0xffaa00,3,14);
      [8,16,24].forEach(ly => this._box(5.5,0.5,5.5,x,ly,z,0xaa8830,0x442200,{ei:0.2}));
    });

    // ── TEAM A FORTRESS ──────────────────────
    [[-62,-62]].forEach(([bx,bz]) => {
      // Fortress walls
      this._box(30,10,2.5,bx,-1,bz-15,0xb89840,0,{r:0.95});
      this._box(30,10,2.5,bx,-1,bz+15,0xb89840,0,{r:0.95});
      this._box(2.5,10,30,bx-15,-1,bz,0xb89840,0,{r:0.95});
      this._box(2.5,10,30,bx+15,-1,bz,0xb89840,0,{r:0.95});
      // Gate (break in wall)
      // Towers
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(7,16,7,bx+ox,-1,bz+oz,0xaa8830,0,{r:0.9});
        this._box(7.5,0.5,7.5,bx+ox,15,bz+oz,0xaa8830,0,{r:0.85});
        [4,8,12].forEach(ly => this._box(8,0.5,8,bx+ox,ly,bz+oz,0xaa8830,0,{r:0.9}));
      });
      // Interior catwalk
      this._box(2,0.5,28,bx-14,10,bz,0xaa8830,0,{r:0.9});
      this._box(2,0.5,28,bx+14,10,bz,0xaa8830,0,{r:0.9});
      this._box(28,0.5,2,bx,10,bz-14,0xaa8830,0,{r:0.9});
      this._box(28,0.5,2,bx,10,bz+14,0xaa8830,0,{r:0.9});
      // Steps
      this._stairs(bx+7,bz+15,'z',5,4,2,3,0xb89840,0);
      // Central cistern
      this._cyl(5,5.5,2,bx,-1,bz,0x887755);
    });

    // ── TEAM B FORTRESS ─────────────────────
    [[62,62]].forEach(([bx,bz]) => {
      this._box(30,10,2.5,bx,-1,bz-15,0xb89840,0,{r:0.95});
      this._box(30,10,2.5,bx,-1,bz+15,0xb89840,0,{r:0.95});
      this._box(2.5,10,30,bx-15,-1,bz,0xb89840,0,{r:0.95});
      this._box(2.5,10,30,bx+15,-1,bz,0xb89840,0,{r:0.95});
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(7,16,7,bx+ox,-1,bz+oz,0xaa8830,0,{r:0.9});
        this._box(7.5,0.5,7.5,bx+ox,15,bz+oz,0xaa8830,0,{r:0.85});
        [4,8,12].forEach(ly => this._box(8,0.5,8,bx+ox,ly,bz+oz,0xaa8830,0,{r:0.9}));
      });
      this._box(2,0.5,28,bx-14,10,bz,0xaa8830,0,{r:0.9});
      this._box(2,0.5,28,bx+14,10,bz,0xaa8830,0,{r:0.9});
      this._box(28,0.5,2,bx,10,bz-14,0xaa8830,0,{r:0.9});
      this._box(28,0.5,2,bx,10,bz+14,0xaa8830,0,{r:0.9});
      this._stairs(bx-7,bz-15,'z',5,4,2,-3,0xb89840,0);
      this._cyl(5,5.5,2,bx,-1,bz,0x887755);
    });

    // ── CENTRAL PYRAMID — full climbable ──
    [[16,3,0,0],[11,3,0,3],[7.5,3,0,6],[5,3,0,9],[3,3,0,12],[1.8,3,0,15]].forEach(([s,h,ox,sy]) =>
      this._box(s*2,h,s*2,ox,-1+sy,ox,0xc8a850,0,{r:0.95}));
    // Stair ramps up all 4 sides
    for(let side=0;side<4;side++){
      const a=side*(Math.PI/2);
      for(let i=0;i<5;i++){
        const dist=15-i*2.8, sy=i*3;
        this._box(3,0.6,2.5, Math.cos(a)*dist, sy-1, Math.sin(a)*dist, 0xb89840,0,{r:0.95});
      }
    }
    // Pyramid top platform
    this._box(3.5,0.6,3.5,0,17.5,0,0xaa8830,0x442200,{ei:0.3});

    // Rubble / cover scattered around
    [[-34,-8],[34,8],[-8,34],[8,-34],[24,-24],[-24,24],[40,0],[0,40],[-40,0],[0,-40]].forEach(([px,pz]) =>
      this._box(3+Math.random()*3,1.5+Math.random()*4,2.5+Math.random()*2,px,-1,pz,0xb89840,0,{r:0.95}));

    // Mid ruins (broken walls)
    [[-18,0],[18,0],[0,-18],[0,18],[-12,-12],[12,12]].forEach(([px,pz]) => {
      this._box(6,5,1.5,px,-1,pz,0xaa8830,0,{r:0.95});
      this._box(3,2,1.5,px+3,4,pz,0xaa8830,0,{r:0.95}); // broken top
    });

    this._addShop(0,22,0xffaa00);
    this._addShop(-36,-8,0xffaa00);
    this._addShop(36,-8,0xffaa00);
    // Spawn in open desert quadrants opposite to enemy base
    this.spawnPoints.a = [
      new THREE.Vector3(-62, 1, 58), new THREE.Vector3(-68, 1, 52),
      new THREE.Vector3(-56, 1, 52), new THREE.Vector3(-74, 1, 58),
      new THREE.Vector3(-62, 1, 64), new THREE.Vector3(-50, 1, 58),
      new THREE.Vector3(-68, 1, 64), new THREE.Vector3(-56, 1, 64)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 62, 1,-58), new THREE.Vector3( 68, 1,-52),
      new THREE.Vector3( 56, 1,-52), new THREE.Vector3( 74, 1,-58),
      new THREE.Vector3( 62, 1,-64), new THREE.Vector3( 50, 1,-58),
      new THREE.Vector3( 68, 1,-64), new THREE.Vector3( 56, 1,-64)
    ];
  }

  // ── NEON JUNGLE — cyber-organic arena ────────────────────────────────────
  _neonJungle() {
    this._amb(0x010802, 0x010a01, 18, 110, 0.35);
    this.scene.fog = new THREE.Fog(0x010a01, 16, 100);
    const floorMat=this._texMat(0x0a1a08,0,0,0.05,0.98,'stone');
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});

    // Bioluminescent perimeter walls
    this._arenaWalls(88, 22, 0x0a1a0a, 0x00ff44);
    // Wall spires
    for(let i=-5;i<=5;i++){
      this._cyl(0.6,0.9,10,i*16,-1,-88,0x0a2a0a,0x00ff44);
      this._cyl(0.6,0.9,10,i*16,-1, 88,0x0a2a0a,0x00ff44);
      this._cyl(0.6,0.9,10,-88,-1,i*16,0x0a2a0a,0x44ff88);
      this._cyl(0.6,0.9,10, 88,-1,i*16,0x0a2a0a,0x44ff88);
    }

    // Dense outer tree ring
    for(let i=0;i<44;i++){
      const a=(i/44)*Math.PI*2, r=46+Math.random()*32;
      this._cyberTree(Math.cos(a)*r,Math.sin(a)*r);
    }
    // Inner trees breaking sightlines
    [[-16,8],[16,-8],[8,16],[-8,-16],[-22,22],[22,-22]].forEach(([x,z])=>this._cyberTree(x,z));

    const tc=[0x00ff44,0x00ffaa,0xff00aa,0xaaff00,0x00aaff];

    // ── TEAM A BASE — bioluminescent hive ────
    [[-62,-62]].forEach(([bx,bz]) => {
      // Organic walls
      this._box(28,12,2.5,bx,-1,bz-14,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(28,12,2.5,bx,-1,bz+14,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(2.5,12,28,bx-14,-1,bz,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(2.5,12,28,bx+14,-1,bz,0x0a2a0a,0x00ff44,{ei:0.2});
      // Bio-towers (corners)
      [[-14,-14],[14,-14],[-14,14],[14,14]].forEach(([ox,oz],i) => {
        const ac=tc[i%tc.length];
        this._box(6,18,6,bx+ox,-1,bz+oz,0x0a2a0a,ac,{ei:0.3});
        this._light(bx+ox,18,bz+oz,ac,2,16);
        [5,10,15].forEach(ly=>this._box(7,0.5,7,bx+ox,ly,bz+oz,0x0a2a0a,ac,{ei:0.25}));
      });
      this._box(2,0.5,26,bx-13,12,bz,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(2,0.5,26,bx+13,12,bz,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(26,0.5,2,bx,12,bz-13,0x0a2a0a,0x00ff44,{ei:0.2});
      this._box(26,0.5,2,bx,12,bz+13,0x0a2a0a,0x00ff44,{ei:0.2});
      this._stairs(bx+7,bz+14,'z',5,4,2.4,3,0x0a2a0a,0);
    });

    // ── TEAM B BASE ───────────────────────────
    [[62,62]].forEach(([bx,bz]) => {
      this._box(28,12,2.5,bx,-1,bz-14,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(28,12,2.5,bx,-1,bz+14,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(2.5,12,28,bx-14,-1,bz,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(2.5,12,28,bx+14,-1,bz,0x1a0a0a,0xff00aa,{ei:0.2});
      [[-14,-14],[14,-14],[-14,14],[14,14]].forEach(([ox,oz],i) => {
        const ac=[0xff00aa,0xaaff00,0x00aaff,0xffaa00][i];
        this._box(6,18,6,bx+ox,-1,bz+oz,0x1a0a0a,ac,{ei:0.3});
        this._light(bx+ox,18,bz+oz,ac,2,16);
        [5,10,15].forEach(ly=>this._box(7,0.5,7,bx+ox,ly,bz+oz,0x1a0a0a,ac,{ei:0.25}));
      });
      this._box(2,0.5,26,bx-13,12,bz,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(2,0.5,26,bx+13,12,bz,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(26,0.5,2,bx,12,bz-13,0x1a0a0a,0xff00aa,{ei:0.2});
      this._box(26,0.5,2,bx,12,bz+13,0x1a0a0a,0xff00aa,{ei:0.2});
      this._stairs(bx-7,bz-14,'z',5,4,2.4,-3,0x1a0a0a,0);
    });

    // ── CENTRAL HIVE TOWER ────────────────────
    [[24,0.6,24,0,4,0],[16,0.6,16,0,9,0],[10,0.6,10,0,14,0],[6,0.6,6,0,20,0],[3,4,3,0,23,0]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0x1a2a1a,0x00ff44,{ei:0.3}));
    // Ramps to center
    [[8,0,0,0],[  -8,0,0,Math.PI],[0,0,8,Math.PI/2],[0,0,-8,-Math.PI/2]].forEach(([dx,dy,dz,ry]) =>
      this._ramp(3.5,2,8,dx,2,dz,0x1a2a1a,ry));

    // Cybertowers mid-ring
    for(let i=0;i<10;i++){
      const a=(i/10)*Math.PI*2, r=32+Math.random()*10, h=14+Math.random()*20;
      const cx=Math.cos(a)*r, cz=Math.sin(a)*r, c=tc[i%5];
      this._box(7,h,7,cx,-1,cz,0x0a1a0a,c,{ei:0.28}); this._light(cx,h*0.8,cz,c,2.2,18);
      [Math.floor(h*0.4),Math.floor(h*0.75)].forEach(ly => this._box(8,0.5,8,cx,ly,cz,0x0a2a0a,c,{ei:0.22}));
    }

    // Rope bridges between towers
    [[-22,9,-22,22,9,-22],[-22,9,22,22,9,22],[-22,9,-22,-22,9,22],[22,9,-22,22,9,22]].forEach(([x1,y1,z1,x2,y2,z2]) => {
      const mx=(x1+x2)/2, mz=(z1+z2)/2, dx=x2-x1, dz=z2-z1, d=Math.sqrt(dx*dx+dz*dz);
      const bridge=new THREE.Mesh(new THREE.BoxGeometry(d,0.4,2),this._mat(0x3a2a0a,0x00ff44,0.15,0.3,0.9));
      bridge.position.set(mx,y1,mz); bridge.rotation.y=Math.atan2(dz,dx)+Math.PI/2;
      this.scene.add(bridge);
      this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(mx,y1,mz),new THREE.Vector3(d+1,0.8,2.5))});
    });

    // Glowing mushrooms / bio-pillars
    for(let i=0;i<14;i++){
      const x=(Math.random()-0.5)*70, z=(Math.random()-0.5)*70;
      this._box(1.5,2+Math.random()*3,1.5,x,-1,z,0x0a2a0a,tc[i%5],{ei:0.55});
    }

    this._addShop(0,4,0x00ff44);
    this._addShop(-28,-28,0x00ffaa);
    this._addShop(28,28,0xaaff00);
    // Spawn in open clearings — NE/SW quadrants, clear of hive bases
    this.spawnPoints.a = [
      new THREE.Vector3(-62, 1, 55), new THREE.Vector3(-68, 1, 50),
      new THREE.Vector3(-56, 1, 50), new THREE.Vector3(-74, 1, 55),
      new THREE.Vector3(-62, 1, 62), new THREE.Vector3(-50, 1, 55),
      new THREE.Vector3(-68, 1, 62), new THREE.Vector3(-55, 1, 62)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 62, 1,-55), new THREE.Vector3( 68, 1,-50),
      new THREE.Vector3( 56, 1,-50), new THREE.Vector3( 74, 1,-55),
      new THREE.Vector3( 62, 1,-62), new THREE.Vector3( 50, 1,-55),
      new THREE.Vector3( 68, 1,-62), new THREE.Vector3( 55, 1,-62)
    ];
  }

  _cyberTree(x,z) {
    const h=8+Math.random()*14, r=0.28+Math.random()*0.1;
    const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.5,h,6),new THREE.MeshStandardMaterial({color:0x0a2a08,roughness:0.9,emissive:new THREE.Color(0x002200),emissiveIntensity:0.3}));
    t.position.set(x,h/2,z); this.scene.add(t);
    this.colliders.push({box:new THREE.Box3(new THREE.Vector3(x-0.5,0,z-0.5),new THREE.Vector3(x+0.5,h,z+0.5))});
    [0x00ff44,0x00ffaa,0xaaff00].forEach((c,i)=>{
      const l=new THREE.Mesh(new THREE.ConeGeometry(2-i*0.3,2.5+i,6),new THREE.MeshStandardMaterial({color:0x0a2a08,emissive:new THREE.Color(c),emissiveIntensity:0.4,roughness:0.8}));
      l.position.set(x,h-0.5+i*2,z); this.scene.add(l);
    });
  }

  // ── CYBER DESERT — hardened facility arena ───────────────────────────────
  _cyberDesert() {
    this._amb(0x100c00, 0x201800, 45, 180);
    const floorMat=this._texMat(0x2a1e08,0,0,0.05,0.98,'sand');
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});

    this._arenaWalls(88, 14, 0xb89840, 0xffaa00);
    [[-88,-88],[88,-88],[-88,88],[88,88]].forEach(([x,z]) => {
      this._box(12,30,12,x,-1,z,0xb89840,0xffaa00,{ei:0.3}); this._light(x,30,z,0xffaa00,3,20);
      [8,16,24].forEach(ly=>this._box(13,0.5,13,x,ly,z,0xcc9940,0xffaa00,{ei:0.35}));
    });

    // A base
    [[-62,-62]].forEach(([bx,bz]) => {
      this._box(30,10,2.5,bx,-1,bz-15,0xb89840,0x00aaff,{ei:0.25});
      this._box(30,10,2.5,bx,-1,bz+15,0xb89840,0x00aaff,{ei:0.25});
      this._box(2.5,10,30,bx-15,-1,bz,0xb89840,0x00aaff,{ei:0.25});
      this._box(2.5,10,30,bx+15,-1,bz,0xb89840,0x00aaff,{ei:0.25});
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(8,18,8,bx+ox,-1,bz+oz,0xaa8830,0x00aaff,{ei:0.3});
        this._light(bx+ox,18,bz+oz,0x00aaff,2,16);
        [5,10,15].forEach(ly=>this._box(9,0.5,9,bx+ox,ly,bz+oz,0xcc9940,0x00aaff,{ei:0.3}));
      });
      this._box(2,0.5,28,bx-14,10,bz,0xcc9940,0x00aaff,{ei:0.2});
      this._box(2,0.5,28,bx+14,10,bz,0xcc9940,0x00aaff,{ei:0.2});
      this._box(28,0.5,2,bx,10,bz-14,0xcc9940,0x00aaff,{ei:0.2});
      this._box(28,0.5,2,bx,10,bz+14,0xcc9940,0x00aaff,{ei:0.2});
      this._stairs(bx+7,bz+15,'z',5,4,2,3,0xb89840,0);
    });

    // B base
    [[62,62]].forEach(([bx,bz]) => {
      this._box(30,10,2.5,bx,-1,bz-15,0xb89840,0xff6600,{ei:0.25});
      this._box(30,10,2.5,bx,-1,bz+15,0xb89840,0xff6600,{ei:0.25});
      this._box(2.5,10,30,bx-15,-1,bz,0xb89840,0xff6600,{ei:0.25});
      this._box(2.5,10,30,bx+15,-1,bz,0xb89840,0xff6600,{ei:0.25});
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(8,18,8,bx+ox,-1,bz+oz,0xaa8830,0xff6600,{ei:0.3});
        this._light(bx+ox,18,bz+oz,0xff6600,2,16);
        [5,10,15].forEach(ly=>this._box(9,0.5,9,bx+ox,ly,bz+oz,0xcc9940,0xff6600,{ei:0.3}));
      });
      this._box(2,0.5,28,bx-14,10,bz,0xcc9940,0xff6600,{ei:0.2});
      this._box(2,0.5,28,bx+14,10,bz,0xcc9940,0xff6600,{ei:0.2});
      this._box(28,0.5,2,bx,10,bz-14,0xcc9940,0xff6600,{ei:0.2});
      this._box(28,0.5,2,bx,10,bz+14,0xcc9940,0xff6600,{ei:0.2});
      this._stairs(bx-7,bz-15,'z',5,4,2,-3,0xb89840,0);
    });

    // Central structure + platforms
    [[24,1.6,24,0,3,0],[16,1.6,16,0,6,0],[10,1.6,10,0,9,0],[6,1.6,6,0,12,0]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0xcc9940,0xffaa00,{ei:0.4}));
    // Cross bridges
    this._box(28,0.5,3.5,0,10,0,0xcc9940,0xffaa00,{ei:0.35});
    this._box(3.5,0.5,28,0,10,0,0xcc9940,0xffaa00,{ei:0.35});
    // Mid obelisks
    [[-36,0],[36,0],[0,-36],[0,36]].forEach(([px,pz]) => {
      this._box(3,22,3,px,-1,pz,0xb89840,0,{r:0.9}); this._light(px,22,pz,0xffaa00,3,14);
      [6,12,18].forEach(ly=>this._box(4.5,0.5,4.5,px,ly,pz,0xcc9940,0xffaa00,{ei:0.35}));
      this._ramp(3,6,10,px+(px>0?-4:4),0,pz,0xb89840);
    });
    // Rubble + cover
    for(let i=0;i<14;i++){
      const x=-50+Math.random()*100, z=-50+Math.random()*100;
      this._box(2+Math.random()*4,1+Math.random()*3,2+Math.random()*3,x,-1,z,0xb89840,[0x00aaff,0xff6600,0x00ff88][i%3],{ei:0.4});
    }

    this._addShop(0,0,0xff8800);
    this._addShop(-28,28,0x00aaff);
    this._addShop(28,-28,0xff00aa);
    // Spawn in open areas — NE/SW quadrants clear of bases
    this.spawnPoints.a = [
      new THREE.Vector3(-62, 1, 55), new THREE.Vector3(-68, 1, 50),
      new THREE.Vector3(-56, 1, 50), new THREE.Vector3(-74, 1, 55),
      new THREE.Vector3(-62, 1, 62), new THREE.Vector3(-50, 1, 55),
      new THREE.Vector3(-68, 1, 62), new THREE.Vector3(-55, 1, 62)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 62, 1,-55), new THREE.Vector3( 68, 1,-50),
      new THREE.Vector3( 56, 1,-50), new THREE.Vector3( 74, 1,-55),
      new THREE.Vector3( 62, 1,-62), new THREE.Vector3( 50, 1,-55),
      new THREE.Vector3( 68, 1,-62), new THREE.Vector3( 55, 1,-62)
    ];
  }

  // ── FACTORY — industrial arena with conveyor platforms ───────────────────
  _factory() {
    this._amb(0x080606, 0x100808, 30, 140);
    const floorMat=this._texMat(0x1a1212,0,0,0.8,0.4,'metal');
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),floorMat);
    floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
    this.scene.add(floor); this.colliders.push({isGround:true,y:0});
    this.scene.add(Object.assign(new THREE.DirectionalLight(0xff6600,0.5),{position:new THREE.Vector3(-50,80,-30)}));

    // Industrial arena walls with grating
    this._arenaWalls(88, 24, 0x1a1a1a, 0xff4400);
    // Pipes on walls
    for(let i=-4;i<=4;i++){
      this._cyl(0.4,0.4,24,i*20,-1,-88,0x222222,0xff6600);
      this._cyl(0.4,0.4,24,i*20,-1, 88,0x222222,0xff6600);
    }

    // A base
    [[-62,-62]].forEach(([bx,bz]) => {
      this._box(30,12,2.5,bx,-1,bz-15,0x1a1a1a,0xff6600,{m:0.9,r:0.2,ei:0.2});
      this._box(30,12,2.5,bx,-1,bz+15,0x1a1a1a,0xff6600,{m:0.9,r:0.2,ei:0.2});
      this._box(2.5,12,30,bx-15,-1,bz,0x1a1a1a,0xff6600,{m:0.9,r:0.2,ei:0.2});
      this._box(2.5,12,30,bx+15,-1,bz,0x1a1a1a,0xff6600,{m:0.9,r:0.2,ei:0.2});
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(10,20,10,bx+ox,-1,bz+oz,0x1a1a1a,0xff4400,{m:0.9,r:0.2,ei:0.22});
        this._light(bx+ox,20,bz+oz,0xff6600,3,20);
        [4,8,12,16].forEach(ly=>this._box(11,0.5,11,bx+ox,ly,bz+oz,0x282828,0xff6600,{m:0.8,ei:0.2}));
      });
      this._box(2,0.5,28,bx-14,12,bz,0x333333,0xff6600,{m:0.8,ei:0.15});
      this._box(2,0.5,28,bx+14,12,bz,0x333333,0xff6600,{m:0.8,ei:0.15});
      this._box(28,0.5,2,bx,12,bz-14,0x333333,0xff6600,{m:0.8,ei:0.15});
      this._box(28,0.5,2,bx,12,bz+14,0x333333,0xff6600,{m:0.8,ei:0.15});
      this._stairs(bx+7,bz+15,'z',5,4,2.4,3,0x2a2a2a,0);
    });

    // B base
    [[62,62]].forEach(([bx,bz]) => {
      this._box(30,12,2.5,bx,-1,bz-15,0x1a1a1a,0xffaa00,{m:0.9,r:0.2,ei:0.2});
      this._box(30,12,2.5,bx,-1,bz+15,0x1a1a1a,0xffaa00,{m:0.9,r:0.2,ei:0.2});
      this._box(2.5,12,30,bx-15,-1,bz,0x1a1a1a,0xffaa00,{m:0.9,r:0.2,ei:0.2});
      this._box(2.5,12,30,bx+15,-1,bz,0x1a1a1a,0xffaa00,{m:0.9,r:0.2,ei:0.2});
      [[-15,-15],[15,-15],[-15,15],[15,15]].forEach(([ox,oz]) => {
        this._box(10,20,10,bx+ox,-1,bz+oz,0x1a1a1a,0xffaa00,{m:0.9,r:0.2,ei:0.22});
        this._light(bx+ox,20,bz+oz,0xffaa00,3,20);
        [4,8,12,16].forEach(ly=>this._box(11,0.5,11,bx+ox,ly,bz+oz,0x282828,0xffaa00,{m:0.8,ei:0.2}));
      });
      this._box(2,0.5,28,bx-14,12,bz,0x333333,0xffaa00,{m:0.8,ei:0.15});
      this._box(2,0.5,28,bx+14,12,bz,0x333333,0xffaa00,{m:0.8,ei:0.15});
      this._box(28,0.5,2,bx,12,bz-14,0x333333,0xffaa00,{m:0.8,ei:0.15});
      this._box(28,0.5,2,bx,12,bz+14,0x333333,0xffaa00,{m:0.8,ei:0.15});
      this._stairs(bx-7,bz-15,'z',5,4,2.4,-3,0x2a2a2a,0);
    });

    // Central machinery
    this._box(8,5,8,0,-1,0,0x222222,0x444444,{m:0.9,r:0.2});
    this._box(5,4,5,0,4,0,0x2a2a2a,0x555555,{m:0.9,r:0.2});
    this._box(3,5,3,0,8,0,0x333333,0xff4400,{ei:0.4,m:0.9});
    // Conveyor platforms
    [[-22,-1,0],[22,-1,0],[0,-1,-22],[0,-1,22]].forEach(([x,y,z]) =>
      this._box(4,0.5,4,x,6,z,0x334444,0x00aaff,{ei:0.22,m:0.7}));
    // Main catwalks
    [[38,0.6,4,0,10,0],[4,0.6,38,0,10,0],[26,0.5,3.5,0,6,-28],[26,0.5,3.5,0,6,28]].forEach(([w,h,d,x,y,z]) =>
      this._box(w,h,d,x,y,z,0x333344,0x00aaff,{m:0.7,ei:0.15}));
    // Factory chimneys with platforms
    [[-36,-1,-36],[-36,-1,36],[36,-1,-36],[36,-1,36]].forEach(([x,y,z]) => {
      this._cyl(1.0,1.2,30,x,y,z,0x222222,0x444444); this._light(x,30,z,0xff4400,2,18);
      [8,16,22].forEach(ly=>this._box(4,0.5,4,x,ly,z,0x333333,0xff6600,{ei:0.2}));
    });
    // Crates for cover
    for(let i=0;i<22;i++){
      const x=-30+(i%6)*12, z=-20+Math.floor(i/6)*14;
      this._box(2+Math.random(),2+Math.random()*1.5,2.5+Math.random(),x,-1,z,0x333333);
    }
    this._stairs(-20,0,'z',6,3,1.8,2.5,0x2a2a2a,0);
    this._stairs(18,0,'z',6,3,1.8,2.5,0x2a2a2a,0);
    for(let i=0;i<12;i++){
      const x=-50+(i%6)*20, z=-30+Math.floor(i/6)*24;
      this._light(x,18,z,[0xff6600,0xffaa00,0xff4400][i%3],3,28);
    }

    this._addShop(0,0,0xff4400);
    this._addShop(-26,-26,0xffaa00);
    this._addShop(26,26,0xff6600);
    // Spawn along open side lanes — away from all factory structures
    this.spawnPoints.a = [
      new THREE.Vector3(-76, 1,-12), new THREE.Vector3(-76, 1, -4),
      new THREE.Vector3(-76, 1,  4), new THREE.Vector3(-76, 1, 12),
      new THREE.Vector3(-80, 1, -8), new THREE.Vector3(-80, 1,  8),
      new THREE.Vector3(-72, 1, -6), new THREE.Vector3(-72, 1,  6)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3( 76, 1, 12), new THREE.Vector3( 76, 1,  4),
      new THREE.Vector3( 76, 1, -4), new THREE.Vector3( 76, 1,-12),
      new THREE.Vector3( 80, 1,  8), new THREE.Vector3( 80, 1, -8),
      new THREE.Vector3( 72, 1,  6), new THREE.Vector3( 72, 1, -6)
    ];
  }

  // ── BOX FIGHT — tiny symmetrical box arena ──────────────────────────────
  _boxFight() {
    this._amb(0x080818, 0x0d1022, 60, 120, 0.85);
    this.colliders.push({ isGround: true, y: -1 });
    // Floor
    this._box(32, 1, 32, 0, -1.5, 0, 0x1a1a2a, 0x4466ff, { ei: 0.3 });
    // Walls
    this._box(32, 6, 1, 0, 2, -16, 0x1a1a2a, 0x4466ff, { ei: 0.2 });
    this._box(32, 6, 1, 0, 2, 16, 0x1a1a2a, 0x4466ff, { ei: 0.2 });
    this._box(1, 6, 32, -16, 2, 0, 0x1a1a2a, 0x4466ff, { ei: 0.2 });
    this._box(1, 6, 32, 16, 2, 0, 0x1a1a2a, 0x4466ff, { ei: 0.2 });
    // Cover boxes (symmetrical)
    [[-5,0,-3],[5,0,-3],[-5,0,3],[5,0,3],[0,0,-7],[0,0,7]].forEach(([x,y,z]) => {
      this._box(2.5, 1.5, 2.5, x, y, z, 0x223344, 0x00aaff, { ei: 0.25 });
    });
    // Elevated platforms
    [[-7,0,0],[7,0,0],[0,0,-7],[0,0,7]].forEach(([x,y,z]) => {
      this._box(4, 0.5, 4, x, 2, z, 0x1a2a4a, 0x44aaff, { ei: 0.35 });
    });
    // Center raised platform
    this._box(5, 0.5, 5, 0, 1.5, 0, 0x2a1a4a, 0xaa44ff, { ei: 0.4 });
    // Lights
    [[-8, 5, -8],[-8, 5, 8],[8, 5, -8],[8, 5, 8],[0, 5, 0]].forEach(([x, y, z], i) =>
      this._light(x, y, z, [0x4466ff, 0x00aaff, 0x44aaff, 0x4466ff, 0xaa44ff][i], 3, 18));
    this._addShop(0, 1.5, 0xaa44ff);
    this.spawnPoints.a = [
      new THREE.Vector3(-10, 0.5, -10), new THREE.Vector3(-8, 0.5, -10),
      new THREE.Vector3(-10, 0.5, -8), new THREE.Vector3(-12, 0.5, -12)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3(10, 0.5, 10), new THREE.Vector3(8, 0.5, 10),
      new THREE.Vector3(10, 0.5, 8), new THREE.Vector3(12, 0.5, 12)
    ];
  }

  // ── CORRIDOR — long narrow kill corridor ────────────────────────────────
  _corridor() {
    this._amb(0x100510, 0x1a0a1a, 55, 90, 0.75);
    this.colliders.push({ isGround: true, y: -1 });
    // Main floor — long hallway
    this._box(60, 1, 12, 0, -1.5, 0, 0x1a0a1a, 0xff00aa, { ei: 0.2 });
    // Ceiling
    this._box(60, 1, 12, 0, 7.5, 0, 0x150815, 0xff00aa, { ei: 0.1 });
    // Side walls
    this._box(60, 9, 1, 0, 3, -6, 0x180a18, 0xff00aa, { ei: 0.15 });
    this._box(60, 9, 1, 0, 3, 6, 0x180a18, 0xff00aa, { ei: 0.15 });
    // Cover pillars (alternating sides)
    for (let i = -20; i <= 20; i += 8) {
      const side = Math.abs(i) % 16 === 0 ? -4 : 4;
      this._box(1.5, 3.5, 2, i, 0.75, side, 0x220a22, 0xff44cc, { ei: 0.3 });
      this._light(i, 5, 0, 0xff00aa, 1.5, 10);
    }
    // Elevated catwalks
    this._box(50, 0.5, 3, 0, 4.5, -3, 0x1a001a, 0xff44cc, { ei: 0.25 });
    this._box(50, 0.5, 3, 0, 4.5, 3, 0x1a001a, 0xff44cc, { ei: 0.25 });
    // Ramps to catwalks
    [[-20, -10], [20, 10], [-5, 5]].forEach(([x, z]) => {
      this._box(3, 0.4, 5, x, 2.3, z > 0 ? 4 : -4, 0x1a001a, 0xff44cc, { ei: 0.2 });
    });
    this._addShop(0, 0.5, 0xff00aa);
    this.spawnPoints.a = [
      new THREE.Vector3(-25, 0.5, -2), new THREE.Vector3(-25, 0.5, 2),
      new THREE.Vector3(-22, 0.5, 0), new THREE.Vector3(-24, 0.5, -4)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3(25, 0.5, -2), new THREE.Vector3(25, 0.5, 2),
      new THREE.Vector3(22, 0.5, 0), new THREE.Vector3(24, 0.5, 4)
    ];
  }

  // ── ARENA — circular medium arena with rings ─────────────────────────────
  _arena() {
    this._amb(0x080810, 0x101420, 65, 140, 0.9);
    this.colliders.push({ isGround: true, y: -1 });
    // Main arena floor
    const floorGeo = new THREE.CylinderGeometry(20, 20, 1, 32);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(0x2244aa), emissiveIntensity: 0.15 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1.5, 0); this.scene.add(floor);
    this.colliders.push({ box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(40, 1, 40)) });
    // Outer ring wall
    const wallGeo = new THREE.CylinderGeometry(20, 20, 6, 32, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, side: THREE.BackSide, emissive: new THREE.Color(0x2244ff), emissiveIntensity: 0.2 });
    this.scene.add(new THREE.Mesh(wallGeo, wallMat));
    // Cover — 8 pillars around outer ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 15;
      this._box(1.8, 3.5, 1.8, Math.cos(a)*r, 0.25, Math.sin(a)*r, 0x222244, 0x4466ff, { ei: 0.4 });
    }
    // Inner cover — 4 L-shaped bunkers
    [0, Math.PI/2, Math.PI, 3*Math.PI/2].forEach((a, i) => {
      const x = Math.cos(a) * 8, z = Math.sin(a) * 8;
      this._box(3, 1.8, 0.8, x, 0.4, z, 0x1a2a3a, 0x00aaff, { ei: 0.3 });
      this._box(0.8, 1.8, 3, x + Math.cos(a+Math.PI/2)*1.5, 0.4, z + Math.sin(a+Math.PI/2)*1.5, 0x1a2a3a, 0x00aaff, { ei: 0.3 });
    });
    // Center raised platform
    this._box(6, 0.6, 6, 0, 1.3, 0, 0x2a2a4a, 0xaa44ff, { ei: 0.5 });
    // Ring lights
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._light(Math.cos(a)*16, 4, Math.sin(a)*16, [0x4466ff, 0x00aaff][i%2], 2, 14);
    }
    this._light(0, 5, 0, 0xaa44ff, 3, 12);
    this._addShop(0, 1.5, 0xaa44ff);
    this.spawnPoints.a = [
      new THREE.Vector3(-14, 0.5, 0), new THREE.Vector3(-12, 0.5, -4),
      new THREE.Vector3(-12, 0.5, 4), new THREE.Vector3(-15, 0.5, 0)
    ];
    this.spawnPoints.b = [
      new THREE.Vector3(14, 0.5, 0), new THREE.Vector3(12, 0.5, -4),
      new THREE.Vector3(12, 0.5, 4), new THREE.Vector3(15, 0.5, 0)
    ];
  }

  _sky() {
    this._amb(0x030510, 0x050818, 90, 400, 0.32);
    this.colliders.push({isGround:true,y:-500,isSkyKill:true});

    // Stars
    const sv=[];
    for(let i=0;i<5000;i++) sv.push((Math.random()-0.5)*700,20+Math.random()*320,(Math.random()-0.5)*700);
    const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));
    this.scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:0.3})));

    // Nebulae backdrop
    [0x0022aa,0x220044,0x004422,0x440022,0x002244].forEach((col,i)=>{
      const nm=new THREE.Mesh(new THREE.SphereGeometry(240,8,6),new THREE.MeshBasicMaterial({color:col,side:THREE.BackSide,transparent:true,opacity:0.2}));
      nm.position.set(i*90-180,50,0); this.scene.add(nm);
    });

    const pc=[0x00aaff,0x4466ff,0xff4444,0x00ff88,0xaa44ff,0xffaa00,0xff00aa,0x00ffcc];

    // ── HELPER: wide walkable bridge with handrails ──────────────────────────
    const mkBridge=(x1,y1,z1,x2,y2,z2,col,w=3.5)=>{
      const mx=(x1+x2)/2, my=(y1+y2)/2, mz=(z1+z2)/2;
      const dx=x2-x1, dz=z2-z1, len=Math.sqrt(dx*dx+dz*dz);
      const ang=Math.atan2(dz,dx);
      const m=new THREE.Mesh(new THREE.BoxGeometry(len,0.4,w),
        new THREE.MeshStandardMaterial({color:col,emissive:new THREE.Color(col),emissiveIntensity:0.45,metalness:0.8,roughness:0.2}));
      m.position.set(mx,my,mz); m.rotation.y=ang; this.scene.add(m);
      this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(mx,my,mz),new THREE.Vector3(len+0.4,0.7,w+0.3))});
      // Glow rails
      [-w/2+0.15,w/2-0.15].forEach(rz=>{
        const rail=new THREE.Mesh(new THREE.BoxGeometry(len+0.3,0.18,0.18),
          new THREE.MeshStandardMaterial({color:col,emissive:new THREE.Color(col),emissiveIntensity:0.9,metalness:1}));
        rail.position.set(0,0.28,rz); m.add(rail);
      });
    };

    // ── HELPER: ramp between two heights ─────────────────────────────────────
    const mkRamp=(x,yLow,z,dy,l,colR,rotY=0)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(l,0.4,3.5),
        new THREE.MeshStandardMaterial({color:colR,emissive:new THREE.Color(colR),emissiveIntensity:0.3,metalness:0.5,roughness:0.4}));
      mesh.position.set(x,yLow+dy/2,z);
      mesh.rotation.y=rotY;
      mesh.rotation.x=-Math.atan2(dy,l);
      this.scene.add(mesh);
      // Simple flat collider for ramp surface
      this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,yLow+dy/2,z),new THREE.Vector3(l+0.3,dy+0.5,3.8))});
    };

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 0 — GROUND RING (large, 38×38, can't fall off from center)
    // ─────────────────────────────────────────────────────────────────────────
    this._box(38,1.4,38,0,0,0,0x1a2a3a,0x4466ff,{ei:0.38});
    // Trim glow strip
    const trim0=new THREE.Mesh(new THREE.BoxGeometry(38.3,0.15,38.3),new THREE.MeshBasicMaterial({color:0x4466ff}));
    trim0.position.set(0,1.1,0); this.scene.add(trim0);
    // Waist-high cover in center
    [[-8,0,8],[8,0,8],[-8,0,-8],[8,0,-8],[0,0,12],[0,0,-12],[-12,0,0],[12,0,0]].forEach(([x,y,z])=>
      this._box(2.5,1.5,2.5,x,y+1,z,0x223344,0x00aaff,{ei:0.3}));
    this._light(0,6,0,0xaa44ff,3,28);

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 0 SIDE PLATFORMS — close to center, easy first jumps
    // ─────────────────────────────────────────────────────────────────────────
    const tier0sides=[[-28,0,0],[28,0,0],[0,0,-28],[0,0,28],[-20,0,-20],[20,0,20],[-20,0,20],[20,0,-20]];
    tier0sides.forEach(([x,y,z],i)=>{
      const col=pc[i%pc.length], s=14;
      this._box(s,1.2,s,x,y,z,0x1a2a3a,col,{ei:0.36});
      this._light(x,y+4,z,col,2.5,20);
      const tr=new THREE.Mesh(new THREE.BoxGeometry(s+0.1,0.14,s+0.1),new THREE.MeshBasicMaterial({color:col}));
      tr.position.set(x,y+1.05,z); this.scene.add(tr);
      // Ground-level bridges to center (wide 3.5u)
      mkBridge(x>0?x-7:x<0?x+7:x, 1, z>0?z-7:z<0?z+7:z,
               x>0?14:x<0?-14:0, 1, z>0?14:z<0?-14:0, col, 3.5);
    });

    // Diagonal cross-bridges between adjacent side platforms
    mkBridge(-28,1,0,-20,1,-20, 0x4466ff, 3);
    mkBridge(28,1,0,20,1,20, 0xff4444, 3);
    mkBridge(-20,1,20,0,1,28, 0x00ff88, 3);
    mkBridge(20,1,-20,0,1,-28, 0xaa44ff, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 1 — MID HEIGHT (y=7) — bigger platforms, easy ramps up
    // ─────────────────────────────────────────────────────────────────────────
    const tier1=[[-26,7,-26],[26,7,26],[-26,7,26],[26,7,-26],[0,7,-38],[0,7,38],[-38,7,0],[38,7,0]];
    tier1.forEach(([x,y,z],i)=>{
      const col=pc[i%pc.length];
      this._box(13,0.9,13,x,y,z,0x1a2a4a,col,{ei:0.4});
      this._light(x,y+4,z,col,2.5,18);
      const tr=new THREE.Mesh(new THREE.BoxGeometry(13.1,0.14,13.1),new THREE.MeshBasicMaterial({color:col}));
      tr.position.set(x,y+0.85,z); this.scene.add(tr);
    });

    // Wide bridges between tier0 sides and tier1 platforms + ramps
    // N/S/E/W axis ramps from ground platforms up to tier1
    mkRamp(-28,1,0, 6,10, 0x00aaff, 0);   // W side → tier1 W
    mkRamp(28,1,0,  6,10, 0xff4444, 0);    // E side → tier1 E
    mkRamp(0,1,-28, 6,10, 0xaa44ff, Math.PI/2); // N → tier1 N
    mkRamp(0,1,28,  6,10, 0xffaa00, Math.PI/2); // S → tier1 S
    // Diagonal ramps to corner tier1 platforms
    mkRamp(-20,1,-20, 6,10, 0x4466ff, -Math.PI/4);
    mkRamp(20,1,20,   6,10, 0xff4444,  Math.PI*3/4);
    mkRamp(-20,1,20,  6,10, 0x00ff88,  Math.PI/4);
    mkRamp(20,1,-20,  6,10, 0x00aaff, -Math.PI*3/4);

    // Tier1 bridges
    mkBridge(-26,7,-26,0,7,-38, 0xaa44ff, 3.5);
    mkBridge(26,7,26,0,7,38, 0xff4444, 3.5);
    mkBridge(-26,7,26,-38,7,0, 0x00ff88, 3);
    mkBridge(26,7,-26,38,7,0, 0xffaa00, 3);
    mkBridge(-38,7,0,-26,7,-26, 0x4466ff, 3);
    mkBridge(38,7,0,26,7,26, 0x00aaff, 3);
    mkBridge(0,7,-38,26,7,-26, 0xff00aa, 3);
    mkBridge(0,7,38,-26,7,26, 0xffaa00, 3);

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 2 — HIGH (y=15) — medium platforms, ramps from tier1
    // ─────────────────────────────────────────────────────────────────────────
    const tier2=[[-18,15,0],[18,15,0],[0,15,-18],[0,15,18],[-24,15,-24],[24,15,24],[-24,15,24],[24,15,-24]];
    tier2.forEach(([x,y,z],i)=>{
      const col=pc[i%pc.length];
      this._box(11,0.9,11,x,y,z,0x2a1a4a,col,{ei:0.42});
      this._light(x,y+4,z,col,2,16);
    });

    // Ramps tier1 → tier2
    mkRamp(-26,7,-26, 8,10, 0xaa44ff, -Math.PI/4);
    mkRamp(26,7,26,   8,10, 0xff4444,  Math.PI*3/4);
    mkRamp(0,7,-38,   8,10, 0x4466ff, Math.PI/2);
    mkRamp(0,7,38,    8,10, 0x00ff88, -Math.PI/2);

    // Tier2 bridges
    mkBridge(-18,15,0,0,15,-18, 0x4466ff, 3);
    mkBridge(18,15,0,0,15,18, 0xff4444, 3);
    mkBridge(-24,15,-24,-18,15,0, 0xaa44ff, 2.8);
    mkBridge(24,15,24,18,15,0, 0xffaa00, 2.8);
    mkBridge(-24,15,24,-18,15,0, 0x00ff88, 2.8);
    mkBridge(24,15,-24,18,15,0, 0xff00aa, 2.8);

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 3 — APEX (y=24) — sniper nests
    // ─────────────────────────────────────────────────────────────────────────
    [[0,24,0],[-20,21,20],[20,21,-20],[-20,21,-20],[20,21,20]].forEach(([x,y,z],i)=>{
      const col=pc[i%pc.length];
      this._box(8,0.9,8,x,y,z,0x1a1a4a,col,{ei:0.55});
      this._light(x,y+3,z,col,3,12);
    });

    // Ramps to apex
    mkRamp(-18,15,0, 6,9, 0xaa44ff, 0);
    mkRamp(18,15,0,  6,9, 0xff4444, Math.PI);

    // Bridges at apex
    mkBridge(-20,21,20,0,24,0, 0x00ff88, 2.5);
    mkBridge(20,21,-20,0,24,0, 0xff4444, 2.5);

    // ─────────────────────────────────────────────────────────────────────────
    // VERTICAL COLUMNS — with traversal rings every 4 units
    // ─────────────────────────────────────────────────────────────────────────
    [[-22,0,-22],[22,0,22],[-22,0,22],[22,0,-22]].forEach(([x,y,z],i)=>{
      const col=pc[i%pc.length];
      const colMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,28,10),
        new THREE.MeshStandardMaterial({color:0x1a2a4a,emissive:new THREE.Color(col),emissiveIntensity:0.35,metalness:0.8}));
      colMesh.position.set(x,14,z); this.scene.add(colMesh);
      this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,14,z),new THREE.Vector3(1.6,28,1.6))});
      // Step rings — landing platforms on column
      [3,8,14,20].forEach(ly=>{
        const ring=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,0.3,12),
          new THREE.MeshStandardMaterial({color:col,emissive:new THREE.Color(col),emissiveIntensity:0.7,metalness:0.9}));
        ring.position.set(x,ly,z); this.scene.add(ring);
        this.colliders.push({box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,ly,z),new THREE.Vector3(4.5,0.5,4.5))});
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SPAWN PLATFORMS — large, walled, protected
    // ─────────────────────────────────────────────────────────────────────────
    [[-42,1.2,0],[42,1.2,0]].forEach(([x,y,z],i)=>{
      const col=i===0?0x0044ff:0xff4400;
      this._box(18,1.2,18,x,y,z,0x1a2a4a,col,{ei:0.5});
      this._light(x,y+5,z,col,4,22);
      // Protective back wall
      this._box(18,5,1.5,x,y+0.5,z+(i===0?-10:10),0x1a1a4a,col,{ei:0.3});
      // Side walls partial
      this._box(1.5,3,14,x+(i===0?-10:10),y+0.5,z,0x1a1a4a,col,{ei:0.2});
      // Wide bridge from spawn to main central platform
      mkBridge(x,y+1,z, i===0?-19:19, y+1, 0, col, 5);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SHOPS
    // ─────────────────────────────────────────────────────────────────────────
    this._addShop(0,1,0xaa44ff);
    this._addShop(-26,8,0x00aaff);
    this._addShop(26,8,0xff4444);

    // ─────────────────────────────────────────────────────────────────────────
    // INVISIBLE SAFETY RAILS on key platforms
    // ─────────────────────────────────────────────────────────────────────────
    const addRail=(px,py,pz,sz)=>{
      const t=0.35,rh=1.5;
      this._box(sz+t*2,rh,t,px,py+0.5,pz-sz/2-t/2,0x000000,0,{ei:0});
      this._box(sz+t*2,rh,t,px,py+0.5,pz+sz/2+t/2,0x000000,0,{ei:0});
      this._box(t,rh,sz,px-sz/2-t/2,py+0.5,pz,0x000000,0,{ei:0});
      this._box(t,rh,sz,px+sz/2+t/2,py+0.5,pz,0x000000,0,{ei:0});
    };
    addRail(0,0,0,38);        // central platform
    addRail(-42,1.2,0,18);    // spawn A
    addRail(42,1.2,0,18);     // spawn B
    // Mid tier partial rails on corner platforms
    [[-26,7,-26],[26,7,26],[-26,7,26],[26,7,-26]].forEach(([x,y,z])=>addRail(x,y,z,13));

    this.spawnPoints.a=[
      new THREE.Vector3(-42,2.2,0),new THREE.Vector3(-44,2.2,4),new THREE.Vector3(-40,2.2,-4),
      new THREE.Vector3(-46,2.2,0),new THREE.Vector3(-42,2.2,6),new THREE.Vector3(-42,2.2,-6),
      new THREE.Vector3(-38,2.2,3),new THREE.Vector3(-38,2.2,-3)
    ];
    this.spawnPoints.b=[
      new THREE.Vector3(42,2.2,0),new THREE.Vector3(44,2.2,4),new THREE.Vector3(40,2.2,-4),
      new THREE.Vector3(46,2.2,0),new THREE.Vector3(42,2.2,6),new THREE.Vector3(42,2.2,-6),
      new THREE.Vector3(38,2.2,3),new THREE.Vector3(38,2.2,-3)
    ];
  }
}
