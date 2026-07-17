// Game Configuration and State Management
const GRID_WIDTH = 40;
const GRID_HEIGHT = 54;
const WARNING_ROW = 12; // 22% of height (represented by the dashed red line)

// Color Palette with HSL values for deterministic texture rendering
const COLOR_PALETTE = {
    'cyan':   { h: 190, s: 95, l: 55, hex: '#00f5d4' },
    'yellow': { h: 50,  s: 100, l: 60, hex: '#fee440' },
    'purple': { h: 280, s: 85,  l: 58, hex: '#9b5de5' },
    'green':  { h: 145, s: 80,  l: 50, hex: '#00bbf9' }, // customized neon cyan/green
    'red':    { h: 345, s: 90,  l: 55, hex: '#ff0054' },
    'blue':   { h: 220, s: 90,  l: 55, hex: '#005f73' },
    'orange': { h: 28,  s: 100, l: 55, hex: '#f77f00' }
};

// Tetromino Definitions (Offset list from pivot)
const TETROMINOES = {
    'I': {
        color: 'cyan',
        shape: [ {x: -1, y: 0}, {x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0} ]
    },
    'O': {
        color: 'yellow',
        shape: [ {x: 0, y: 0}, {x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1} ],
        noRotate: true
    },
    'T': {
        color: 'purple',
        shape: [ {x: 0, y: -1}, {x: -1, y: 0}, {x: 0, y: 0}, {x: 1, y: 0} ]
    },
    'S': {
        color: 'green',
        shape: [ {x: 0, y: -1}, {x: 1, y: -1}, {x: -1, y: 0}, {x: 0, y: 0} ]
    },
    'Z': {
        color: 'red',
        shape: [ {x: -1, y: -1}, {x: 0, y: -1}, {x: 0, y: 0}, {x: 1, y: 0} ]
    },
    'J': {
        color: 'blue',
        shape: [ {x: -1, y: -1}, {x: -1, y: 0}, {x: 0, y: 0}, {x: 1, y: 0} ]
    },
    'L': {
        color: 'orange',
        shape: [ {x: 1, y: -1}, {x: -1, y: 0}, {x: 0, y: 0}, {x: 1, y: 0} ]
    }
};

class Particle {
    constructor(x, y, colorHex, vx, vy, life) {
        this.x = x;
        this.y = y;
        this.color = colorHex;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.08; // gravity
        this.vx *= 0.98; // drag
        this.life--;
    }
    draw(ctx, cellW, cellH) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x * cellW, this.y * cellH, cellW * 0.9, cellH * 0.9);
        ctx.restore();
    }
}

class GameController {
    constructor() {
        this.physics = new SandPhysics(GRID_WIDTH, GRID_HEIGHT);
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas cell sizes
        this.cellW = this.canvas.width / GRID_WIDTH;
        this.cellH = this.canvas.height / GRID_HEIGHT;

        // Preview Canvases
        this.previewCanvas1 = document.getElementById('preview-canvas-1');
        this.previewCtx1 = this.previewCanvas1.getContext('2d');
        this.previewCanvas2 = document.getElementById('preview-canvas-2');
        this.previewCtx2 = this.previewCanvas2.getContext('2d');
        
        // Game state variables
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('sandtrix_highscore')) || 0;
        this.level = 1;
        this.diamonds = parseInt(localStorage.getItem('sandtrix_diamonds')) || 150; // default 150 as a starter gift
        this.pointsForNextLevel = 1000;
        this.pointsAccumulatedThisLevel = 0;

        this.activeBlock = null;
        this.nextQueue = [];
        this.particles = [];
        
        // State Machine states: 'START', 'PLAYING', 'SETTLING', 'CLEARING', 'PAUSED', 'GAMEOVER'
        this.state = 'START';
        
        this.tickCounter = 0;
        this.tickLimit = 40; // frames per grid step (lower is faster)
        this.isFastDropping = false;
        
        this.clearingCells = [];
        this.clearingTimer = 0;
        
        this.cycloneAimActive = false;

        // UI elements
        this.levelEl = document.getElementById('level-value');
        this.highScoreEl = document.getElementById('high-score-value');
        this.progressFillEl = document.getElementById('progress-fill');
        this.progressTextEl = document.getElementById('score-progress-text');
        this.diamondEl = document.getElementById('diamond-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.earnedDiamondsEl = document.getElementById('earned-diamonds');
        
        this.startScreen = document.getElementById('start-screen');
        this.pauseScreen = document.getElementById('pause-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.cycloneCursor = document.getElementById('cyclone-cursor');
        
        // Setup initial score display
        this.updateUI();
        this.setupEventListeners();
        this.fillQueue();

        // Start animation loop
        this.loop();
    }

    fillQueue() {
        const types = Object.keys(TETROMINOES);
        while (this.nextQueue.length < 5) {
            const randomType = types[Math.floor(Math.random() * types.length)];
            // Clone block template
            const template = TETROMINOES[randomType];
            this.nextQueue.push({
                type: randomType,
                color: template.color,
                shape: template.shape.map(offset => ({ ...offset })),
                noRotate: template.noRotate || false
            });
        }
    }

    spawnBlock() {
        this.fillQueue();
        this.activeBlock = this.nextQueue.shift();
        
        // Position at top center
        this.activeBlock.bx = Math.floor(GRID_WIDTH / 2);
        this.activeBlock.by = 2; // slightly offset from very top
        
        this.isFastDropping = false;
        this.tickCounter = 0;
        
        // Check initial collision (Game Over)
        if (!this.isValidPosition(this.activeBlock.shape, this.activeBlock.bx, this.activeBlock.by)) {
            this.triggerGameOver();
        }
        
        this.drawPreviews();
    }

    isValidPosition(shape, bx, by) {
        for (const offset of shape) {
            const gx = bx + offset.x;
            const gy = by + offset.y;
            
            // Wall boundaries
            if (gx < 0 || gx >= GRID_WIDTH || gy >= GRID_HEIGHT) {
                return false;
            }
            
            // Allow pieces to rotate above top threshold (gy < 0 is fine, but check grid bounds)
            if (gy >= 0) {
                if (this.physics.grid[gy][gx] !== 0) {
                    return false; // collides with existing sand
                }
            }
        }
        return true;
    }

    moveActiveBlock(dx, dy) {
        if (this.state !== 'PLAYING' || !this.activeBlock) return false;
        
        if (this.isValidPosition(this.activeBlock.shape, this.activeBlock.bx + dx, this.activeBlock.by + dy)) {
            this.activeBlock.bx += dx;
            this.activeBlock.by += dy;
            if (dx !== 0) audio.playMove();
            return true;
        }
        
        return false;
    }

    rotateActiveBlock() {
        if (this.state !== 'PLAYING' || !this.activeBlock || this.activeBlock.noRotate) return;
        
        // Rotate: (x, y) -> (-y, x)
        const rotatedShape = this.activeBlock.shape.map(offset => ({
            x: -offset.y,
            y: offset.x
        }));
        
        // Try simple rotation
        if (this.isValidPosition(rotatedShape, this.activeBlock.bx, this.activeBlock.by)) {
            this.activeBlock.shape = rotatedShape;
            audio.playRotate();
            return;
        }
        
        // Wall kick logic: try shifting left, right, or up
        const kicks = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -2, dy: 0 }, { dx: 2, dy: 0 },
            { dx: 0, dy: -1 }
        ];
        
        for (const kick of kicks) {
            if (this.isValidPosition(rotatedShape, this.activeBlock.bx + kick.dx, this.activeBlock.by + kick.dy)) {
                this.activeBlock.bx += kick.dx;
                this.activeBlock.by += kick.dy;
                this.activeBlock.shape = rotatedShape;
                audio.playRotate();
                return;
            }
        }
    }

    hardDrop() {
        if (this.state !== 'PLAYING' || !this.activeBlock) return;
        
        while (this.isValidPosition(this.activeBlock.shape, this.activeBlock.bx, this.activeBlock.by + 1)) {
            this.activeBlock.by++;
        }
        
        this.lockActiveBlock();
    }

    lockActiveBlock() {
        // Disintegrate block into sand grains
        this.activeBlock.shape.forEach(offset => {
            const gx = this.activeBlock.bx + offset.x;
            const gy = this.activeBlock.by + offset.y;
            
            if (gy >= 0 && gy < GRID_HEIGHT && gx >= 0 && gx < GRID_WIDTH) {
                this.physics.grid[gy][gx] = this.activeBlock.color;
            }
        });
        
        // Spawn small dust landing particles
        this.activeBlock.shape.forEach(offset => {
            const gx = this.activeBlock.bx + offset.x;
            const gy = this.activeBlock.by + offset.y;
            if (gy >= 0 && gy < GRID_HEIGHT) {
                const colorHex = COLOR_PALETTE[this.activeBlock.color].hex;
                for (let i = 0; i < 2; i++) {
                    this.particles.push(new Particle(
                        gx + Math.random(),
                        gy + Math.random(),
                        colorHex,
                        (Math.random() - 0.5) * 1.5,
                        (Math.random() - 1.0) * 1.0,
                        20 + Math.floor(Math.random() * 15)
                    ));
                }
            }
        });
        
        audio.playLand();
        this.activeBlock = null;
        
        // Trigger board shake
        const wrapper = document.querySelector('.board-wrapper');
        wrapper.classList.add('shake-screen');
        setTimeout(() => wrapper.classList.remove('shake-screen'), 250);
        
        // Transition to settling physics state
        this.state = 'SETTLING';
    }

    // Swaps current block with the first item in the next queue
    swapActiveBlock() {
        if (this.state !== 'PLAYING' || !this.activeBlock) return;
        
        if (this.diamonds < 50) {
            alert("Yetersiz Elmas! Şekil değiştirmek için 50 elmas gerekir.");
            return;
        }

        // Deduct diamonds
        this.diamonds -= 50;
        localStorage.setItem('sandtrix_diamonds', this.diamonds);
        audio.playPowerup();
        
        // Perform Swap
        const nextTemp = this.nextQueue.shift();
        nextTemp.bx = Math.floor(GRID_WIDTH / 2);
        nextTemp.by = 2;
        
        this.nextQueue.unshift(this.activeBlock); // Put current block in front of next queue
        this.activeBlock = nextTemp;
        
        this.updateUI();
        this.drawPreviews();
    }

    activateCycloneAim() {
        if (this.state !== 'PLAYING') return;
        if (this.diamonds < 70) {
            alert("Yetersiz Elmas! Kasırga için 70 elmas gerekir.");
            return;
        }
        
        this.cycloneAimActive = true;
        this.cycloneCursor.classList.add('active');
        document.getElementById('powerup-cyclone').classList.add('active');
    }

    deactivateCycloneAim() {
        this.cycloneAimActive = false;
        this.cycloneCursor.classList.remove('active');
        document.getElementById('powerup-cyclone').classList.remove('active');
    }

    triggerCyclone(clientX, clientY) {
        // Calculate canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        
        const gridX = Math.floor(canvasX / this.cellW);
        const gridY = Math.floor(canvasY / this.cellH);
        
        if (gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT) {
            // Deduct diamonds
            this.diamonds -= 70;
            localStorage.setItem('sandtrix_diamonds', this.diamonds);
            
            // Run explosion
            const radius = 6; // Grid cells radius
            const cleared = this.physics.clearCircle(gridX, gridY, radius);
            
            // Spawn swirl/cyclone particles
            cleared.forEach(cell => {
                const colorHex = COLOR_PALETTE[cell.color]?.hex || '#00f5d4';
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 4;
                this.particles.push(new Particle(
                    cell.x,
                    cell.y,
                    colorHex,
                    Math.cos(angle) * (2 + dist),
                    Math.sin(angle) * (2 + dist) - 1.5,
                    30 + Math.floor(Math.random() * 20)
                ));
            });
            
            audio.playPowerup();
            this.deactivateCycloneAim();
            this.updateUI();
            
            // Transition to settling to let sand fall into gaps
            this.state = 'SETTLING';
        }
    }

    triggerGameOver() {
        this.state = 'GAMEOVER';
        audio.playGameOver();
        
        // Calculate diamond reward based on score
        const bonusDiamonds = Math.floor(this.score / 200);
        this.diamonds += bonusDiamonds;
        localStorage.setItem('sandtrix_diamonds', this.diamonds);
        
        this.finalScoreEl.textContent = this.score;
        this.earnedDiamondsEl.textContent = `+${bonusDiamonds}`;
        
        this.gameOverScreen.classList.add('active');
        this.updateUI();
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.pauseScreen.classList.add('active');
            audio.stopMusic();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.pauseScreen.classList.remove('active');
            audio.startMusic();
        }
    }

    addPoints(pts) {
        this.score += pts;
        this.pointsAccumulatedThisLevel += pts;
        
        // Check level up
        if (this.pointsAccumulatedThisLevel >= this.pointsForNextLevel) {
            this.level++;
            this.pointsAccumulatedThisLevel -= this.pointsForNextLevel;
            
            // Increase speed (decrease tick limit)
            this.tickLimit = Math.max(8, 40 - (this.level * 3));
            audio.playPowerup();
        }
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('sandtrix_highscore', this.highScore);
        }
        
        // Diamonds for points milestone
        const diamondBonus = Math.floor(pts / 100) * 5;
        if (diamondBonus > 0) {
            this.diamonds += diamondBonus;
            localStorage.setItem('sandtrix_diamonds', this.diamonds);
        }

        this.updateUI();
    }

    updateUI() {
        this.levelEl.textContent = this.level;
        this.highScoreEl.textContent = this.highScore.toLocaleString('tr-TR');
        this.diamondEl.textContent = this.diamonds;
        
        // Level Progress bar
        const progressPercentage = Math.min(100, (this.pointsAccumulatedThisLevel / this.pointsForNextLevel) * 100);
        this.progressFillEl.style.width = `${progressPercentage}%`;
        this.progressTextEl.textContent = `${this.score.toLocaleString('tr-TR')} / ${(this.level * this.pointsForNextLevel).toLocaleString('tr-TR')}`;
    }

    startGame() {
        this.score = 0;
        this.pointsAccumulatedThisLevel = 0;
        this.level = 1;
        this.tickLimit = 40;
        this.particles = [];
        this.physics.initGrid();
        this.nextQueue = [];
        
        this.startScreen.classList.remove('active');
        this.pauseScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        
        this.state = 'PLAYING';
        this.updateUI();
        
        audio.init();
        audio.startMusic();
        
        this.spawnBlock();
    }

    // Game loop called 60 times/sec
    loop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        // Update particles
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);

        if (this.state === 'PLAYING') {
            this.tickCounter++;
            const limit = this.isFastDropping ? 3 : this.tickLimit;
            
            if (this.tickCounter >= limit) {
                this.tickCounter = 0;
                // Move down
                if (!this.moveActiveBlock(0, 1)) {
                    this.lockActiveBlock();
                }
            }
        } 
        else if (this.state === 'SETTLING') {
            // Run physics engine gravity updates multiple times per frame to speed up settling
            let sandMoved = false;
            for (let i = 0; i < 3; i++) {
                if (this.physics.updateSand()) {
                    sandMoved = true;
                }
            }
            
            // If sand is completely still, check for line connections
            if (!sandMoved) {
                const connections = this.physics.checkConnections();
                
                if (connections.length > 0) {
                    this.state = 'CLEARING';
                    this.clearingCells = connections;
                    this.clearingTimer = 20; // 20 frames of flash animation
                } else {
                    // Check if sand piles crossed warning height threshold (Game Over)
                    let crossedWarning = false;
                    for (let x = 0; x < GRID_WIDTH; x++) {
                        if (this.physics.grid[WARNING_ROW][x] !== 0) {
                            crossedWarning = true;
                            break;
                        }
                    }
                    
                    if (crossedWarning) {
                        this.triggerGameOver();
                    } else {
                        // Re-spawn new block
                        this.state = 'PLAYING';
                        this.spawnBlock();
                    }
                }
            }
        }
        else if (this.state === 'CLEARING') {
            this.clearingTimer--;
            
            if (this.clearingTimer <= 0) {
                // Remove cleared sand
                this.physics.clearCells(this.clearingCells);
                
                // Spawn explosion particles
                this.clearingCells.forEach(cell => {
                    const colorHex = COLOR_PALETTE[cell.color]?.hex || '#ffd166';
                    for (let i = 0; i < 2; i++) {
                        this.particles.push(new Particle(
                            cell.x,
                            cell.y,
                            colorHex,
                            (Math.random() - 0.5) * 4,
                            (Math.random() - 1.0) * 3,
                            25 + Math.floor(Math.random() * 20)
                        ));
                    }
                });

                audio.playClear();
                
                // Add Score & Diamonds
                // Base: 15 points per cell cleared
                const pts = this.clearingCells.length * 15;
                this.addPoints(pts);
                
                // Re-settle the remaining sand above
                this.state = 'SETTLING';
                this.clearingCells = [];
            }
        }
    }

    render() {
        // Clear Canvas
        this.ctx.fillStyle = '#07050e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw warning area overlay background (above warning row)
        this.ctx.fillStyle = 'rgba(255, 0, 84, 0.03)';
        this.ctx.fillRect(0, 0, this.canvas.width, WARNING_ROW * this.cellH);

        // Draw Sand Grid with deterministic noise shading
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const colorKey = this.physics.grid[y][x];
                if (colorKey !== 0) {
                    const pal = COLOR_PALETTE[colorKey];
                    if (pal) {
                        // Apply deterministic grain shading based on coords
                        const hueMod = ((x * 17 + y * 23) % 9) - 4; // -4 to +4
                        const lightMod = ((x * 37 + y * 43) % 13) - 6; // -6 to +6
                        
                        this.ctx.fillStyle = `hsl(${pal.h + hueMod}, ${pal.s}%, ${pal.l + lightMod}%)`;
                        this.ctx.fillRect(x * this.cellW, y * this.cellH, this.cellW, this.cellH);
                    }
                }
            }
        }

        // Draw Active Block (Neon glow + solid color)
        if (this.state === 'PLAYING' && this.activeBlock) {
            const pal = COLOR_PALETTE[this.activeBlock.color];
            
            this.ctx.save();
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = pal.hex;
            
            this.activeBlock.shape.forEach(offset => {
                const gx = this.activeBlock.bx + offset.x;
                const gy = this.activeBlock.by + offset.y;
                
                if (gy >= 0) {
                    // Draw filled block
                    this.ctx.fillStyle = pal.hex;
                    this.ctx.fillRect(gx * this.cellW, gy * this.cellH, this.cellW, this.cellH);
                    
                    // Draw clean outline overlay
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(gx * this.cellW + 0.5, gy * this.cellH + 0.5, this.cellW - 1, this.cellH - 1);
                }
            });
            this.ctx.restore();
        }

        // Draw Flashing Effect for Line Clears
        if (this.state === 'CLEARING' && this.clearingTimer % 4 < 2) {
            this.ctx.fillStyle = '#ffffff';
            this.clearingCells.forEach(cell => {
                this.ctx.fillRect(cell.x * this.cellW, cell.y * this.cellH, this.cellW, this.cellH);
            });
        }

        // Draw Active Particles
        this.particles.forEach(p => p.draw(this.ctx, this.cellW, this.cellH));
    }

    drawPreviews() {
        // Draw Next Preview Canvases
        this.drawSinglePreview(this.previewCtx1, this.previewCanvas1, this.nextQueue[0]);
        this.drawSinglePreview(this.previewCtx2, this.previewCanvas2, this.nextQueue[1]);
    }

    drawSinglePreview(ctx, canvas, block) {
        ctx.fillStyle = '#07050e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!block) return;

        const pal = COLOR_PALETTE[block.color];
        
        // Find bounding box to center block in canvas
        let minX = 99, maxX = -99, minY = 99, maxY = -99;
        block.shape.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const spanX = maxX - minX + 1;
        const spanY = maxY - minY + 1;
        
        const size = 9; // Size of preview blocks
        const offsetX = (canvas.width - spanX * size) / 2 - minX * size;
        const offsetY = (canvas.height - spanY * size) / 2 - minY * size;

        ctx.save();
        ctx.shadowBlur = 4;
        ctx.shadowColor = pal.hex;
        ctx.fillStyle = pal.hex;
        
        block.shape.forEach(pt => {
            ctx.fillRect(pt.x * size + offsetX, pt.y * size + offsetY, size - 1, size - 1);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.strokeRect(pt.x * size + offsetX, pt.y * size + offsetY, size - 1, size - 1);
        });
        
        ctx.restore();
    }

    setupEventListeners() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'PLAYING') {
                // Allow Space to start or restart on overlays
                if (e.code === 'Space') {
                    if (this.state === 'START' || this.state === 'GAMEOVER') {
                        this.startGame();
                        e.preventDefault();
                    }
                }
                return;
            }

            switch(e.code) {
                case 'ArrowLeft':
                case 'KeyA':
                    this.moveActiveBlock(-1, 0);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.moveActiveBlock(1, 0);
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                case 'KeyW':
                    this.rotateActiveBlock();
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.isFastDropping = true;
                    e.preventDefault();
                    break;
                case 'Space':
                    this.hardDrop();
                    e.preventDefault();
                    break;
                case 'Escape':
                case 'KeyP':
                    this.togglePause();
                    e.preventDefault();
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                this.isFastDropping = false;
            }
        });

        // UI Button Click Triggers
        document.getElementById('play-button').addEventListener('click', () => this.startGame());
        document.getElementById('resume-button').addEventListener('click', () => this.togglePause());
        document.getElementById('restart-button').addEventListener('click', () => this.startGame());
        document.getElementById('restart-from-pause').addEventListener('click', () => this.startGame());
        document.getElementById('pause-button').addEventListener('click', () => this.togglePause());
        
        // Powerups
        document.getElementById('powerup-swap').addEventListener('click', () => this.swapActiveBlock());
        document.getElementById('powerup-cyclone').addEventListener('click', () => {
            if (this.cycloneAimActive) {
                this.deactivateCycloneAim();
            } else {
                this.activateCycloneAim();
            }
        });

        // Add gift diamonds
        document.getElementById('btn-add-diamonds').addEventListener('click', () => {
            this.diamonds += 100;
            localStorage.setItem('sandtrix_diamonds', this.diamonds);
            audio.playPowerup();
            this.updateUI();
        });

        // Board Clicking for Cyclone
        this.canvas.addEventListener('click', (e) => {
            if (this.state === 'PLAYING' && this.cycloneAimActive) {
                this.triggerCyclone(e.clientX, e.clientY);
            }
        });

        // Mouse Move for Cyclone Aim overlay alignment
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state === 'PLAYING' && this.cycloneAimActive) {
                const rect = this.canvas.getBoundingClientRect();
                this.cycloneCursor.style.left = `${e.clientX - rect.left - 25}px`;
                this.cycloneCursor.style.top = `${e.clientY - rect.top - 25}px`;
            }
        });

        // Mobile Controls setup
        // Show/hide touch controls on click
        document.getElementById('btn-toggle-controls').addEventListener('click', () => {
            const panel = document.getElementById('mobile-controls');
            panel.classList.toggle('active');
        });

        // D-Pad Touch events
        document.getElementById('btn-left').addEventListener('pointerdown', () => this.moveActiveBlock(-1, 0));
        document.getElementById('btn-right').addEventListener('pointerdown', () => this.moveActiveBlock(1, 0));
        document.getElementById('btn-rotate').addEventListener('pointerdown', () => this.rotateActiveBlock());
        
        const softDropBtn = document.getElementById('btn-softdrop');
        softDropBtn.addEventListener('pointerdown', () => { this.isFastDropping = true; });
        softDropBtn.addEventListener('pointerup', () => { this.isFastDropping = false; });
        softDropBtn.addEventListener('pointerleave', () => { this.isFastDropping = false; });
        
        document.getElementById('btn-harddrop').addEventListener('pointerdown', () => this.hardDrop());

        // Check if user is on mobile to auto-enable mobile UI
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            document.getElementById('mobile-controls').classList.add('active');
        }
    }
}

// Global Game Launch
window.addEventListener('load', () => {
    window.game = new GameController();
});
