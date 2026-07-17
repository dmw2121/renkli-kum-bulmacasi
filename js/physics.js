class SandPhysics {
    constructor(gridWidth, gridHeight) {
        this.width = gridWidth;
        this.height = gridHeight;
        this.grid = [];
        this.leftToRightScan = true;
        this.initGrid();
    }

    initGrid() {
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(0); // 0 means empty
            }
            this.grid.push(row);
        }
    }

    // Single step of sand gravity update
    updateSand() {
        let moved = false;
        this.leftToRightScan = !this.leftToRightScan;

        // Scan from bottom to top (row height-2 down to 0)
        for (let y = this.height - 2; y >= 0; y--) {
            // Alternate x scanning direction to prevent sand piling up bias on one side
            if (this.leftToRightScan) {
                for (let x = 0; x < this.width; x++) {
                    if (this.updateCell(x, y)) {
                        moved = true;
                    }
                }
            } else {
                for (let x = this.width - 1; x >= 0; x--) {
                    if (this.updateCell(x, y)) {
                        moved = true;
                    }
                }
            }
        }
        return moved;
    }

    updateCell(x, y) {
        const color = this.grid[y][x];
        if (color === 0) return false;

        // 1. Directly below is empty
        if (this.grid[y + 1][x] === 0) {
            this.grid[y + 1][x] = color;
            this.grid[y][x] = 0;
            return true;
        }

        // 2. Check diagonals below
        const leftEmpty = (x > 0) && (this.grid[y + 1][x - 1] === 0);
        const rightEmpty = (x < this.width - 1) && (this.grid[y + 1][x + 1] === 0);

        if (leftEmpty && rightEmpty) {
            // Choose random direction
            const dir = Math.random() < 0.5 ? -1 : 1;
            this.grid[y + 1][x + dir] = color;
            this.grid[y][x] = 0;
            return true;
        } else if (leftEmpty) {
            this.grid[y + 1][x - 1] = color;
            this.grid[y][x] = 0;
            return true;
        } else if (rightEmpty) {
            this.grid[y + 1][x + 1] = color;
            this.grid[y][x] = 0;
            return true;
        }

        return false;
    }

    // Check for continuous path of the same color connecting left (x=0) to right (x=width-1)
    // Returns array of {x, y} coordinates to clear, or empty array if none
    checkConnections() {
        const visited = Array.from({ length: this.height }, () => Array(this.width).fill(false));
        const cellsToClear = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const color = this.grid[y][x];
                
                // If it is not empty, and not visited yet
                if (color !== 0 && !visited[y][x]) {
                    const component = [];
                    const queue = [{ x, y }];
                    visited[y][x] = true;
                    
                    let hasLeftConnection = false;
                    let hasRightConnection = false;

                    while (queue.length > 0) {
                        const current = queue.shift();
                        component.push({ x: current.x, y: current.y, color: color });

                        if (current.x === 0) hasLeftConnection = true;
                        if (current.x === this.width - 1) hasRightConnection = true;

                        // Check 8 neighbors (orthogonal + diagonal)
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                
                                const nx = current.x + dx;
                                const ny = current.y + dy;

                                // Boundary check
                                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                    // Same color, not visited
                                    if (this.grid[ny][nx] === color && !visited[ny][nx]) {
                                        visited[ny][nx] = true;
                                        queue.push({ x: nx, y: ny });
                                    }
                                }
                            }
                        }
                    }

                    // If this component touches both walls, mark it for clearing
                    if (hasLeftConnection && hasRightConnection) {
                        cellsToClear.push(...component);
                    }
                }
            }
        }

        return cellsToClear;
    }

    clearCells(cells) {
        cells.forEach(cell => {
            this.grid[cell.y][cell.x] = 0;
        });
    }

    // Cyclone power-up: clear all sand in a radius
    clearCircle(centerX, centerY, radius) {
        const cellsCleared = [];
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] !== 0) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist <= radius) {
                        cellsCleared.push({ x, y });
                        this.grid[y][x] = 0;
                    }
                }
            }
        }
        
        return cellsCleared;
    }
}
