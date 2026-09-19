import * as THREE from 'three';

// Game Configuration
const CONFIG = {
    worldSize: 500,
    gravity: 30,
    playerSpeed: 8,
    sprintMultiplier: 1.8,
    jumpForce: 12,
    staminaDrain: 15,
    staminaRegen: 10,
    maxStamina: 100,
    maxHealth: 100,
    dayDuration: 120
};

const ELEMENTS = { FIRE: 'fire', WATER: 'water', WIND: 'wind', LIGHTNING: 'lightning' };
const ELEMENT_COLORS = { fire: 0xef4444, water: 0x3b82f6, wind: 0x22c55e, lightning: 0xeab308 };

const CHARACTERS = [
    { id: 0, name: 'Kael', element: ELEMENTS.FIRE, color: 0xef4444, stats: { baseHealth: 100, baseAttack: 25 }, skills: { normal: { damage: 1 }, charged: { damage: 2, stamina: 20 }, skill: { name: 'Flame Strike', damage: 3, stamina: 25, cooldown: 8 }, ultimate: { name: 'Inferno Burst', damage: 8, energy: 100, cooldown: 15 } } },
    { id: 1, name: 'Lyra', element: ELEMENTS.WATER, color: 0x3b82f6, stats: { baseHealth: 90, baseAttack: 18 }, skills: { normal: { damage: 0.8 }, charged: { damage: 1.5, stamina: 20 }, skill: { name: 'Tidal Wave', damage: 2.5, stamina: 25, cooldown: 10 }, ultimate: { name: 'Ocean Blessing', damage: 5, energy: 100, cooldown: 18, heal: 30 } } },
    { id: 2, name: 'Zephyr', element: ELEMENTS.WIND, color: 0x22c55e, stats: { baseHealth: 85, baseAttack: 22 }, skills: { normal: { damage: 1 }, charged: { damage: 2.5, stamina: 25 }, skill: { name: 'Gale Force', damage: 2, stamina: 20, cooldown: 6 }, ultimate: { name: 'Tempest Domain', damage: 6, energy: 100, cooldown: 20 } } },
    { id: 3, name: 'Volt', element: ELEMENTS.LIGHTNING, color: 0xeab308, stats: { baseHealth: 95, baseAttack: 24 }, skills: { normal: { damage: 1.1 }, charged: { damage: 2.2, stamina: 20 }, skill: { name: 'Thunder Slash', damage: 3.5, stamina: 25, cooldown: 7 }, ultimate: { name: 'Lightning Storm', damage: 7, energy: 100, cooldown: 16 } } }
];

const QUEST_DATA = {
    title: 'Echoes Beneath the Sky',
    stages: [
        { description: 'Talk to Elder Mira in the village' },
        { description: 'Travel to the Ancient Ruins (North)' },
        { description: 'Defeat the guardian enemies' },
        { description: 'Investigate the mysterious altar' },
        { description: 'Defeat the Shadow Guardian boss' },
        { description: 'Return to Elder Mira' }
    ],
    rewards: { xp: 500, items: [{ id: 'ancient_crystal', name: 'Ancient Crystal', count: 1 }] }
};

class AudioSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
    }
    playTone(freq, type, duration, start = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.masterGain);
        const now = this.ctx.currentTime + start;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    }
    playNoise(duration, start = 0) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.2;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        const now = this.ctx.currentTime + start;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        noise.start(now);
    }
    playAttack() { this.playTone(300, 'square', 0.1); this.playTone(200, 'square', 0.15, 0.05); }
    playSkill() { this.playTone(400, 'sine', 0.2); this.playTone(600, 'sine', 0.3, 0.1); }
    playUltimate() { this.playTone(300, 'sawtooth', 0.5); this.playTone(450, 'sawtooth', 0.5, 0.1); this.playTone(600, 'sawtooth', 0.8, 0.2); }
    playHit() { this.playNoise(0.1); }
    playChestOpen() { this.playTone(523, 'sine', 0.1); this.playTone(659, 'sine', 0.1, 0.1); this.playTone(784, 'sine', 0.3, 0.2); }
    playCollect() { this.playTone(880, 'sine', 0.1); this.playTone(1175, 'sine', 0.15, 0.05); }
    playDeath() { this.playTone(400, 'sawtooth', 0.3); this.playTone(300, 'sawtooth', 0.4, 0.2); this.playTone(200, 'sawtooth', 0.5, 0.4); }
    playVictory() { [523, 659, 784, 1047].forEach((f, i) => this.playTone(f, 'sine', 0.3, i * 0.15)); }
    playStep() { this.playNoise(0.05); }
    playJump() { this.playTone(200, 'sine', 0.2); }
}

class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.maxParticles = 500;
        this.pool = [];
        this.geometry = new THREE.PlaneGeometry(0.3, 0.3);
        this.materials = {};
        Object.keys(ELEMENT_COLORS).forEach(key => {
            this.materials[key] = new THREE.MeshBasicMaterial({ color: ELEMENT_COLORS[key], transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
        });
    }
    getParticle() {
        if (this.pool.length > 0) return this.pool.pop();
        if (this.particles.length < this.maxParticles) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
            const mesh = new THREE.Mesh(this.geometry, material);
            mesh.visible = false;
            this.scene.add(mesh);
            this.particles.push(mesh);
            return mesh;
        }
        return null;
    }
    emit(position, options = {}) {
        const { count = 10, color = 0xffffff, velocity = new THREE.Vector3(0, 2, 0), spread = 1, lifetime = 1, size = 0.3, element = null } = options;
        let material = element && this.materials[element] ? this.materials[element] : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) continue;
            particle.material = material;
            particle.position.copy(position);
            particle.scale.set(size, size, size);
            particle.visible = true;
            const vel = new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread).normalize().multiplyScalar(velocity.length());
            this.particleData = this.particleData || {};
            this.particleData[particle.id] = { velocity: vel, lifetime, age: 0, startOpacity: 0.8 };
            particle.userData = this.particleData[particle.id];
        }
    }
    update(delta) {
        Object.keys(this.particleData || {}).forEach(key => {
            const data = this.particleData[key];
            const particle = this.particles.find(p => p.id == key);
            if (!particle || !data) return;
            data.age += delta;
            particle.position.add(data.velocity.clone().multiplyScalar(delta));
            data.velocity.y -= CONFIG.gravity * 0.3 * delta;
            const progress = data.age / data.lifetime;
            particle.material.opacity = data.startOpacity * (1 - progress);
            particle.rotation.z += delta * 2;
            if (data.age >= data.lifetime) {
                particle.visible = false;
                delete this.particleData[key];
                this.pool.push(particle);
            }
        });
    }
}

class GameState {
    constructor() {
        this.playerLevel = 1;
        this.playerXP = 0;
        this.xpToNextLevel = 100;
        this.inventory = {};
        this.quests = { current: QUEST_DATA, stage: 0, completed: false };
        this.chestsOpened = [];
        this.collectiblesCollected = [];
        this.bossDefeated = false;
        this.playTime = 0;
    }
    addXP(amount) {
        this.playerXP += amount;
        let leveledUp = false;
        while (this.playerXP >= this.xpToNextLevel) {
            this.playerXP -= this.xpToNextLevel;
            this.playerLevel++;
            this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
            leveledUp = true;
        }
        return leveledUp;
    }
    addItem(itemId, name, count = 1) {
        if (!this.inventory[itemId]) this.inventory[itemId] = { name, count: 0 };
        this.inventory[itemId].count += count;
    }
    save() {
        localStorage.setItem('skybound_save', JSON.stringify({
            playerLevel: this.playerLevel, playerXP: this.playerXP, inventory: this.inventory,
            quests: this.quests, chestsOpened: this.chestsOpened, collectiblesCollected: this.collectiblesCollected,
            bossDefeated: this.bossDefeated, playTime: this.playTime, timestamp: Date.now()
        }));
    }
    load() {
        const saved = localStorage.getItem('skybound_save');
        if (saved) {
            const data = JSON.parse(saved);
            this.playerLevel = data.playerLevel || 1;
            this.playerXP = data.playerXP || 0;
            this.inventory = data.inventory || {};
            this.quests = data.quests || this.quests;
            this.chestsOpened = data.chestsOpened || [];
            this.collectiblesCollected = data.collectiblesCollected || [];
            this.bossDefeated = data.bossDefeated || false;
            this.playTime = data.playTime || 0;
            return true;
        }
        return false;
    }
}

class Player {
    constructor(scene, camera, audio) {
        this.scene = scene;
        this.camera = camera;
        this.audio = audio;
        this.currentCharIndex = 0;
        this.characters = CHARACTERS.map(c => ({
            ...c, health: c.stats.baseHealth, maxHealth: c.stats.baseHealth,
            stamina: CONFIG.maxStamina, energy: 0, skillCooldown: 0, ultimateCooldown: 0
        }));
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.isSprinting = false;
        this.isDodging = false;
        this.dodgeDirection = new THREE.Vector3();
        this.dodgeTime = 0;
        this.invincible = false;
        this.invincibleTime = 0;
        this.position = new THREE.Vector3(50, 10, 0);
        this.rotation = 0;
        this.height = 1.8;
        this.cameraAngleX = Math.PI;
        this.cameraAngleY = 0.3;
        this.cameraDistance = 8;
        this.keys = {};
        this.createVisual();
    }

    createVisual() {
        this.mesh = new THREE.Group();
        const char = this.characters[this.currentCharIndex];
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 1, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: char.color, roughness: 0.7, metalness: 0.3 });
        this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        this.bodyMesh.position.y = 0.9;
        this.mesh.add(this.bodyMesh);
        const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
        this.headMesh = new THREE.Mesh(headGeo, headMat);
        this.headMesh.position.y = 1.7;
        this.mesh.add(this.headMesh);
        const weaponGeo = new THREE.BoxGeometry(0.1, 1.2, 0.1);
        const weaponMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
        this.weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
        this.weaponMesh.position.set(0.4, 1, 0.3);
        this.weaponMesh.rotation.x = Math.PI / 4;
        this.mesh.add(this.weaponMesh);
        const auraGeo = new THREE.SphereGeometry(0.6, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({ color: char.color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
        this.auraMesh = new THREE.Mesh(auraGeo, auraMat);
        this.auraMesh.position.y = 1;
        this.mesh.add(this.auraMesh);
        this.scene.add(this.mesh);
        this.mesh.position.copy(this.position);
    }

    updateCharacterVisual() {
        const char = this.characters[this.currentCharIndex];
        this.bodyMesh.material.color.setHex(char.color);
        this.auraMesh.material.color.setHex(char.color);
    }

    getCurrentChar() { return this.characters[this.currentCharIndex]; }

    switchCharacter(index) {
        if (index < 0 || index >= this.characters.length || index === this.currentCharIndex) return;
        const current = this.getCurrentChar();
        if (current.health <= 0) return;
        this.currentCharIndex = index;
        this.updateCharacterVisual();
        this.updateUI();
        this.audio.playSkill();
    }

    takeDamage(amount) {
        if (this.invincible || this.isDodging) return;
        const char = this.getCurrentChar();
        char.health = Math.max(0, char.health - amount);
        this.invincible = true;
        this.invincibleTime = 0.5;
        this.audio.playHit();
        this.updateUI();
        if (char.health <= 0) {
            const allDown = this.characters.every(c => c.health <= 0);
            if (allDown) { game.onPlayerDeath(); }
            else {
                for (let i = 0; i < this.characters.length; i++) {
                    if (this.characters[i].health > 0) { this.switchCharacter(i); break; }
                }
            }
        }
    }

    heal(amount) {
        const char = this.getCurrentChar();
        char.health = Math.min(char.maxHealth, char.health + amount);
        this.updateUI();
    }

    useSkill() {
        const char = this.getCurrentChar();
        if (char.skillCooldown > 0 || char.stamina < char.skills.skill.stamina) return;
        char.stamina -= char.skills.skill.stamina;
        char.skillCooldown = char.skills.skill.cooldown;
        this.audio.playSkill();
        game.particles.emit(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), { count: 20, element: char.element, velocity: new THREE.Vector3(0, 3, 1), spread: 2, lifetime: 0.8 });
        game.dealAOEDamage(this.mesh.position, 5, char.skills.skill.damage * char.stats.baseAttack, char.element);
        this.updateUI();
    }

    useUltimate() {
        const char = this.getCurrentChar();
        if (char.ultimateCooldown > 0 || char.energy < char.skills.ultimate.energy) return;
        char.energy = 0;
        char.ultimateCooldown = char.skills.ultimate.cooldown;
        this.audio.playUltimate();
        game.particles.emit(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), { count: 50, element: char.element, velocity: new THREE.Vector3(0, 5, 0), spread: 4, lifetime: 1.5, size: 0.5 });
        game.cameraShake = 0.5;
        game.dealAOEDamage(this.mesh.position, 8, char.skills.ultimate.damage * char.stats.baseAttack, char.element);
        if (char.skills.ultimate.heal) this.heal(char.skills.ultimate.heal);
        this.updateUI();
    }

    attack(isCharged = false) {
        const now = Date.now();
        if (now - this.lastAttackTime < 200) return;
        const char = this.getCurrentChar();
        if (isCharged && char.stamina < char.skills.charged.stamina) return;
        if (isCharged) char.stamina -= char.skills.charged.stamina;
        this.lastAttackTime = now;
        const skill = isCharged ? char.skills.charged : char.skills.normal;
        const damage = skill.damage * char.stats.baseAttack;
        this.weaponMesh.rotation.x = -Math.PI / 3;
        setTimeout(() => { this.weaponMesh.rotation.x = Math.PI / 4; }, 200);
        this.audio.playAttack();
        const attackRange = isCharged ? 4 : 3;
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
        const attackPos = this.mesh.position.clone().add(forward.multiplyScalar(attackRange / 2));
        game.particles.emit(attackPos, { count: isCharged ? 15 : 8, color: char.color, velocity: new THREE.Vector3(0, 1, 0), spread: 1, lifetime: 0.4 });
        game.enemies.forEach(enemy => {
            if (enemy.mesh.position.distanceTo(attackPos) < attackRange) {
                game.damageEnemy(enemy, damage, char.element);
            }
        });
        this.updateUI();
    }

    dodge(direction) {
        if (this.isDodging) return;
        const char = this.getCurrentChar();
        if (char.stamina < 15) return;
        char.stamina -= 15;
        this.isDodging = true;
        this.dodgeTime = 0.3;
        this.dodgeDirection = direction.clone().normalize();
        this.invincible = true;
        this.audio.playStep();
        this.updateUI();
    }

    update(delta, time) {
        const char = this.getCurrentChar();
        if (char.skillCooldown > 0) char.skillCooldown -= delta;
        if (char.ultimateCooldown > 0) char.ultimateCooldown -= delta;
        if (this.invincible) { this.invincibleTime -= delta; if (this.invincibleTime <= 0) this.invincible = false; }
        if (this.isDodging) {
            this.dodgeTime -= delta;
            this.mesh.position.add(this.dodgeDirection.clone().multiplyScalar(CONFIG.playerSpeed * 2 * delta));
            if (this.dodgeTime <= 0) { this.isDodging = false; this.invincible = false; }
            this.updateCamera();
            this.updateUI();
            return;
        }
        this.handleInput(delta);
        if (!this.isGliding) this.velocity.y -= CONFIG.gravity * delta;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        const groundHeight = game.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y <= groundHeight + this.height / 2) {
            this.mesh.position.y = groundHeight + this.height / 2;
            this.velocity.y = 0;
            this.isGrounded = true;
            this.isGliding = false;
        } else { this.isGrounded = false; }
        const worldRadius = CONFIG.worldSize / 2;
        this.mesh.position.x = Math.max(-worldRadius, Math.min(worldRadius, this.mesh.position.x));
        this.mesh.position.z = Math.max(-worldRadius, Math.min(worldRadius, this.mesh.position.z));
        if (this.velocity.y < -20 && this.isGrounded) {
            this.takeDamage((Math.abs(this.velocity.y) - 15) * 0.5);
            this.velocity.y = 0;
        }
        if (!this.isSprinting && !this.isDodging && char.stamina < CONFIG.maxStamina) {
            char.stamina += CONFIG.staminaRegen * delta;
            if (char.stamina > CONFIG.maxStamina) char.stamina = CONFIG.maxStamina;
        }
        this.position.copy(this.mesh.position);
        this.updateCamera();
        this.updateUI();
        this.checkInteractions();
        this.auraMesh.rotation.y += delta;
        this.auraMesh.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
    }

    handleInput(delta) {
        const moveSpeed = this.isSprinting ? CONFIG.playerSpeed * CONFIG.sprintMultiplier : CONFIG.playerSpeed;
        const char = this.getCurrentChar();
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraAngleX);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraAngleX);
        forward.y = 0; right.y = 0; forward.normalize(); right.normalize();
        const moveDir = new THREE.Vector3();
        if (this.keys['KeyW']) moveDir.add(forward);
        if (this.keys['KeyS']) moveDir.sub(forward);
        if (this.keys['KeyA']) moveDir.sub(right);
        if (this.keys['KeyD']) moveDir.add(right);
        if (moveDir.length() > 0) {
            moveDir.normalize();
            const targetRotation = Math.atan2(moveDir.x, moveDir.z);
            const rotDiff = targetRotation - this.rotation;
            this.rotation += rotDiff * 10 * delta;
            if (this.isSprinting && char.stamina > 0) {
                char.stamina -= CONFIG.staminaDrain * delta;
                if (char.stamina <= 0) this.isSprinting = false;
            }
            const actualSpeed = this.isSprinting ? moveSpeed * 1.5 : moveSpeed;
            this.velocity.x = moveDir.x * actualSpeed;
            this.velocity.z = moveDir.z * actualSpeed;
            if (this.isGrounded && Math.random() < 0.1) this.audio.playStep();
        } else { this.velocity.x = 0; this.velocity.z = 0; }
        if (this.keys['Space'] && this.isGrounded && char.stamina >= 10) {
            this.velocity.y = CONFIG.jumpForce;
            this.isGrounded = false;
            char.stamina -= 10;
            this.audio.playJump();
            this.updateUI();
        }
        if (this.keys['Space'] && !this.isGrounded && this.velocity.y < 0 && !this.isGliding) {
            this.isGliding = true;
        }
    }

    updateCamera() {
        const dx = this.cameraDistance * Math.sin(this.cameraAngleX) * Math.cos(this.cameraAngleY);
        const dy = this.cameraDistance * Math.sin(this.cameraAngleY);
        const dz = this.cameraDistance * Math.cos(this.cameraAngleX) * Math.cos(this.cameraAngleY);
        const targetPos = this.mesh.position.clone().add(new THREE.Vector3(dx, dy + 2, dz));
        this.camera.position.lerp(targetPos, 0.1);
        this.camera.lookAt(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    }

    checkInteractions() {
        const interactables = [...game.chests, ...game.npcs, ...game.collectibles, ...game.teleportPoints];
        let nearest = null, nearestDist = 3;
        interactables.forEach(obj => {
            if (!obj.active) return;
            const dist = obj.mesh.position.distanceTo(this.mesh.position);
            if (dist < nearestDist) { nearestDist = dist; nearest = obj; }
        });
        if (nearest) game.showInteractionPrompt(nearest.type, nearest);
        else game.hideInteractionPrompt();
    }

    updateUI() {
        const char = this.getCurrentChar();
        document.getElementById('healthBar').style.width = (char.health / char.maxHealth * 100) + '%';
        document.getElementById('healthText').textContent = Math.ceil(char.health) + '/' + char.maxHealth;
        document.getElementById('staminaBar').style.width = (char.stamina / CONFIG.maxStamina * 100) + '%';
        document.getElementById('ultimateBar').style.width = char.energy + '%';
        if (char.energy >= 100) {
            document.getElementById('ultimateBar').classList.add('ready');
            document.getElementById('ultimateText').textContent = 'READY!';
        } else {
            document.getElementById('ultimateBar').classList.remove('ready');
            document.getElementById('ultimateText').textContent = 'ULTIMATE';
        }
        this.characters.forEach((c, i) => {
            const slot = document.getElementById('charSlot' + i);
            const icon = document.getElementById('charIcon' + i);
            if (slot && icon) {
                slot.classList.toggle('active', i === this.currentCharIndex);
                icon.className = 'char-icon element-' + c.element;
                slot.style.opacity = c.health <= 0 ? '0.5' : '1';
            }
        });
        const skillCD = document.getElementById('skillCooldown'), skillCDText = document.getElementById('skillCDText');
        if (char.skillCooldown > 0) { skillCD.classList.add('on-cooldown'); skillCDText.textContent = Math.ceil(char.skillCooldown); }
        else { skillCD.classList.remove('on-cooldown'); skillCDText.textContent = ''; }
        const ultCD = document.getElementById('ultimateCooldown'), ultCDText = document.getElementById('ultimateCDText');
        if (char.ultimateCooldown > 0) { ultCD.classList.add('on-cooldown'); ultCDText.textContent = Math.ceil(char.ultimateCooldown); }
        else { ultCD.classList.remove('on-cooldown'); ultCDText.textContent = ''; }
    }
}

class Enemy {
    constructor(scene, position, type, game) {
        this.scene = scene; this.game = game; this.type = type; this.position = position.clone();
        this.active = true; this.dead = false;
        const stats = { melee: { health: 50, damage: 10, speed: 4, element: 'fire', xp: 20, name: 'Shadow Warrior' },
            ranged: { health: 35, damage: 8, speed: 3.5, element: 'wind', xp: 25, name: 'Wind Archer' },
            flying: { health: 30, damage: 7, speed: 5, element: 'lightning', xp: 30, name: 'Storm Sprite' },
            elite: { health: 100, damage: 15, speed: 4.5, element: 'water', xp: 50, name: 'Elite Guardian' },
            boss: { health: 500, damage: 25, speed: 3, element: 'fire', xp: 500, name: 'Shadow Guardian' } };
        const s = stats[type] || stats.melee;
        this.maxHealth = s.health; this.health = s.health; this.damage = s.damage;
        this.speed = s.speed; this.element = s.element; this.xpReward = s.xp; this.name = s.name;
        this.state = 'idle'; this.attackCooldown = 0; this.patrolPoint = this.getRandomPatrolPoint(); this.stateTime = 0;
        this.createMesh();
    }
    getRandomPatrolPoint() {
        const angle = Math.random() * Math.PI * 2, radius = 10 + Math.random() * 20;
        return new THREE.Vector3(this.position.x + Math.cos(angle) * radius, this.position.y, this.position.z + Math.sin(angle) * radius);
    }
    createMesh() {
        this.mesh = new THREE.Group();
        let color, scale;
        if (this.type === 'boss') { scale = 3; color = 0x8b0000; }
        else if (this.type === 'elite') { scale = 1.5; color = 0x4a0080; }
        else if (this.type === 'flying') { scale = 0.8; color = 0xeab308; }
        else if (this.type === 'ranged') { scale = 1; color = 0x22c55e; }
        else { scale = 1; color = 0x8b0000; }
        const bodyGeo = new THREE.CapsuleGeometry(0.4 * scale, 1 * scale, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.3 });
        this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat); this.bodyMesh.position.y = 0.9 * scale; this.mesh.add(this.bodyMesh);
        const headGeo = new THREE.SphereGeometry(0.3 * scale, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
        this.headMesh = new THREE.Mesh(headGeo, headMat); this.headMesh.position.y = 1.7 * scale; this.mesh.add(this.headMesh);
        const eyeGeo = new THREE.SphereGeometry(0.1 * scale, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: ELEMENT_COLORS[this.element], emissive: ELEMENT_COLORS[this.element] });
        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat); this.leftEye.position.set(-0.15 * scale, 1.75 * scale, 0.25 * scale); this.mesh.add(this.leftEye);
        this.rightEye = new THREE.Mesh(eyeGeo, eyeMat); this.rightEye.position.set(0.15 * scale, 1.75 * scale, 0.25 * scale); this.mesh.add(this.rightEye);
        if (this.type === 'flying' || this.type === 'boss') {
            const wingGeo = new THREE.BoxGeometry(1.5 * scale, 0.1 * scale, 0.8 * scale);
            const wingMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7 });
            this.wings = new THREE.Mesh(wingGeo, wingMat); this.wings.position.y = 1.2 * scale; this.mesh.add(this.wings);
        }
        this.mesh.position.copy(this.position); this.scene.add(this.mesh);
    }
    update(delta, playerPos) {
        if (!this.active || this.dead) return;
        this.stateTime += delta;
        if (this.attackCooldown > 0) this.attackCooldown -= delta;
        const distToPlayer = this.mesh.position.distanceTo(playerPos);
        if (this.state === 'idle') {
            if (distToPlayer < 30) { this.state = 'chase'; } else if (this.stateTime > 3) { this.state = 'patrol'; this.stateTime = 0; }
        } else if (this.state === 'patrol') {
            if (distToPlayer < 30) { this.state = 'chase'; }
            else {
                const distToPatrol = this.mesh.position.distanceTo(this.patrolPoint);
                if (distToPatrol < 1) { this.patrolPoint = this.getRandomPatrolPoint(); }
                else { const dir = this.patrolPoint.clone().sub(this.mesh.position).normalize(); this.mesh.position.add(dir.multiplyScalar(this.speed * 0.5 * delta)); this.mesh.lookAt(this.patrolPoint); }
            }
            if (this.stateTime > 10) { this.state = 'idle'; this.stateTime = 0; }
        } else if (this.state === 'chase') {
            if (distToPlayer > 40) { this.state = 'idle'; }
            else if (distToPlayer < 3) { this.state = 'attack'; }
            else { const dir = playerPos.clone().sub(this.mesh.position).normalize(); dir.y = 0; this.mesh.position.add(dir.multiplyScalar(this.speed * delta)); this.mesh.lookAt(playerPos); }
        } else if (this.state === 'attack') {
            if (distToPlayer > 4) { this.state = 'chase'; }
            else if (this.attackCooldown <= 0) { this.performAttack(); }
        }
        if (this.wings) this.wings.rotation.y = Math.sin(Date.now() * 0.01) * 0.5;
        const groundHeight = this.game.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
        if (this.type !== 'flying' && this.type !== 'boss') this.mesh.position.y = Math.max(groundHeight + 0.9, this.mesh.position.y);
    }
    performAttack() {
        this.attackCooldown = 1.5; this.game.audio.playAttack();
        this.bodyMesh.scale.set(1.2, 1.2, 1.2);
        setTimeout(() => { if (this.bodyMesh) this.bodyMesh.scale.set(1, 1, 1); }, 200);
        setTimeout(() => {
            if (this.active && !this.dead) {
                this.game.player.takeDamage(this.damage);
                this.game.particles.emit(this.game.player.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), { count: 10, color: ELEMENT_COLORS[this.element], velocity: new THREE.Vector3(0, 2, 0), spread: 1, lifetime: 0.5 });
            }
        }, 300);
    }
    takeDamage(amount, element) {
        if (!this.active || this.dead) return;
        this.health -= amount;
        this.bodyMesh.material.emissiveIntensity = 1;
        setTimeout(() => { if (this.bodyMesh) this.bodyMesh.material.emissiveIntensity = 0.3; }, 100);
        this.game.showDamageNumber(this.mesh.position, Math.floor(amount), 'normal');
        if (this.health <= 0) this.die();
    }
    die() {
        this.dead = true; this.active = false;
        this.game.particles.emit(this.mesh.position, { count: 30, color: ELEMENT_COLORS[this.element], velocity: new THREE.Vector3(0, 3, 0), spread: 3, lifetime: 1 });
        this.game.audio.playHit(); this.game.onEnemyDefeated(this); this.mesh.visible = false;
    }
    showHealthBar() {
        document.getElementById('enemyPanel').classList.remove('hidden');
        document.getElementById('enemyName').textContent = this.name;
        document.getElementById('enemyHealthBar').style.width = (this.health / this.maxHealth * 100) + '%';
    }
}

class Chest {
    constructor(scene, position, game, id) {
        this.scene = scene; this.game = game; this.position = position.clone(); this.id = id; this.active = true; this.opened = false; this.type = 'chest';
        this.createMesh(); this.generateLoot();
    }
    createMesh() {
        this.mesh = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(1, 0.6, 0.7), baseMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
        const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = 0.3; this.mesh.add(base);
        const lidGeo = new THREE.BoxGeometry(1, 0.2, 0.7), lidMat = new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.7 });
        this.lid = new THREE.Mesh(lidGeo, lidMat); this.lid.position.y = 0.7; this.mesh.add(this.lid);
        const trimGeo = new THREE.BoxGeometry(1.05, 0.1, 0.1), trimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
        const trim = new THREE.Mesh(trimGeo, trimMat); trim.position.set(0, 0.65, 0.3); this.mesh.add(trim);
        this.mesh.position.copy(this.position); this.scene.add(this.mesh);
    }
    generateLoot() {
        const lootTable = [{ id: 'herb', name: 'Mystic Herb', chance: 0.4, count: [1, 3] }, { id: 'ore', name: 'Star Ore', chance: 0.3, count: [1, 2] },
            { id: 'crystal', name: 'Sky Crystal', chance: 0.2, count: [1, 1] }, { id: 'potion', name: 'Health Potion', chance: 0.5, count: [1, 2] }];
        this.loot = []; lootTable.forEach(item => { if (Math.random() < item.chance) this.loot.push({ ...item, count: Math.floor(Math.random() * (item.count[1] - item.count[0] + 1)) + item.count[0] }); });
        if (this.loot.length === 0) this.loot.push({ id: 'herb', name: 'Mystic Herb', count: 1 });
    }
    open() {
        if (this.opened || !this.active) return; this.opened = true; this.active = false;
        const anim = () => { this.lid.rotation.x += 0.1; if (this.lid.rotation.x < Math.PI / 2) requestAnimationFrame(anim); }; anim();
        this.loot.forEach(item => { this.game.state.addItem(item.id, item.name, item.count); this.game.showFloatingText('+' + item.count + ' ' + item.name, this.mesh.position); });
        this.game.audio.playChestOpen(); this.game.state.chestsOpened.push(this.id);
    }
}

class NPC {
    constructor(scene, position, game, name, dialogue) {
        this.scene = scene; this.game = game; this.position = position.clone(); this.name = name; this.dialogue = dialogue; this.type = 'npc'; this.active = true;
        this.createMesh();
    }
    createMesh() {
        this.mesh = new THREE.Group();
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.2, 8, 16), bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat); body.position.y = 0.8; this.mesh.add(body);
        const headGeo = new THREE.SphereGeometry(0.35, 16, 16), headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat); head.position.y = 1.7; this.mesh.add(head);
        const markerGeo = new THREE.SphereGeometry(0.2, 8, 8), markerMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        this.questMarker = new THREE.Mesh(markerGeo, markerMat); this.questMarker.position.y = 2.3; this.mesh.add(this.questMarker);
        this.mesh.position.copy(this.position); this.scene.add(this.mesh);
    }
    interact() { this.game.showDialogue(this.name, this.game.state.quests.stage); this.game.audio.playCollect(); }
    update(time) { if (this.questMarker) { this.questMarker.rotation.y = time; this.questMarker.position.y = 2.3 + Math.sin(time * 2) * 0.1; } }
}

class Collectible {
    constructor(scene, position, game, id, name, type) {
        this.scene = scene; this.game = game; this.position = position.clone(); this.id = id; this.name = name; this.type = type; this.active = true;
        this.createMesh();
    }
    createMesh() {
        this.mesh = new THREE.Group();
        let geo, mat;
        if (this.type === 'plant') { geo = new THREE.SphereGeometry(0.2, 8, 8); mat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.3 }); }
        else if (this.type === 'ore') { geo = new THREE.DodecahedronGeometry(0.25, 0); mat = new THREE.MeshStandardMaterial({ color: 0x8b4513, metalness: 0.8, roughness: 0.3 }); }
        else { geo = new THREE.OctahedronGeometry(0.2, 0); mat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }); }
        this.item = new THREE.Mesh(geo, mat); this.mesh.add(this.item);
        this.mesh.position.copy(this.position); this.scene.add(this.mesh);
    }
    collect() {
        if (!this.active) return; this.active = false; this.mesh.visible = false;
        this.game.state.addItem(this.id, this.name, 1); this.game.state.collectiblesCollected.push(this.id);
        this.game.showFloatingText('+1 ' + this.name, this.mesh.position); this.game.audio.playCollect();
        this.game.particles.emit(this.mesh.position, { count: 10, color: this.item.material.color, velocity: new THREE.Vector3(0, 2, 0), spread: 1, lifetime: 0.5 });
    }
    update(time) { if (!this.active) return; this.item.rotation.y = time; this.item.position.y = Math.sin(time * 2) * 0.1; }
