// ============================================================
// characters.js — 40 Hero Definitions + Massive Weapon Arsenal
// ============================================================

const CHARACTERS = [
  // ─────────────────────────────────────────────────────────
  //  ORIGINAL HEROES
  // ─────────────────────────────────────────────────────────
  {
    id: 'vex', name: 'VEX', role: 'DUELIST',
    lore: 'Cybernetic assassin. Precision-engineered for elimination.',
    color: '#00f5ff', speed: 1.1, maxHealth: 100, maxShield: 25,
    weapon: 'smg',
    abilities: {
      e: { name: 'Phase Dash',   desc: 'Dash forward through obstacles.',          cooldown: 8,  icon: '⚡', type: 'dash'      },
      q: { name: 'Reflex Smoke', desc: 'Deploy a smoke cloud blocking vision 4s.', cooldown: 14, icon: '💨', type: 'smoke'     },
      f: { name: 'Overclock',    desc: '+40% fire rate & speed for 6s.',           cooldown: 45, icon: '🔥', type: 'boost', isUlt: true }
    },
    bodyColor: 0x0088cc, accentColor: 0x00ffff
  },
  {
    id: 'solaris', name: 'SOLARIS', role: 'SENTINEL',
    lore: 'Solar-powered guardian. A wall of light between allies and harm.',
    color: '#ffaa00', speed: 0.9, maxHealth: 150, maxShield: 75,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Solar Wall',    desc: 'Erect a barrier absorbing 300 damage 5s.',  cooldown: 16, icon: '🛡', type: 'shield'   },
      q: { name: 'Healing Pulse', desc: 'Heal nearby allies for 40 HP.',             cooldown: 20, icon: '✚', type: 'heal'     },
      f: { name: 'Nova Burst',    desc: '180 damage explosion in 8m radius.',         cooldown: 50, icon: '☀', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xcc7700, accentColor: 0xffee00
  },
  {
    id: 'wraith', name: 'WRAITH', role: 'INFILTRATOR',
    lore: 'Ghost operative. Disappears before you even see her coming.',
    color: '#9900ff', speed: 1.2, maxHealth: 80, maxShield: 20,
    weapon: 'smg',
    abilities: {
      e: { name: 'Ghost Step',    desc: 'Invisible for 3s. Breaking gives +20% speed.', cooldown: 15, icon: '👻', type: 'invis'   },
      q: { name: 'Veil Shift',    desc: 'Teleport up to 12m in any direction.',         cooldown: 18, icon: '🌀', type: 'teleport'},
      f: { name: 'Phantom Realm', desc: 'Immune + invisible + fast for 5s.',            cooldown: 60, icon: '◈',  type: 'phantom', isUlt: true }
    },
    bodyColor: 0x6600cc, accentColor: 0xaa44ff
  },
  {
    id: 'ironclad', name: 'IRONCLAD', role: 'TANK',
    lore: 'Walking fortress. Where he stands, the line does not break.',
    color: '#888888', speed: 0.75, maxHealth: 225, maxShield: 100,
    weapon: 'shotgun',
    abilities: {
      e: { name: 'Bulwark',    desc: 'Personal shield absorbing 500 damage for 3s.', cooldown: 12, icon: '🛡', type: 'shield'   },
      q: { name: 'Shockwave',  desc: 'Stomp launches nearby enemies into the air.',  cooldown: 14, icon: '💥', type: 'aoe'      },
      f: { name: 'Siege Mode', desc: 'Stationary turret with extreme armor 8s.',     cooldown: 55, icon: '🏰', type: 'siege', isUlt: true }
    },
    bodyColor: 0x555555, accentColor: 0x888888
  },
  {
    id: 'cinder', name: 'CINDER', role: 'PYRO',
    lore: 'Fire manipulator. Everything she touches burns.',
    color: '#ff4400', speed: 1.0, maxHealth: 110, maxShield: 30,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Flame Dash',     desc: 'Dash leaving a fire trail for 2s.',    cooldown: 9,  icon: '🔥', type: 'dash'    },
      q: { name: 'Napalm Grenade', desc: 'Creates a fire zone for 5s.',          cooldown: 13, icon: '💣', type: 'grenade' },
      f: { name: 'Inferno',        desc: '12m cone firestorm for 4s.',           cooldown: 48, icon: '🌋', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xcc2200, accentColor: 0xff6600
  },
  {
    id: 'rift', name: 'RIFT', role: 'CONTROLLER',
    lore: 'Dimensional hacker. Reality bends to his calculations.',
    color: '#00ffaa', speed: 1.0, maxHealth: 100, maxShield: 40,
    weapon: 'burstRifle',
    abilities: {
      e: { name: 'Grav Trap',     desc: 'Gravity trap pulls & slows enemies.',    cooldown: 14, icon: '⊕', type: 'trap'    },
      q: { name: 'Dimension Rift',desc: 'Portal pair — enter one, exit other.',  cooldown: 22, icon: '🔵', type: 'teleport'},
      f: { name: 'Singularity',   desc: 'Black hole pulls all nearby enemies.',   cooldown: 60, icon: '⚫', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x008855, accentColor: 0x00ffaa
  },
  {
    id: 'strix', name: 'STRIX', role: 'SNIPER',
    lore: 'Precision hunter. One shot. One thought. One kill.',
    color: '#4488ff', speed: 0.85, maxHealth: 90, maxShield: 20,
    weapon: 'sniperRifle',
    abilities: {
      e: { name: 'Radar Scan',         desc: 'Reveal enemies within 30m for 5s.',    cooldown: 18, icon: '📡', type: 'scan'   },
      q: { name: 'Grapple Hook',       desc: 'Zip to target location.',              cooldown: 12, icon: '🪝', type: 'grapple'},
      f: { name: 'Precision Protocol', desc: 'Slow-time + perfect accuracy for 6s.', cooldown: 55, icon: '🎯', type: 'boost', isUlt: true }
    },
    bodyColor: 0x2244aa, accentColor: 0x4488ff
  },
  {
    id: 'nyx', name: 'NYX', role: 'SUPPORT',
    lore: 'Nano-medic. She keeps her team breathing.',
    color: '#ff44aa', speed: 1.05, maxHealth: 100, maxShield: 35,
    weapon: 'smg',
    abilities: {
      e: { name: 'Nano Swarm',       desc: 'Heal nearby allies 80 HP over 4s.',    cooldown: 16, icon: '✚', type: 'heal'    },
      q: { name: 'Disruption Field', desc: 'Disrupt enemy HUDs and slow them.',    cooldown: 14, icon: '📡', type: 'utility' },
      f: { name: 'Revival Beacon',   desc: 'Beacon auto-revives fallen allies.',   cooldown: 70, icon: '💠', type: 'revive', isUlt: true }
    },
    bodyColor: 0xcc2288, accentColor: 0xff44aa
  },
  {
    id: 'apex', name: 'APEX', role: 'ASSAULT',
    lore: 'Peak-performance warrior. Pure combat instinct amplified.',
    color: '#ffdd00', speed: 1.1, maxHealth: 120, maxShield: 45,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Damage Boost',  desc: 'Next 5 shots deal +60% damage.',       cooldown: 12, icon: '💪', type: 'boost'   },
      q: { name: 'Flash Grenade', desc: 'Blinds enemies for 2.5s.',             cooldown: 13, icon: '💡', type: 'flash'   },
      f: { name: 'Apex Predator', desc: 'Infinite ammo + no recoil + speed 8s.',cooldown: 50, icon: '👑', type: 'boost', isUlt: true }
    },
    bodyColor: 0xaaaa00, accentColor: 0xffdd00
  },
  {
    id: 'bolt', name: 'BOLT', role: 'RUNNER',
    lore: 'Hyperkinetic speedster. Gone before you pull the trigger.',
    color: '#00eeff', speed: 1.4, maxHealth: 85, maxShield: 15,
    weapon: 'pistol',
    abilities: {
      e: { name: 'Wall Run',    desc: 'Sprint along walls for up to 4s.',              cooldown: 8,  icon: '🏃', type: 'movement'},
      q: { name: 'Speed Surge', desc: 'Triple movement speed for 3s.',                cooldown: 12, icon: '💨', type: 'boost'   },
      f: { name: 'Hyperdash',   desc: 'Pass through enemies dealing 60 dmg each.',    cooldown: 40, icon: '⚡', type: 'dash', isUlt: true }
    },
    bodyColor: 0x0099aa, accentColor: 0x00eeff
  },
  {
    id: 'hex', name: 'HEX', role: 'HACKER',
    lore: 'Data-breach specialist. Turns your own tech against you.',
    color: '#aaff00', speed: 0.95, maxHealth: 100, maxShield: 50,
    weapon: 'pistol',
    abilities: {
      e: { name: 'Turret Deploy',    desc: 'Smart turret auto-fires enemies 15s.',     cooldown: 25, icon: '🤖', type: 'turret' },
      q: { name: 'System Hack',      desc: 'Disable enemy abilities for 4s.',          cooldown: 18, icon: '💻', type: 'hack'   },
      f: { name: 'Network Takeover', desc: 'Reveal all enemies + disable all for 8s.', cooldown: 65, icon: '🌐', type: 'scan', isUlt: true }
    },
    bodyColor: 0x448800, accentColor: 0xaaff00
  },
  {
    id: 'titan', name: 'TITAN', role: 'BERSERKER',
    lore: 'Rage embodied. Closer to death, more dangerous he becomes.',
    color: '#ff0022', speed: 0.95, maxHealth: 175, maxShield: 25,
    weapon: 'shotgun',
    abilities: {
      e: { name: 'Berserker Charge', desc: 'Charge dealing damage & knockback.',  cooldown: 11, icon: '🐂', type: 'dash'  },
      q: { name: 'Blood Frenzy',     desc: 'Gain 1 HP per hit dealt for 8s.',     cooldown: 20, icon: '🩸', type: 'boost' },
      f: { name: 'Ragnarok',         desc: 'Invincible + 2x damage for 6s.',       cooldown: 55, icon: '☠',  type: 'boost', isUlt: true }
    },
    bodyColor: 0x880011, accentColor: 0xff0022
  },
  {
    id: 'kira', name: 'KIRA', role: 'BLADE MASTER',
    lore: 'Nano-blade specialist. She closes the gap before you can blink.',
    color: '#ff2288', speed: 1.25, maxHealth: 95, maxShield: 30,
    weapon: 'katana',
    abilities: {
      e: { name: 'Blade Rush',  desc: 'Leap to target dealing 80 melee damage.',   cooldown: 9,  icon: '⚔', type: 'dash'    },
      q: { name: 'Reflect',     desc: 'Deflect bullets back for 1.5s.',            cooldown: 15, icon: '🔄', type: 'shield'  },
      f: { name: 'Death Lotus', desc: 'Spin dealing 50dmg per hit to all nearby.', cooldown: 45, icon: '🌸', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xaa0055, accentColor: 0xff2288
  },
  {
    id: 'forge', name: 'FORGE', role: 'HEAVY GUNNER',
    lore: 'Walking arsenal. His minigun spins up for a reason.',
    color: '#ff6600', speed: 0.7, maxHealth: 200, maxShield: 80,
    weapon: 'minigun',
    abilities: {
      e: { name: 'Spin Up',       desc: 'Minigun spins up: +200% fire rate 4s.',  cooldown: 14, icon: '🔄', type: 'boost'   },
      q: { name: 'Suppression',   desc: 'Fire zone that slows all enemies 5s.',   cooldown: 18, icon: '🔥', type: 'grenade' },
      f: { name: 'Death Machine', desc: 'Infinite spin + armor for 8s.',          cooldown: 60, icon: '💀', type: 'boost', isUlt: true }
    },
    bodyColor: 0xaa4400, accentColor: 0xff6600
  },
  {
    id: 'phantom', name: 'PHANTOM', role: 'SPECTER',
    lore: 'Spectral assassin. Neither fully alive nor dead.',
    color: '#8844ff', speed: 1.0, maxHealth: 90, maxShield: 60,
    weapon: 'revolver',
    abilities: {
      e: { name: 'Soul Step',   desc: 'Phase through walls for 2s.',              cooldown: 10, icon: '👻', type: 'invis'   },
      q: { name: 'Haunt',       desc: 'Attach ghost to enemy — see their view.',  cooldown: 20, icon: '🔮', type: 'scan'   },
      f: { name: 'Wraith Form', desc: 'Full intangibility + 2x dmg for 6s.',      cooldown: 55, icon: '☁',  type: 'phantom', isUlt: true }
    },
    bodyColor: 0x441188, accentColor: 0x8844ff
  },
  {
    id: 'zeus', name: 'ZEUS', role: 'STORMCALLER',
    lore: 'Lightning incarnate. The battlefield is his circuit board.',
    color: '#44aaff', speed: 1.0, maxHealth: 105, maxShield: 35,
    weapon: 'burstRifle',
    abilities: {
      e: { name: 'Static Dash',  desc: 'Dash leaving electric trail for 3s.',     cooldown: 8,  icon: '⚡', type: 'dash'    },
      q: { name: 'Storm Bolt',   desc: 'Lightning bolt chains to 3 enemies.',     cooldown: 16, icon: '🌩', type: 'aoe'     },
      f: { name: 'Thunderstorm', desc: 'Storm aura shocks all nearby 6s.',        cooldown: 55, icon: '🌪', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x2266aa, accentColor: 0x44aaff
  },
  {
    id: 'viper', name: 'VIPER', role: 'TOXIC',
    lore: 'Biochemical warfare specialist. Her poison seeps into everything.',
    color: '#88ff00', speed: 1.05, maxHealth: 95, maxShield: 25,
    weapon: 'smg',
    abilities: {
      e: { name: 'Acid Spray',   desc: 'Spray acid pool dealing 8 DPS for 6s.',  cooldown: 12, icon: '🧪', type: 'grenade' },
      q: { name: 'Toxic Screen', desc: 'Smoke wall of poison — slows+damages.',   cooldown: 18, icon: '☠', type: 'smoke'   },
      f: { name: 'Biohazard',    desc: 'Massive gas cloud: 15 DPS 10s range.',    cooldown: 60, icon: '🦠', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x446600, accentColor: 0x88ff00
  },
  {
    id: 'oracle', name: 'ORACLE', role: 'TACTICIAN',
    lore: 'Information broker. She knows your move before you make it.',
    color: '#ffbb00', speed: 0.95, maxHealth: 100, maxShield: 45,
    weapon: 'burstRifle',
    abilities: {
      e: { name: 'Recon Drone', desc: 'Drone reveals all enemies for 8s.',        cooldown: 20, icon: '📡', type: 'scan'   },
      q: { name: 'Data Spike',  desc: 'Disable one enemy for 3s.',                cooldown: 16, icon: '💉', type: 'hack'   },
      f: { name: 'Omniscience', desc: 'See through walls + mark all for 10s.',    cooldown: 65, icon: '👁', type: 'scan', isUlt: true }
    },
    bodyColor: 0xaa7700, accentColor: 0xffbb00
  },
  {
    id: 'glacier', name: 'GLACIER', role: 'CRYO',
    lore: 'Absolute zero made flesh. Time itself freezes in her wake.',
    color: '#88ddff', speed: 0.9, maxHealth: 115, maxShield: 55,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Ice Wall',   desc: 'Erect ice barrier blocking path 6s.',       cooldown: 14, icon: '🧊', type: 'shield'  },
      q: { name: 'Frost Nova', desc: 'Freeze all nearby enemies for 2.5s.',       cooldown: 20, icon: '❄', type: 'aoe'     },
      f: { name: 'Permafrost', desc: 'Giant freeze zone slows all for 8s.',       cooldown: 55, icon: '🌨', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x4499aa, accentColor: 0x88ddff
  },
  {
    id: 'rampage', name: 'RAMPAGE', role: 'JUGGERNAUT',
    lore: 'Unstoppable force. Walls are just suggestions.',
    color: '#ff3300', speed: 0.85, maxHealth: 190, maxShield: 70,
    weapon: 'hammerfist',
    abilities: {
      e: { name: 'Power Slam', desc: 'Smash ground — massive AoE shockwave.',     cooldown: 10, icon: '👊', type: 'aoe'     },
      q: { name: 'Iron Skin',  desc: 'Reduce all damage by 70% for 3s.',          cooldown: 16, icon: '🛡', type: 'shield'  },
      f: { name: 'RAMPAGE',    desc: 'Sprint through walls + 3x damage 6s.',      cooldown: 55, icon: '🔥', type: 'boost', isUlt: true }
    },
    bodyColor: 0x991100, accentColor: 0xff3300
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 1: FUTURISTIC / TECH
  // ─────────────────────────────────────────────────────────
  {
    id: 'nexus', name: 'NEXUS', role: 'TECH MAGE',
    lore: 'AI-human hybrid. Channels raw computation into destructive energy.',
    color: '#cc44ff', speed: 1.0, maxHealth: 105, maxShield: 60,
    weapon: 'plasmaRifle',
    abilities: {
      e: { name: 'Overclock Burst', desc: 'Fire 6 plasma bolts in rapid burst.',        cooldown: 10, icon: '💻', type: 'boost'    },
      q: { name: 'Firewall',        desc: 'Holographic wall burns enemies who cross.',   cooldown: 16, icon: '🔶', type: 'shield'   },
      f: { name: 'System Crash',    desc: 'EMP disables all enemies in 20m for 5s.',    cooldown: 60, icon: '⚡', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x7700cc, accentColor: 0xcc44ff
  },
  {
    id: 'gravex', name: 'GRAVEX', role: 'GRAVITY LORD',
    lore: 'Warps local gravity. Your bullets curve. His always hit.',
    color: '#2244cc', speed: 0.9, maxHealth: 120, maxShield: 50,
    weapon: 'railgun',
    abilities: {
      e: { name: 'Gravity Well',    desc: 'Pull target enemy 10m toward you.',           cooldown: 11, icon: '🌀', type: 'trap'     },
      q: { name: 'Zero-G Zone',     desc: 'Float all enemies 3s — no cover use.',        cooldown: 20, icon: '🪐', type: 'aoe'      },
      f: { name: 'Crushed by Void', desc: 'Compress all in 15m — massive damage.',       cooldown: 65, icon: '⚫', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x112288, accentColor: 0x2244cc
  },
  {
    id: 'sentinel9', name: 'S-9', role: 'MECH PILOT',
    lore: 'Remote mech controller. Built the machine to fight so he doesn\'t have to.',
    color: '#ffcc00', speed: 1.05, maxHealth: 110, maxShield: 45,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Mech Strike',  desc: 'Remote mech slams target area for 90 dmg.',  cooldown: 14, icon: '🤖', type: 'aoe'      },
      q: { name: 'Shield Drone', desc: 'Drone provides 100 shield to nearby ally.',   cooldown: 22, icon: '🛡', type: 'shield'   },
      f: { name: 'Deploy Titan', desc: 'Summon full combat mech for 10s.',            cooldown: 70, icon: '🦾', type: 'summon', isUlt: true }
    },
    bodyColor: 0xaa8800, accentColor: 0xffcc00
  },
  {
    id: 'axiom', name: 'AXIOM', role: 'CHRONOLOGIST',
    lore: 'Time is a tool. He slows it, rewinds it, weaponizes it.',
    color: '#00ffee', speed: 0.95, maxHealth: 100, maxShield: 40,
    weapon: 'burstRifle',
    abilities: {
      e: { name: 'Time Slow',       desc: 'Slow nearby enemies by 60% for 3s.',          cooldown: 13, icon: '⏳', type: 'utility'  },
      q: { name: 'Rewind',          desc: 'Rewind own position to 4s ago + restore HP.',  cooldown: 25, icon: '⏪', type: 'movement' },
      f: { name: 'Temporal Freeze', desc: 'Freeze all enemies in place for 5s.',          cooldown: 65, icon: '🕰', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x008877, accentColor: 0x00ffee
  },
  {
    id: 'prism', name: 'PRISM', role: 'LIGHT BENDER',
    lore: 'Bends light itself. His illusions kill as surely as bullets.',
    color: '#ffffff', speed: 1.1, maxHealth: 90, maxShield: 35,
    weapon: 'smg',
    abilities: {
      e: { name: 'Mirror Image', desc: 'Create 2 decoy clones for 6s.',               cooldown: 15, icon: '🪞', type: 'invis'    },
      q: { name: 'Blindburst',   desc: 'Flash of pure light blinds all in front.',     cooldown: 12, icon: '🌟', type: 'flash'    },
      f: { name: 'Spectrum Beam',desc: 'Continuous laser in 360° sweep for 4s.',      cooldown: 55, icon: '🌈', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xcccccc, accentColor: 0xffffff
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 2: FANTASY / MAGIC
  // ─────────────────────────────────────────────────────────
  {
    id: 'zara', name: 'ZARA', role: 'ARCHMAGE',
    lore: 'Ancient sorceress dragged into a future she refuses to lose.',
    color: '#ff88ff', speed: 0.9, maxHealth: 95, maxShield: 65,
    weapon: 'spellstaff',
    abilities: {
      e: { name: 'Arcane Bolt',   desc: 'Charged bolt pierces 3 enemies in line.',   cooldown: 8,  icon: '✨', type: 'projectile'},
      q: { name: 'Mana Shield',   desc: 'Absorb next 200 damage as mana regen.',     cooldown: 18, icon: '💜', type: 'shield'   },
      f: { name: 'Meteor Strike', desc: '5 meteors rain down over target zone.',     cooldown: 60, icon: '☄', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xaa0088, accentColor: 0xff88ff
  },
  {
    id: 'thornwood', name: 'THORNWOOD', role: 'DRUID',
    lore: 'Nature incarnate. The forest fights alongside him.',
    color: '#44bb44', speed: 0.9, maxHealth: 140, maxShield: 30,
    weapon: 'longbow',
    abilities: {
      e: { name: 'Entangle',         desc: 'Roots target in place with vines for 3s.',   cooldown: 12, icon: '🌿', type: 'trap'    },
      q: { name: 'Thorn Wall',       desc: 'Barrier of thorns damages crossing enemies.', cooldown: 18, icon: '🌱', type: 'shield'  },
      f: { name: "Ancient's Wrath",  desc: 'Massive AoE thorns erupt from the ground.',  cooldown: 55, icon: '🌳', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x226622, accentColor: 0x44bb44
  },
  {
    id: 'seraph', name: 'SERAPH', role: 'PALADIN',
    lore: 'Divine warrior. Holy light is both sword and shield.',
    color: '#ffffaa', speed: 0.9, maxHealth: 160, maxShield: 80,
    weapon: 'holyBlade',
    abilities: {
      e: { name: 'Holy Strike',   desc: 'Smite enemy for 100 dmg + heal self 30.',  cooldown: 9,  icon: '✝', type: 'melee'    },
      q: { name: 'Divine Shield', desc: 'Invulnerable bubble for 2s.',              cooldown: 20, icon: '🌟', type: 'shield'   },
      f: { name: 'Judgment',      desc: 'Holy explosion — 200 dmg all in 10m.',     cooldown: 60, icon: '👼', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xaaaa44, accentColor: 0xffffaa
  },
  {
    id: 'malvek', name: 'MALVEK', role: 'WARLOCK',
    lore: 'Cursed for eternity. He drains life to extend his own withered existence.',
    color: '#880088', speed: 0.95, maxHealth: 110, maxShield: 20,
    weapon: 'spellstaff',
    abilities: {
      e: { name: 'Life Drain', desc: 'Drain 25 HP per second from target for 3s.',  cooldown: 10, icon: '🩸', type: 'drain'    },
      q: { name: 'Hex Curse',  desc: 'Cursed enemy takes 50% more damage for 5s.',  cooldown: 16, icon: '💀', type: 'debuff'   },
      f: { name: 'Soul Rend',  desc: 'Rip souls — instant kill below 20% HP.',      cooldown: 65, icon: '☠', type: 'execute', isUlt: true }
    },
    bodyColor: 0x220033, accentColor: 0xaa00cc
  },
  {
    id: 'sylph', name: 'SYLPH', role: 'WIND DANCER',
    lore: 'Born from a storm. She moves like air and hits like a hurricane.',
    color: '#ccffff', speed: 1.35, maxHealth: 80, maxShield: 25,
    weapon: 'twinDaggers',
    abilities: {
      e: { name: 'Wind Step', desc: 'Dash twice in quick succession.',              cooldown: 8,  icon: '💨', type: 'dash'     },
      q: { name: 'Gale Force',desc: 'Knockback all nearby enemies 8m.',             cooldown: 14, icon: '🌬', type: 'aoe'      },
      f: { name: 'Cyclone',   desc: 'Spin tornado that carries enemies along.',     cooldown: 50, icon: '🌪', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x88aaaa, accentColor: 0xccffff
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 3: ANCIENT / HISTORICAL WARRIORS
  // ─────────────────────────────────────────────────────────
  {
    id: 'leonidas', name: 'LEONIDAS', role: 'SPARTAN',
    lore: 'King of Sparta, unstuck from time. 300 was just the warm-up.',
    color: '#cc8800', speed: 0.9, maxHealth: 200, maxShield: 50,
    weapon: 'spear',
    abilities: {
      e: { name: 'Shield Wall',      desc: 'Block all frontal damage for 3s.',          cooldown: 12, icon: '🛡', type: 'shield'   },
      q: { name: 'Spear Throw',      desc: 'Hurl spear — pierces all in a line.',       cooldown: 14, icon: '🎯', type: 'projectile'},
      f: { name: 'THIS IS SPARTA',   desc: 'Kick launches enemy + bonus armor 8s.',     cooldown: 50, icon: '⚔', type: 'dash', isUlt: true }
    },
    bodyColor: 0x885500, accentColor: 0xcc8800
  },
  {
    id: 'ronin', name: 'RONIN', role: 'SAMURAI',
    lore: 'Masterless samurai from feudal Japan. Honor replaced by precision.',
    color: '#ff6644', speed: 1.15, maxHealth: 100, maxShield: 20,
    weapon: 'katana',
    abilities: {
      e: { name: 'Iaido Slash',    desc: 'Instant draw — 120 dmg in a single arc.',  cooldown: 8,  icon: '⚔', type: 'melee'    },
      q: { name: 'Counter Stance', desc: 'Next melee hit countered for 200% dmg.',   cooldown: 14, icon: '🔄', type: 'shield'   },
      f: { name: 'Thousand Cuts',  desc: 'Warp to all enemies — slash each once.',   cooldown: 55, icon: '🌸', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xaa3300, accentColor: 0xff6644
  },
  {
    id: 'valkyra', name: 'VALKYRA', role: 'VALKYRIE',
    lore: 'Chooser of the slain. She decides who lives on this battlefield.',
    color: '#aaccff', speed: 1.0, maxHealth: 130, maxShield: 60,
    weapon: 'battleaxe',
    abilities: {
      e: { name: 'Winged Charge',  desc: 'Flying charge — stun on impact for 2s.',   cooldown: 10, icon: '🦅', type: 'dash'     },
      q: { name: "Valhalla's Call",desc: 'Nearby fallen ally revived with 50% HP.',  cooldown: 30, icon: '⚡', type: 'revive'   },
      f: { name: 'Storm of Blades',desc: 'Rain of spears hits all in 15m radius.',   cooldown: 60, icon: '🌩', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x6688aa, accentColor: 0xaaccff
  },
  {
    id: 'ra', name: 'RA', role: 'SUN GOD',
    lore: 'Egyptian deity of the sun. He who stares into light shall burn.',
    color: '#ffdd44', speed: 0.95, maxHealth: 125, maxShield: 55,
    weapon: 'ankh',
    abilities: {
      e: { name: 'Solar Ray',    desc: 'Focused beam of sunlight — 40 DPS.',        cooldown: 10, icon: '☀', type: 'beam'     },
      q: { name: 'Sands of Time',desc: 'Slow all enemies in 12m by 50% for 4s.',   cooldown: 18, icon: '⏳', type: 'aoe'      },
      f: { name: 'Eye of Ra',    desc: 'Scorch the entire arena — massive damage.', cooldown: 70, icon: '👁', type: 'aoe', isUlt: true }
    },
    bodyColor: 0xaa8800, accentColor: 0xffdd44
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 4: ROGUES / OUTLAWS
  // ─────────────────────────────────────────────────────────
  {
    id: 'bandit', name: 'BANDIT', role: 'OUTLAW',
    lore: 'Most wanted across 6 galaxies. Still hasn\'t been caught.',
    color: '#cc8844', speed: 1.1, maxHealth: 110, maxShield: 30,
    weapon: 'dualPistols',
    abilities: {
      e: { name: 'Quickdraw',  desc: 'Fire both pistols simultaneously — 8 shots.', cooldown: 9,  icon: '🔫', type: 'boost'    },
      q: { name: 'Smoke Bomb', desc: 'Vanish in smoke + reposition 10m.',           cooldown: 15, icon: '💣', type: 'invis'    },
      f: { name: 'High Noon',  desc: 'Auto-aim kills one enemy below 30% HP.',      cooldown: 60, icon: '🌅', type: 'execute', isUlt: true }
    },
    bodyColor: 0x885522, accentColor: 0xcc8844
  },
  {
    id: 'casino', name: 'CASINO', role: 'GAMBLER',
    lore: 'Luck is a weapon. He\'s never lost a bet — or a fight.',
    color: '#ff2255', speed: 1.0, maxHealth: 105, maxShield: 35,
    weapon: 'revolver',
    abilities: {
      e: { name: 'Lucky Shot', desc: 'Random: headshot / ricochet / explosive.',         cooldown: 8,  icon: '🎲', type: 'boost'    },
      q: { name: 'Wild Card',  desc: 'Throw explosive cards — 60 dmg each.',             cooldown: 14, icon: '🃏', type: 'grenade'  },
      f: { name: 'All In',     desc: 'Random: 500 dmg OR heal to full OR stun all 5s.', cooldown: 55, icon: '🎰', type: 'random', isUlt: true }
    },
    bodyColor: 0x880022, accentColor: 0xff2255
  },
  {
    id: 'ghost', name: 'GHOST', role: 'OPERATIVE',
    lore: 'Black-ops legend. No record exists. Neither should you.',
    color: '#558866', speed: 1.15, maxHealth: 90, maxShield: 30,
    weapon: 'sniperRifle',
    abilities: {
      e: { name: 'Cloak',            desc: 'Turn invisible while stationary for 10s.',  cooldown: 20, icon: '👤', type: 'invis'    },
      q: { name: 'EMP Dart',         desc: 'Dart disables target for 4s.',              cooldown: 16, icon: '💉', type: 'hack'     },
      f: { name: 'Shadow Protocol',  desc: 'Mark 3 enemies — headshots guaranteed 8s.', cooldown: 55, icon: '🎯', type: 'boost', isUlt: true }
    },
    bodyColor: 0x334433, accentColor: 0x558866
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 5: ELEMENTAL / NATURE
  // ─────────────────────────────────────────────────────────
  {
    id: 'terra', name: 'TERRA', role: 'EARTHSHAPER',
    lore: 'Controls stone and soil. The ground itself is her weapon.',
    color: '#aa7744', speed: 0.85, maxHealth: 165, maxShield: 40,
    weapon: 'earthGauntlets',
    abilities: {
      e: { name: 'Rock Surge',  desc: 'Spike erupts under enemy — launches up.',    cooldown: 10, icon: '🪨', type: 'aoe'      },
      q: { name: 'Stone Armor', desc: 'Coat self in rock — reduce dmg 50% for 5s.', cooldown: 18, icon: '🛡', type: 'shield'   },
      f: { name: 'Earthquake',  desc: 'Massive quake knocks down all in 20m.',      cooldown: 65, icon: '🌍', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x664422, accentColor: 0xaa7744
  },
  {
    id: 'tsunami', name: 'TSUNAMI', role: 'TIDE CALLER',
    lore: 'Child of the ocean. The sea follows him everywhere.',
    color: '#0066ff', speed: 1.0, maxHealth: 120, maxShield: 45,
    weapon: 'triton',
    abilities: {
      e: { name: 'Tidal Wave', desc: 'Wall of water pushes enemies back 12m.',      cooldown: 12, icon: '🌊', type: 'aoe'      },
      q: { name: 'Whirlpool',  desc: 'Spinning vortex traps enemy for 3s.',         cooldown: 18, icon: '🌀', type: 'trap'     },
      f: { name: 'The Flood',  desc: 'Drown zone — slows + 20 DPS for 8s.',        cooldown: 60, icon: '🌊', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x003399, accentColor: 0x0066ff
  },
  {
    id: 'emberlord', name: 'EMBERLORD', role: 'MAGMA KING',
    lore: 'Emerged from a volcano. He hasn\'t cooled down since.',
    color: '#ff5500', speed: 0.85, maxHealth: 145, maxShield: 35,
    weapon: 'lavaCannon',
    abilities: {
      e: { name: 'Magma Fist', desc: 'Punch leaves burning crater — 10 DPS.',       cooldown: 9,  icon: '🌋', type: 'melee'    },
      q: { name: 'Lava Pool',  desc: 'Pour lava zone lasting 8s.',                  cooldown: 16, icon: '🔥', type: 'grenade'  },
      f: { name: 'Eruption',   desc: 'Full body eruption — 250 dmg all in 12m.',    cooldown: 60, icon: '🌋', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x993300, accentColor: 0xff5500
  },

  // ─────────────────────────────────────────────────────────
  //  NEW HEROES — BATCH 6: EXPERIMENTAL / UNIQUE
  // ─────────────────────────────────────────────────────────
  {
    id: 'mimic', name: 'MIMIC', role: 'SHAPESHIFTER',
    lore: 'Perfect cellular reconstruction. It has no face. It wears yours.',
    color: '#aaaaaa', speed: 1.05, maxHealth: 100, maxShield: 40,
    weapon: 'assaultRifle',
    abilities: {
      e: { name: 'Copy Cat',      desc: 'Copy nearest enemy\'s last used ability.',  cooldown: 20, icon: '🪞', type: 'utility'  },
      q: { name: 'Disguise',      desc: 'Look like a random enemy for 8s.',          cooldown: 22, icon: '🎭', type: 'invis'    },
      f: { name: 'Perfect Mimic', desc: 'Become copy of strongest enemy for 10s.',  cooldown: 70, icon: '♾', type: 'transform', isUlt: true }
    },
    bodyColor: 0x666666, accentColor: 0xaaaaaa
  },
  {
    id: 'paradox', name: 'PARADOX', role: 'ANOMALY',
    lore: 'Shouldn\'t exist. The universe is trying to correct this error.',
    color: '#ff00ff', speed: 1.0, maxHealth: 100, maxShield: 100,
    weapon: 'voidCannon',
    abilities: {
      e: { name: 'Phase Flip', desc: 'Swap own position with random enemy.',        cooldown: 13, icon: '🔀', type: 'teleport' },
      q: { name: 'Invert',     desc: 'Invert enemy shields — turns to damage.',     cooldown: 18, icon: '↔', type: 'debuff'   },
      f: { name: 'Collapse',   desc: 'Fold space — teleport all enemies together.', cooldown: 65, icon: '🌌', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x880088, accentColor: 0xff00ff
  },
  {
    id: 'nanite', name: 'NANITE', role: 'SWARM MIND',
    lore: 'A billion machines moving as one. Destroy one; the swarm persists.',
    color: '#00ffcc', speed: 1.1, maxHealth: 100, maxShield: 50,
    weapon: 'smg',
    abilities: {
      e: { name: 'Swarm Cloud',  desc: 'Nanite cloud slows + deals 5 DPS for 6s.', cooldown: 12, icon: '🦟', type: 'aoe'      },
      q: { name: 'Reconstruct', desc: 'Heal 80 HP instantly.',                      cooldown: 22, icon: '🔧', type: 'heal'     },
      f: { name: 'Total Swarm', desc: 'Cover arena in nanites — 15 DPS all for 6s.',cooldown: 65, icon: '🌀', type: 'aoe', isUlt: true }
    },
    bodyColor: 0x008866, accentColor: 0x00ffcc
  }
];

// ──────────────────────────────────────────────────────────────────────────────
//  WEAPON STATS — FULL ARSENAL
//  Categories: Modern Ranged | Futuristic Ranged | Ancient Melee |
//              Modern Melee  | Futuristic Melee  | Magic         |
//              Ancient Ranged
// ──────────────────────────────────────────────────────────────────────────────
const WEAPON_STATS = {

  // ── MODERN RANGED ─────────────────────────────────────────────────────────
  assaultRifle:  { name: 'ASSAULT RIFLE',    category: 'Modern Ranged',     damage: 28,  fireRate: 600,  reloadTime: 2200, magSize: 30,  reserveAmmo: 90,  range: 60,  spread: 0.04,  auto: true,  pellets: 1, type: 'gun',   color: 0x445566, accentColor: 0x00aaff },
  smg:           { name: 'SMG',              category: 'Modern Ranged',     damage: 18,  fireRate: 900,  reloadTime: 1800, magSize: 40,  reserveAmmo: 120, range: 35,  spread: 0.06,  auto: true,  pellets: 1, type: 'gun',   color: 0x334455, accentColor: 0x00f5ff },
  sniperRifle:   { name: 'SNIPER RIFLE',     category: 'Modern Ranged',     damage: 150, fireRate: 45,   reloadTime: 3000, magSize: 5,   reserveAmmo: 20,  range: 200, spread: 0.001, auto: false, pellets: 1, type: 'gun',   color: 0x2a3a2a, accentColor: 0x00ff88 },
  shotgun:       { name: 'SHOTGUN',          category: 'Modern Ranged',     damage: 18,  fireRate: 70,   reloadTime: 500,  magSize: 6,   reserveAmmo: 36,  range: 20,  spread: 0.15,  auto: false, pellets: 8, type: 'gun',   color: 0x4a3030, accentColor: 0xff6600 },
  burstRifle:    { name: 'BURST RIFLE',      category: 'Modern Ranged',     damage: 35,  fireRate: 450,  reloadTime: 2400, magSize: 24,  reserveAmmo: 72,  range: 55,  spread: 0.025, auto: false, pellets: 1, type: 'gun',   color: 0x2a2a4a, accentColor: 0xaaff00, burst: 3 },
  pistol:        { name: 'PISTOL',           category: 'Modern Ranged',     damage: 45,  fireRate: 350,  reloadTime: 1400, magSize: 15,  reserveAmmo: 60,  range: 40,  spread: 0.03,  auto: false, pellets: 1, type: 'gun',   color: 0x333333, accentColor: 0x999999 },
  revolver:      { name: 'REVOLVER',         category: 'Modern Ranged',     damage: 90,  fireRate: 160,  reloadTime: 2800, magSize: 6,   reserveAmmo: 36,  range: 50,  spread: 0.015, auto: false, pellets: 1, type: 'gun',   color: 0x554433, accentColor: 0xddaa44 },
  minigun:       { name: 'MINIGUN',          category: 'Modern Ranged',     damage: 14,  fireRate: 1200, reloadTime: 4000, magSize: 120, reserveAmmo: 360, range: 45,  spread: 0.08,  auto: true,  pellets: 1, type: 'gun',   color: 0x332211, accentColor: 0xff8800, spinUp: 1200 },
  dualPistols:   { name: 'DUAL PISTOLS',     category: 'Modern Ranged',     damage: 30,  fireRate: 600,  reloadTime: 2000, magSize: 24,  reserveAmmo: 96,  range: 35,  spread: 0.05,  auto: false, pellets: 2, type: 'gun',   color: 0x333333, accentColor: 0xffaa00 },
  lmg:           { name: 'LMG',              category: 'Modern Ranged',     damage: 22,  fireRate: 700,  reloadTime: 4500, magSize: 100, reserveAmmo: 200, range: 50,  spread: 0.07,  auto: true,  pellets: 1, type: 'gun',   color: 0x443322, accentColor: 0xcc8844 },
  tacShotgun:    { name: 'TACTICAL SHOTGUN', category: 'Modern Ranged',     damage: 28,  fireRate: 150,  reloadTime: 2000, magSize: 8,   reserveAmmo: 48,  range: 25,  spread: 0.10,  auto: false, pellets: 6, type: 'gun',   color: 0x3a2020, accentColor: 0xff4400 },
  sniperAuto:    { name: 'AUTO SNIPER',      category: 'Modern Ranged',     damage: 80,  fireRate: 150,  reloadTime: 2500, magSize: 10,  reserveAmmo: 40,  range: 150, spread: 0.005, auto: true,  pellets: 1, type: 'gun',   color: 0x2a2a3a, accentColor: 0x88ff00 },
  crossbow:      { name: 'CROSSBOW',         category: 'Modern Ranged',     damage: 120, fireRate: 55,   reloadTime: 2200, magSize: 5,   reserveAmmo: 25,  range: 80,  spread: 0.005, auto: false, pellets: 1, type: 'gun',   color: 0x553322, accentColor: 0x44ff88, explosive: true },
  grenadeLauncher:{ name: 'GRENADE LAUNCHER',category: 'Modern Ranged',     damage: 95,  fireRate: 55,   reloadTime: 2800, magSize: 4,   reserveAmmo: 20,  range: 35,  spread: 0.04,  auto: false, pellets: 1, type: 'gun',   color: 0x443311, accentColor: 0xffaa00, aoeOnHit: true },
  rocketLauncher:{ name: 'ROCKET LAUNCHER',  category: 'Modern Ranged',     damage: 160, fireRate: 30,   reloadTime: 3500, magSize: 2,   reserveAmmo: 8,   range: 80,  spread: 0.01,  auto: false, pellets: 1, type: 'gun',   color: 0x442200, accentColor: 0xff6600, aoeOnHit: true },

  // ── FUTURISTIC RANGED ─────────────────────────────────────────────────────
  plasmaRifle:   { name: 'PLASMA RIFLE',     category: 'Futuristic Ranged', damage: 38,  fireRate: 400,  reloadTime: 2600, magSize: 20,  reserveAmmo: 60,  range: 65,  spread: 0.02,  auto: true,  pellets: 1, type: 'gun',   color: 0x220044, accentColor: 0xff00ff },
  railgun:       { name: 'RAILGUN',          category: 'Futuristic Ranged', damage: 220, fireRate: 25,   reloadTime: 4000, magSize: 3,   reserveAmmo: 12,  range: 999, spread: 0.0,   auto: false, pellets: 1, type: 'gun',   color: 0x001133, accentColor: 0x0088ff, penetrating: true },
  voidCannon:    { name: 'VOID CANNON',      category: 'Futuristic Ranged', damage: 65,  fireRate: 120,  reloadTime: 3000, magSize: 8,   reserveAmmo: 24,  range: 70,  spread: 0.01,  auto: false, pellets: 1, type: 'gun',   color: 0x110022, accentColor: 0xcc00ff, aoeOnHit: true },
  pulseCannon:   { name: 'PULSE CANNON',     category: 'Futuristic Ranged', damage: 50,  fireRate: 200,  reloadTime: 2800, magSize: 12,  reserveAmmo: 36,  range: 55,  spread: 0.03,  auto: false, pellets: 1, type: 'gun',   color: 0x002244, accentColor: 0x00ccff, knockback: true },
  ionBlaster:    { name: 'ION BLASTER',      category: 'Futuristic Ranged', damage: 25,  fireRate: 800,  reloadTime: 2000, magSize: 35,  reserveAmmo: 105, range: 45,  spread: 0.045, auto: true,  pellets: 1, type: 'gun',   color: 0x001133, accentColor: 0x44eeff },
  quantumRifle:  { name: 'QUANTUM RIFLE',    category: 'Futuristic Ranged', damage: 100, fireRate: 80,   reloadTime: 3500, magSize: 6,   reserveAmmo: 18,  range: 120, spread: 0.002, auto: false, pellets: 1, type: 'gun',   color: 0x001144, accentColor: 0xaaffff, phaseThrough: true },
  antimatterGun: { name: 'ANTIMATTER GUN',   category: 'Futuristic Ranged', damage: 180, fireRate: 35,   reloadTime: 5000, magSize: 2,   reserveAmmo: 8,   range: 60,  spread: 0.0,   auto: false, pellets: 1, type: 'gun',   color: 0x000022, accentColor: 0xff88ff, aoeOnHit: true },
  gravLauncher:  { name: 'GRAV LAUNCHER',    category: 'Futuristic Ranged', damage: 45,  fireRate: 100,  reloadTime: 3200, magSize: 6,   reserveAmmo: 18,  range: 40,  spread: 0.02,  auto: false, pellets: 1, type: 'gun',   color: 0x002211, accentColor: 0x00ff88, gravPull: true },
  lavaCannon:    { name: 'LAVA CANNON',      category: 'Futuristic Ranged', damage: 30,  fireRate: 300,  reloadTime: 3000, magSize: 20,  reserveAmmo: 60,  range: 30,  spread: 0.08,  auto: true,  pellets: 1, type: 'gun',   color: 0x330000, accentColor: 0xff4400, burn: true },
  soniCannon:    { name: 'SONIC CANNON',     category: 'Futuristic Ranged', damage: 20,  fireRate: 500,  reloadTime: 2400, magSize: 30,  reserveAmmo: 90,  range: 25,  spread: 0.12,  auto: true,  pellets: 1, type: 'gun',   color: 0x223344, accentColor: 0x88aaff, knockback: true },
  naniteRifle:   { name: 'NANITE RIFLE',     category: 'Futuristic Ranged', damage: 15,  fireRate: 650,  reloadTime: 2200, magSize: 50,  reserveAmmo: 150, range: 50,  spread: 0.035, auto: true,  pellets: 1, type: 'gun',   color: 0x003322, accentColor: 0x00ffcc, drain: true },
  disruptor:     { name: 'DISRUPTOR',        category: 'Futuristic Ranged', damage: 55,  fireRate: 180,  reloadTime: 2600, magSize: 10,  reserveAmmo: 30,  range: 40,  spread: 0.02,  auto: false, pellets: 1, type: 'gun',   color: 0x220033, accentColor: 0xff44ff, chain: true },

  // ── ANCIENT / HISTORICAL MELEE ────────────────────────────────────────────
  katana:        { name: 'KATANA',           category: 'Ancient Melee',     damage: 75,  fireRate: 180,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.2, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x888899, accentColor: 0x00ffff, meleeRadius: 2.2, meleeArc: 1.8 },
  spear:         { name: 'SPEAR',            category: 'Ancient Melee',     damage: 70,  fireRate: 140,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.5, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x886633, accentColor: 0xccaa44, meleeRadius: 3.5, meleeArc: 0.8 },
  battleaxe:     { name: 'BATTLE AXE',       category: 'Ancient Melee',     damage: 95,  fireRate: 110,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.8, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x664422, accentColor: 0xff8800, meleeRadius: 2.8, meleeArc: 2.0 },
  warHammer:     { name: 'WAR HAMMER',       category: 'Ancient Melee',     damage: 130, fireRate: 75,   reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.5, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x445544, accentColor: 0x888888, meleeRadius: 2.5, meleeArc: 2.2, knockback: true },
  scimitar:      { name: 'SCIMITAR',         category: 'Ancient Melee',     damage: 65,  fireRate: 210,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.0, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x886644, accentColor: 0xddcc44, meleeRadius: 2.0, meleeArc: 2.4 },
  twinDaggers:   { name: 'TWIN DAGGERS',     category: 'Ancient Melee',     damage: 30,  fireRate: 400,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 1.5, spread: 0.0,   auto: true,  pellets: 2, type: 'melee', color: 0x333344, accentColor: 0x00ccff, meleeRadius: 1.5, meleeArc: 1.5 },
  halberd:       { name: 'HALBERD',          category: 'Ancient Melee',     damage: 88,  fireRate: 100,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.8, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x555533, accentColor: 0xaacc00, meleeRadius: 3.8, meleeArc: 1.8 },
  triton:        { name: 'TRIDENT',          category: 'Ancient Melee',     damage: 72,  fireRate: 130,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.2, spread: 0.0,   auto: false, pellets: 3, type: 'melee', color: 0x224466, accentColor: 0x0088ff, meleeRadius: 3.2, meleeArc: 1.2 },
  gladiusSword:  { name: 'GLADIUS',          category: 'Ancient Melee',     damage: 60,  fireRate: 240,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 1.8, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x887755, accentColor: 0xddcc88, meleeRadius: 1.8, meleeArc: 1.6 },
  flail:         { name: 'FLAIL',            category: 'Ancient Melee',     damage: 85,  fireRate: 120,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.0, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x554433, accentColor: 0xff9900, meleeRadius: 3.0, meleeArc: 3.14, knockback: true },
  naginata:      { name: 'NAGINATA',         category: 'Ancient Melee',     damage: 78,  fireRate: 125,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.6, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x886633, accentColor: 0xff6644, meleeRadius: 3.6, meleeArc: 1.8 },

  // ── ANCIENT RANGED ────────────────────────────────────────────────────────
  longbow:       { name: 'LONGBOW',          category: 'Ancient Ranged',    damage: 85,  fireRate: 60,   reloadTime: 1500, magSize: 20,  reserveAmmo: 60,  range: 90,  spread: 0.008, auto: false, pellets: 1, type: 'gun',   color: 0x553311, accentColor: 0x88cc44 },
  throwingAxes:  { name: 'THROWING AXES',    category: 'Ancient Ranged',    damage: 70,  fireRate: 120,  reloadTime: 2000, magSize: 6,   reserveAmmo: 24,  range: 30,  spread: 0.03,  auto: false, pellets: 1, type: 'gun',   color: 0x664422, accentColor: 0xcc8800 },

  // ── MODERN MELEE ─────────────────────────────────────────────────────────
  hammerfist:    { name: 'HAMMER FIST',      category: 'Modern Melee',      damage: 110, fireRate: 90,   reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.5, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x444444, accentColor: 0xff4400, meleeRadius: 2.5, meleeArc: 2.2 },
  combatKnife:   { name: 'COMBAT KNIFE',     category: 'Modern Melee',      damage: 55,  fireRate: 320,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 1.6, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x333333, accentColor: 0x888888, meleeRadius: 1.6, meleeArc: 1.4 },
  tacticalBaton: { name: 'TACTICAL BATON',   category: 'Modern Melee',      damage: 45,  fireRate: 280,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.0, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x222244, accentColor: 0x6666ff, meleeRadius: 2.0, meleeArc: 1.6, stun: true },
  chainsaw:      { name: 'CHAINSAW',         category: 'Modern Melee',      damage: 20,  fireRate: 600,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 1.8, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x444422, accentColor: 0xff6600, meleeRadius: 1.8, meleeArc: 1.2, burn: true },
  earthGauntlets:{ name: 'EARTH GAUNTLETS',  category: 'Modern Melee',      damage: 85,  fireRate: 140,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.2, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x664422, accentColor: 0xaa7744, meleeRadius: 2.2, meleeArc: 2.0 },
  knuckledusters:{ name: 'KNUCKLE DUSTERS',  category: 'Modern Melee',      damage: 40,  fireRate: 450,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 1.4, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x444433, accentColor: 0xddbb00, meleeRadius: 1.4, meleeArc: 1.8, stun: true },

  // ── FUTURISTIC MELEE ─────────────────────────────────────────────────────
  energyBlade:   { name: 'ENERGY BLADE',     category: 'Futuristic Melee',  damage: 60,  fireRate: 240,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.0, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x001133, accentColor: 0x00ffff, meleeRadius: 2.0, meleeArc: 1.6 },
  plasmaSword:   { name: 'PLASMA SWORD',     category: 'Futuristic Melee',  damage: 90,  fireRate: 160,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.4, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x220033, accentColor: 0xff00ff, meleeRadius: 2.4, meleeArc: 1.8, burn: true },
  nanoWhip:      { name: 'NANO WHIP',        category: 'Futuristic Melee',  damage: 40,  fireRate: 350,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 5.0, spread: 0.0,   auto: true,  pellets: 1, type: 'melee', color: 0x003322, accentColor: 0x00ff88, meleeRadius: 5.0, meleeArc: 1.0 },
  gravFist:      { name: 'GRAV FIST',        category: 'Futuristic Melee',  damage: 100, fireRate: 120,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.8, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x111133, accentColor: 0x4444ff, meleeRadius: 2.8, meleeArc: 2.0, knockback: true },
  phaseBlade:    { name: 'PHASE BLADE',      category: 'Futuristic Melee',  damage: 70,  fireRate: 200,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.2, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x002244, accentColor: 0x00aaff, meleeRadius: 2.2, meleeArc: 2.0, phaseThrough: true },
  voltLance:     { name: 'VOLT LANCE',       category: 'Futuristic Melee',  damage: 65,  fireRate: 170,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 3.0, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x112244, accentColor: 0x44aaff, meleeRadius: 3.0, meleeArc: 1.4, chain: true },
  atomicMace:    { name: 'ATOMIC MACE',      category: 'Futuristic Melee',  damage: 140, fireRate: 65,   reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.6, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x002211, accentColor: 0x44ff88, meleeRadius: 2.6, meleeArc: 2.8, aoeOnHit: true },

  // ── MAGIC WEAPONS ─────────────────────────────────────────────────────────
  spellstaff:    { name: 'SPELL STAFF',      category: 'Magic',             damage: 55,  fireRate: 200,  reloadTime: 2000, magSize: 30,  reserveAmmo: 90,  range: 50,  spread: 0.03,  auto: false, pellets: 1, type: 'gun',   color: 0x440066, accentColor: 0xff88ff, magic: true },
  holyBlade:     { name: 'HOLY BLADE',       category: 'Magic',             damage: 85,  fireRate: 150,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.5, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0xaaaa44, accentColor: 0xffffaa, meleeRadius: 2.5, meleeArc: 2.0, magic: true, healOnHit: true },
  ankh:          { name: 'ANKH OF RA',       category: 'Magic',             damage: 45,  fireRate: 250,  reloadTime: 1800, magSize: 25,  reserveAmmo: 75,  range: 45,  spread: 0.02,  auto: false, pellets: 1, type: 'gun',   color: 0xaa8800, accentColor: 0xffdd44, magic: true, burn: true },
  voidOrb:       { name: 'VOID ORB',         category: 'Magic',             damage: 70,  fireRate: 130,  reloadTime: 2500, magSize: 12,  reserveAmmo: 36,  range: 55,  spread: 0.01,  auto: false, pellets: 1, type: 'gun',   color: 0x110022, accentColor: 0x8800ff, magic: true, aoeOnHit: true },
  runeBlades:    { name: 'RUNE BLADES',      category: 'Magic',             damage: 50,  fireRate: 300,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.0, spread: 0.0,   auto: true,  pellets: 2, type: 'melee', color: 0x220044, accentColor: 0xcc44ff, meleeRadius: 2.0, meleeArc: 2.2, magic: true },
  stormWand:     { name: 'STORM WAND',       category: 'Magic',             damage: 35,  fireRate: 450,  reloadTime: 1600, magSize: 40,  reserveAmmo: 120, range: 40,  spread: 0.04,  auto: true,  pellets: 1, type: 'gun',   color: 0x002244, accentColor: 0x44aaff, magic: true, chain: true },
  soulReaper:    { name: 'SOUL REAPER',      category: 'Magic',             damage: 110, fireRate: 90,   reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.5, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x220022, accentColor: 0xff0088, meleeRadius: 2.5, meleeArc: 2.6, magic: true, drain: true },
  frostScepter:  { name: 'FROST SCEPTER',    category: 'Magic',             damage: 42,  fireRate: 220,  reloadTime: 2200, magSize: 20,  reserveAmmo: 60,  range: 50,  spread: 0.025, auto: false, pellets: 1, type: 'gun',   color: 0x224488, accentColor: 0x88ddff, magic: true, freeze: true },
  infernoScythe: { name: 'INFERNO SCYTHE',   category: 'Magic',             damage: 80,  fireRate: 130,  reloadTime: 0,    magSize: 999, reserveAmmo: 999, range: 2.8, spread: 0.0,   auto: false, pellets: 1, type: 'melee', color: 0x441100, accentColor: 0xff4400, meleeRadius: 2.8, meleeArc: 2.4, magic: true, burn: true },
  shadowBow:     { name: 'SHADOW BOW',       category: 'Magic',             damage: 95,  fireRate: 75,   reloadTime: 2000, magSize: 15,  reserveAmmo: 45,  range: 75,  spread: 0.005, auto: false, pellets: 1, type: 'gun',   color: 0x220033, accentColor: 0x8800cc, magic: true, phaseThrough: true },
  orbOfChoas:    { name: 'ORB OF CHAOS',     category: 'Magic',             damage: 60,  fireRate: 160,  reloadTime: 2400, magSize: 15,  reserveAmmo: 45,  range: 45,  spread: 0.0,   auto: false, pellets: 1, type: 'gun',   color: 0x440044, accentColor: 0xff00ff, magic: true, random: true },

};

// ── WEAPON PICKUP LIST (available in shop + field drops) ──────────────────
const WEAPON_PICKUP_LIST = [
  // Modern Ranged
  'assaultRifle','smg','sniperRifle','shotgun','burstRifle','pistol','revolver',
  'minigun','dualPistols','lmg','tacShotgun','sniperAuto','crossbow',
  'grenadeLauncher','rocketLauncher',
  // Futuristic Ranged
  'plasmaRifle','railgun','voidCannon','pulseCannon','ionBlaster','quantumRifle',
  'antimatterGun','gravLauncher','lavaCannon','soniCannon','naniteRifle','disruptor',
  // Ancient Melee
  'katana','spear','battleaxe','warHammer','scimitar','twinDaggers',
  'halberd','triton','gladiusSword','flail','naginata',
  // Ancient Ranged
  'longbow','throwingAxes',
  // Modern Melee
  'hammerfist','combatKnife','tacticalBaton','chainsaw','earthGauntlets','knuckledusters',
  // Futuristic Melee
  'energyBlade','plasmaSword','nanoWhip','gravFist','phaseBlade','voltLance','atomicMace',
  // Magic
  'spellstaff','holyBlade','ankh','voidOrb','runeBlades','stormWand','soulReaper',
  'frostScepter','infernoScythe','shadowBow','orbOfChoas',
];

// ── WEAPON CATEGORIES (for shop/UI grouping) ───────────────────────────────
const WEAPON_CATEGORIES = {
  'Modern Ranged':    ['assaultRifle','smg','sniperRifle','shotgun','burstRifle','pistol','revolver','minigun','dualPistols','lmg','tacShotgun','sniperAuto','crossbow','grenadeLauncher','rocketLauncher'],
  'Futuristic Ranged':['plasmaRifle','railgun','voidCannon','pulseCannon','ionBlaster','quantumRifle','antimatterGun','gravLauncher','lavaCannon','soniCannon','naniteRifle','disruptor'],
  'Ancient Melee':    ['katana','spear','battleaxe','warHammer','scimitar','twinDaggers','halberd','triton','gladiusSword','flail','naginata'],
  'Ancient Ranged':   ['longbow','throwingAxes'],
  'Modern Melee':     ['hammerfist','combatKnife','tacticalBaton','chainsaw','earthGauntlets','knuckledusters'],
  'Futuristic Melee': ['energyBlade','plasmaSword','nanoWhip','gravFist','phaseBlade','voltLance','atomicMace'],
  'Magic':            ['spellstaff','holyBlade','ankh','voidOrb','runeBlades','stormWand','soulReaper','frostScepter','infernoScythe','shadowBow','orbOfChoas'],
};

const MAP_CONFIGS = [
  { id: 'neonCity',       name: 'NEON CITY',       color: '#00f5ff', size: 'large' },
  { id: 'jungle',         name: 'JUNGLE',           color: '#00ff44', size: 'large' },
  { id: 'desertRuins',    name: 'DESERT RUINS',     color: '#c8a850', size: 'large' },
  { id: 'neonJungle',     name: 'NEON JUNGLE CITY', color: '#44ff00', size: 'large' },
  { id: 'cyberDesert',    name: 'CYBER DESERT',     color: '#ff8800', size: 'large' },
  { id: 'factory',        name: 'FACTORY',          color: '#ff4400', size: 'large' },
  { id: 'skyPlatforms',   name: 'SKY PLATFORMS',    color: '#aa44ff', size: 'large' },
  // Small PvP maps
  { id: 'boxFight',       name: 'BOX FIGHT',        color: '#4466ff', size: 'small', pvp: true },
  { id: 'corridor',       name: 'CORRIDOR',         color: '#ff00aa', size: 'small', pvp: true },
  { id: 'arena',          name: 'ARENA',            color: '#aa44ff', size: 'small', pvp: true },
];
