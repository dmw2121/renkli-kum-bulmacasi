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

        // Choice Canvases
        this.choiceCanvases = [
            document.getElementById('choice-canvas-0'),
            document.getElementById('choice-canvas-1'),
            document.getElementById('choice-canvas-2')
        ];
        this.choiceContexts = this.choiceCanvases.map(canvas => canvas.getContext('2d'));
        
        // Game state variables
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('sandtrix_highscore')) || 0;
        this.level = 1;
        this.diamonds = parseInt(localStorage.getItem('sandtrix_diamonds')) || 150; // default 150 as a starter gift
        this.pointsForNextLevel = 1000;
        this.pointsAccumulatedThisLevel = 0;

        this.activeBlock = null;
        this.choiceBlocks = [null, null, null]; // 3 draggable blocks
        this.particles = [];
        
        // State Machine states: 'START', 'PLAYING', 'DROPPING', 'SETTLING', 'CLEARING', 'PAUSED', 'GAMEOVER'
        this.state = 'START';
        
        this.clearingCells = [];
        this.clearingTimer = 0;
        
        this.cycloneAimActive = false;

        // Drag and drop state variables
        this.dragActive = false;
        this.dragSlotIdx = -1;
        this.dragBlock = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragStartTime = 0;
        this.pointerPos = { x: 0, y: 0 };
        
        // Ghost placement calculation
        this.ghostBx = 0;
        this.ghostBy = 0;
        this.ghostLandingBy = 0;

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
        this.fillChoices();

        // Start animation loop
        this.loop();
    }

    getRandomBlock() {
        const types = Object.keys(TETROMINOES);
        const randomType = types[Math.floor(Math.random() * types.length)];
        const template = TETROMINOES[randomType];
        return {
            type: randomType,
            color: template.color,
            shape: template.shape.map(offset => ({ ...offset })),
            noRotate: template.noRotate || false
        };
    }

    fillChoices() {
        for (let i = 0; i < 3; i++) {
            if (this.choiceBlocks[i] === null) {
                this.choiceBlocks[i] = this.getRandomBlock();
            }
        }
        this.drawPreviews();
    }

    getHighResCells(bx, by, shape, scale = 4) {
        const cells = [];
        shape.forEach(offset => {
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    cells.push({
                        x: bx + offset.x * scale + dx,
                        y: by + offset.y * scale + dy
                    });
                }
            }
        });
        return cells;
    }

    isValidPosition(shape, bx, by) {
        const cells = this.getHighResCells(bx, by, shape);
        for (const cell of cells) {
            // Wall boundaries
            if (cell.x < 0 || cell.x >= GRID_WIDTH || cell.y >= GRID_HEIGHT) {
                return false;
            }
            
            // Allow pieces above top threshold (gy < 0 is fine, but check grid bounds)
            if (cell.y >= 0) {
                if (this.physics.grid[cell.y][cell.x] !== 0) {
                    return false; // collides with existing sand
                }
            }
        }
        return true;
    }

    lockActiveBlock() {
        if (!this.activeBlock) return;
        const cells = this.getHighResCells(this.activeBlock.bx, this.activeBlock.by, this.activeBlock.shape);
        
        // Disintegrate block into sand grains
        cells.forEach(cell => {
            if (cell.y >= 0 && cell.y < GRID_HEIGHT && cell.x >= 0 && cell.x < GRID_WIDTH) {
                this.physics.grid[cell.y][cell.x] = this.activeBlock.color;
            }
        });
        
        // Spawn small dust landing particles
        cells.forEach(cell => {
            if (cell.y >= 0 && cell.y < GRID_HEIGHT) {
                const colorHex = COLOR_PALETTE[this.activeBlock.color].hex;
                this.particles.push(new Particle(
                    cell.x + Math.random(),
                    cell.y + Math.random(),
                    colorHex,
                    (Math.random() - 0.5) * 1.5,
                    (Math.random() - 1.0) * 1.0,
                    20 + Math.floor(Math.random() * 15)
                ));
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

    // Swaps all 3 block choices for 50 diamonds
    swapActiveBlock() {
        if (this.state !== 'PLAYING') return;
        
        if (this.diamonds < 50) {
            alert("Yetersiz Elmas! Şekilleri yenilemek için 50 elmas gerekir.");
            return;
        }

        // Deduct diamonds
        this.diamonds -= 50;
        localStorage.setItem('sandtrix_diamonds', this.diamonds);
        audio.playPowerup();
        
        // Reroll all choices
        this.choiceBlocks = [this.getRandomBlock(), this.getRandomBlock(), this.getRandomBlock()];
        
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
        this.particles = [];
        this.physics.initGrid();
        this.choiceBlocks = [null, null, null];
        this.activeBlock = null;
        
        this.startScreen.classList.remove('active');
        this.pauseScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        
        this.state = 'PLAYING';
        this.updateUI();
        
        audio.init();
        audio.startMusic();
        
        this.fillChoices();
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
            // Idle waiting for drag and drop placement
        } 
        else if (this.state === 'DROPPING') {
            // Block falls rapidly after drop
            if (this.activeBlock) {
                this.activeBlock.by += 2;
                if (this.activeBlock.by >= this.activeBlock.targetBy) {
                    this.activeBlock.by = this.activeBlock.targetBy;
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
                        // Refill choice slots and wait for player's next move
                        this.fillChoices();
                        this.state = 'PLAYING';
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

        // Draw Active Block (Neon glow + granular layout) during rapid fall
        if (this.activeBlock) {
            const pal = COLOR_PALETTE[this.activeBlock.color];
            const cells = this.getHighResCells(this.activeBlock.bx, this.activeBlock.by, this.activeBlock.shape);
            
            this.ctx.save();
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = pal.hex;
            
            cells.forEach(cell => {
                if (cell.y >= 0) {
                    this.ctx.fillStyle = pal.hex;
                    this.ctx.fillRect(cell.x * this.cellW, cell.y * this.cellH, this.cellW, this.cellH);
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(cell.x * this.cellW + 0.5, cell.y * this.cellH + 0.5, this.cellW - 1, this.cellH - 1);
                }
            });
            this.ctx.restore();
        }

        // Draw Ghost Block & Dragging Block during drag-and-drop
        if (this.state === 'PLAYING' && this.dragActive && this.dragBlock) {
            const pal = COLOR_PALETTE[this.dragBlock.color];
            
            // 1. Draw Ghost Block Landing Spot (translucent)
            if (this.ghostLandingBy >= 0) {
                const ghostCells = this.getHighResCells(this.ghostBx, this.ghostLandingBy, this.dragBlock.shape);
                this.ctx.save();
                this.ctx.globalAlpha = 0.25;
                ghostCells.forEach(cell => {
                    if (cell.y >= 0) {
                        this.ctx.fillStyle = pal.hex;
                        this.ctx.fillRect(cell.x * this.cellW, cell.y * this.cellH, this.cellW, this.cellH);
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                        this.ctx.lineWidth = 1;
                        this.ctx.strokeRect(cell.x * this.cellW + 0.5, cell.y * this.cellH + 0.5, this.cellW - 1, this.cellH - 1);
                    }
                });
                this.ctx.restore();
            }
            
            // 2. Draw Dragged Block centered under finger/cursor
            const scale = 4;
            let minX = 99, maxX = -99, minY = 99, maxY = -99;
            this.dragBlock.shape.forEach(pt => {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
            });
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;

            this.ctx.save();
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = pal.hex;
            this.ctx.fillStyle = pal.hex;
            
            this.dragBlock.shape.forEach(pt => {
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        const px = this.pointerPos.x + (pt.x - cx) * scale * this.cellW + dx * this.cellW;
                        const py = this.pointerPos.y + (pt.y - cy) * scale * this.cellH + dy * this.cellH;
                        
                        this.ctx.fillRect(px, py, this.cellW, this.cellH);
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                        this.ctx.strokeRect(px + 0.5, py + 0.5, this.cellW - 1, this.cellH - 1);
                    }
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
        for (let i = 0; i < 3; i++) {
            this.drawSinglePreview(this.choiceContexts[i], this.choiceCanvases[i], this.choiceBlocks[i]);
        }
    }

    drawSinglePreview(ctx, canvas, block) {
        ctx.fillStyle = '#07050e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!block) return;

        const pal = COLOR_PALETTE[block.color];
        
        // Find bounding box to center block in canvas (standard units)
        let minX = 99, maxX = -99, minY = 99, maxY = -99;
        block.shape.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const spanX = maxX - minX + 1;
        const spanY = maxY - minY + 1;
        
        const scale = 4;
        const cellSize = 2.2; // Size of each small grain in preview
        const unitSize = scale * cellSize; // Width/height of one tetromino unit (e.g. 8.8px)
        
        const offsetX = (canvas.width - spanX * unitSize) / 2 - minX * unitSize;
        const offsetY = (canvas.height - spanY * unitSize) / 2 - minY * unitSize;

        ctx.save();
        ctx.fillStyle = pal.hex;
        
        block.shape.forEach(pt => {
            // Draw 4x4 sub-cells for this unit
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    const cx = pt.x * unitSize + dx * cellSize + offsetX;
                    const cy = pt.y * unitSize + dy * cellSize + offsetY;
                    
                    ctx.fillRect(cx, cy, cellSize - 0.4, cellSize - 0.4);
                }
            }
        });
        
        ctx.restore();
    }

    updatePointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointerPos.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.pointerPos.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    }

    setupEventListeners() {
        // Keyboard controls (only Space to start/restart, Escape/P to pause)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (this.state === 'START' || this.state === 'GAMEOVER') {
                    this.startGame();
                    e.preventDefault();
                }
            } else if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING' || this.state === 'PAUSED') {
                    this.togglePause();
                    e.preventDefault();
                }
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

        // Drag and Drop Dragging & Tap-to-Rotate Pointer events on choice slots
        for (let idx = 0; idx < 3; idx++) {
            const slot = document.getElementById(`choice-${idx}`);
            
            slot.addEventListener('pointerdown', (e) => {
                if (this.state !== 'PLAYING' || this.cycloneAimActive || !this.choiceBlocks[idx]) return;
                
                this.dragActive = true;
                this.dragSlotIdx = idx;
                this.dragBlock = this.choiceBlocks[idx];
                this.dragStartTime = Date.now();
                this.dragStartPos = { x: e.clientX, y: e.clientY };
                
                this.updatePointerPos(e);
                slot.setPointerCapture(e.pointerId);
                e.preventDefault();
            });

            slot.addEventListener('pointermove', (e) => {
                if (!this.dragActive || this.dragSlotIdx !== idx) return;
                
                this.updatePointerPos(e);
                
                // Bounding box of the standard block units
                let minX = 99, maxX = -99, minY = 99, maxY = -99;
                this.dragBlock.shape.forEach(pt => {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.y > maxY) maxY = pt.y;
                });
                
                // Convert screen coordinates to canvas coordinates
                const rect = this.canvas.getBoundingClientRect();
                const xLocal = (e.clientX - rect.left) * (this.canvas.width / rect.width);
                const yLocal = (e.clientY - rect.top) * (this.canvas.height / rect.height);
                
                const scale = 4;
                const gx = Math.floor(xLocal / this.cellW);
                const gy = Math.floor(yLocal / this.cellH);
                
                const cx = Math.floor((minX + maxX) / 2);
                const cy = Math.floor((minY + maxY) / 2);
                
                // Align block horizontal and vertical position centered on pointer
                this.ghostBx = gx - cx * scale;
                let proposedBy = gy - cy * scale;
                
                // Clamp bx so all units fall within GRID_WIDTH
                const minHighResX = minX * scale;
                const maxHighResX = maxX * scale + (scale - 1);
                if (this.ghostBx + minHighResX < 0) {
                    this.ghostBx = -minHighResX;
                }
                if (this.ghostBx + maxHighResX >= GRID_WIDTH) {
                    this.ghostBx = GRID_WIDTH - 1 - maxHighResX;
                }
                
                // Clamp proposedBy so all units stay within GRID_HEIGHT
                const minHighResY = minY * scale;
                const maxHighResY = maxY * scale + (scale - 1);
                if (proposedBy + minHighResY < 0) {
                    proposedBy = -minHighResY;
                }
                if (proposedBy + maxHighResY >= GRID_HEIGHT) {
                    proposedBy = GRID_HEIGHT - 1 - maxHighResY;
                }
                
                // If the proposed release position overlaps sand, slide upwards to find a valid spot
                let testBy = proposedBy;
                while (testBy >= -minHighResY && !this.isValidPosition(this.dragBlock.shape, this.ghostBx, testBy)) {
                    testBy--;
                }
                this.ghostBy = testBy;
                
                if (this.ghostBy >= -minHighResY) {
                    // Find landing spot by dropping down vertically starting from the release height
                    let by = this.ghostBy;
                    while (by < GRID_HEIGHT && this.isValidPosition(this.dragBlock.shape, this.ghostBx, by)) {
                        by++;
                    }
                    this.ghostLandingBy = by - 1;
                } else {
                    this.ghostLandingBy = -1;
                }
                
                e.preventDefault();
            });

            slot.addEventListener('pointerup', (e) => {
                if (!this.dragActive || this.dragSlotIdx !== idx) return;
                
                slot.releasePointerCapture(e.pointerId);
                
                // Check if dropped over canvas area
                const rect = this.canvas.getBoundingClientRect();
                const isOverCanvas = (
                    e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom + 50
                );
                
                if (isOverCanvas && this.ghostBy >= 0 && this.ghostLandingBy >= 0) {
                    // Drop successful: Fall starts from the release height (ghostBy)
                    this.activeBlock = {
                        shape: this.dragBlock.shape,
                        color: this.dragBlock.color,
                        bx: this.ghostBx,
                        by: this.ghostBy,
                        targetBy: this.ghostLandingBy
                    };
                    
                    this.choiceBlocks[idx] = null; // Clear slot
                    this.state = 'DROPPING';
                    audio.playMove();
                }
                
                // Reset dragging state
                this.dragActive = false;
                this.dragSlotIdx = -1;
                this.dragBlock = null;
                this.ghostBy = -1;
                this.ghostLandingBy = -1;
                
                e.preventDefault();
            });
        }
    }
}

// Global Game Launch
window.addEventListener('load', () => {
    window.game = new GameController();
});
