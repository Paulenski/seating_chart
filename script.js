// Game Seating Chart Tool - Main JavaScript

// Global Variables
const GRID_SIZE = 30;

// Coordinate System Configuration (based on total grid coordinates)
// Total grid: x:545-575, y:624-654 (30x30 grid, each cell = 1 unit)
// Grid center is at x:560, y:639 (row 14.5, col 14.5)
const GAME_X_MIN = 545;
const GAME_Y_MIN = 624;
const CELL_SIZE = 1;

let players = []; // Store all players in memory
let placedItems = []; // Store all placed items (players and buildings)
let selectedPlayer = null; // Currently selected unassigned player
let selectedItem = null; // Currently placed item for drag
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Zoom and Display Settings
let currentZoom = 1.0;
let showCoordinates = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeGrid();
    setupEventListeners();
    updatePlayerStats();
});

// Initialize the grid system
function initializeGrid() {
    const grid = document.getElementById('gameGrid');
    grid.innerHTML = '';
    
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('mousedown', handleDragStart);
            grid.appendChild(cell);
        }
    }
    
    // Initialize alliance city
    updateAllianceCity();
}

// Setup all event listeners
function setupEventListeners() {
    // Add Player Button - Show modal
    document.getElementById('addPlayerBtn').addEventListener('click', showPlayerModal);

    // Add Building Button
    document.getElementById('addBuildingBtn').addEventListener('click', showBuildingModal);

    // Manual Add Player
    document.getElementById('manualAddPlayer').addEventListener('click', addManualPlayer);

    // Import from Google Sheet
    document.getElementById('importBtn').addEventListener('click', importFromGoogleSheet);

    // Clear All Button
    document.getElementById('clearAllBtn').addEventListener('click', clearAllItems);

    // Alliance City Size Change
    document.getElementById('allianceCitySize').addEventListener('change', updateAllianceCity);

    // Zoom Controls
    document.getElementById('zoomIn').addEventListener('click', function() {
        if (currentZoom < 2.0) {
            currentZoom += 0.1;
            updateZoom();
        }
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
        if (currentZoom > 0.5) {
            currentZoom -= 0.1;
            updateZoom();
        }
    });

    // Coordinate Toggle
    document.getElementById('showCoordinates').addEventListener('change', function() {
        showCoordinates = this.checked;
        updateCoordinateDisplay();
    });

    // Building Modal
    const buildingModal = document.getElementById('buildingModal');
    const buildingCloseBtn = buildingModal.querySelector('.close');
    
    buildingCloseBtn.addEventListener('click', function() {
        buildingModal.style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target === buildingModal) {
            buildingModal.style.display = 'none';
        }
    });

    // Building option selection
    const buildingOptions = document.querySelectorAll('.building-option');
    buildingOptions.forEach(option => {
        option.addEventListener('click', function() {
            const type = this.dataset.type;
            const size = this.dataset.size;
            const border = this.dataset.border || null;
            
            buildingModal.style.display = 'none';
            selectedPlayer = {
                type: 'building',
                buildingType: type,
                name: getBuildingName(type),
                size: size,
                borderSize: border
            };
            
            alert(`Selected: ${selectedPlayer.name} (${selectedPlayer.size}). Click on the grid to place it.`);
        });
    });

    // Player Modal
    const playerModal = document.getElementById('playerModal');
    const playerCloseBtn = playerModal.querySelector('.close');
    const deleteAllPlayersBtn = document.getElementById('deleteAllPlayersBtn');
    
    playerCloseBtn.addEventListener('click', function() {
        playerModal.style.display = 'none';
    });
    
    // Delete All Players button
    deleteAllPlayersBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete ALL players from the player list? This will also remove any placed players from the grid.')) {
            // Remove all players from array
            players = [];
            // Remove all placed players from grid
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    const item = findItemAt(row, col);
                    if (item && item.type === 'player') {
                        removeItem(item);
                    }
                }
            }
            // Refresh modal
            showPlayerModal();
            // Update stats
            updatePlayerStats();
            updatePlacedList();
        }
    });

    window.addEventListener('click', function(event) {
        if (event.target === playerModal) {
            playerModal.style.display = 'none';
        }
    });

    // Drag and drop events
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
}

function getBuildingName(type) {
    const names = {
        'alliance-city-lv3': 'Alliance City Lv3',
        'alliance-city-lv4': 'Alliance City Lv4',
        'rss-tile': 'RSS Tile',
        'warehouse': 'Warehouse',
        'dead-spot': 'Dead Spot'
    };
    return names[type] || 'Building';
}

// Handle cell click for placement
function handleCellClick(event) {
    if (isDragging) return;
    
    const cell = event.target;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    if (selectedPlayer) {
        placeItem(row, col);
    } else {
        // Show item info if clicking on placed item
        const item = findItemAt(row, col);
        if (item) {
            showItemInfo(item);
        }
    }
}

// Place an item on the grid
function placeItem(startRow, startCol) {
    const size = selectedPlayer.size.split('x').map(Number);
    const [width, height] = size;
    
    // Check if placement is valid
    if (!isValidPlacement(startRow, startCol, width, height)) {
        alert('Cannot place item here. Check boundaries and overlaps.');
        return;
    }
    
    // Check building placement limits
    if (selectedPlayer.type === 'building' && !selectedPlayer.isAllianceCity) {
        const buildingType = selectedPlayer.buildingType;
        
        // RSS Tile - Max 1
        if (buildingType === 'rss-tile') {
            const existingRSS = placedItems.find(item => item.buildingType === 'rss-tile');
            if (existingRSS) {
                alert('RSS Tile already placed. Maximum 1 allowed.');
                return;
            }
        }
        
        // Warehouse - Max 1
        if (buildingType === 'warehouse') {
            const existingWarehouse = placedItems.find(item => item.buildingType === 'warehouse');
            if (existingWarehouse) {
                alert('Warehouse already placed. Maximum 1 allowed.');
                return;
            }
        }
        
        // Dead Spot - Unlimited (no check needed)
    }
    
    // Create item object
    const item = {
        id: Date.now(),
        name: selectedPlayer.name,
        type: selectedPlayer.type || 'player',
        buildingType: selectedPlayer.buildingType || null,
        size: selectedPlayer.size,
        width: width,
        height: height,
        row: startRow,
        col: startCol,
        borderSize: selectedPlayer.borderSize || null,
        borderColor: selectedPlayer.type === 'building' && selectedPlayer.buildingType && selectedPlayer.buildingType.includes('alliance-city') ? 
                    (selectedPlayer.buildingType.includes('lv3') ? '#FF6D00' : '#E64A19') : null
    };
    
    // Place the item on grid
    placeItemOnGrid(item);
    
    // Add to placed items
    placedItems.push(item);
    
    // Remove from unassigned players if it's a player
    if (item.type === 'player') {
        const playerIndex = players.findIndex(p => p.name === item.name);
        if (playerIndex > -1) {
            players.splice(playerIndex, 1);
        }
    }
    
    // Update UI
    updateUnassignedList();
    updatePlacedList();
    updatePlayerStats();
    updateBuildingModalAvailability();
    
    // Clear selection
    selectedPlayer = null;
}

// Place item visually on the grid
function placeItemOnGrid(item) {
    const grid = document.getElementById('gameGrid');
    
    // Place the main item cells
    for (let r = item.row; r < item.row + item.height; r++) {
        for (let c = item.col; c < item.col + item.width; c++) {
            const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cell) {
                // Determine CSS class based on type
                let cssClass = '';
                if (item.type === 'player') {
                    cssClass = item.size === '2x2' ? 'player-2x2' : 'player-3x3';
                } else {
                    cssClass = item.buildingType;
                }
                
                cell.classList.add(cssClass);
                cell.dataset.itemId = item.id;
                
                // Remove individual cell borders for the item
                cell.style.border = 'none';
            }
        }
    }
    
    // Add perimeter borders to the item
    addItemPerimeterBorders(item);
    
    // Add name label and coordinate label to first cell
    const firstCell = grid.querySelector(`[data-row="${item.row}"][data-col="${item.col}"]`);
    if (firstCell) {
        addPlayerNameLabel(firstCell, item.name, item.width, item.height);
        if (showCoordinates) {
            addPlayerCoordinateLabel(firstCell, item.row, item.col, item.width, item.height);
        }
    }
}
    
    // Add alliance city border if applicable - only on outside edge (lines between squares)
    if (item.borderSize) {
        const borderSize = item.borderSize.split('x').map(Number);
        const borderOffset = Math.floor((borderSize[0] - item.width) / 2);
        
        const borderStartRow = Math.max(0, item.row - borderOffset);
        const borderStartCol = Math.max(0, item.col - borderOffset);
        const borderEndRow = Math.min(GRID_SIZE - 1, item.row + item.height + borderOffset - 1);
        const borderEndCol = Math.min(GRID_SIZE - 1, item.col + item.width + borderOffset - 1);
        
        const isLv4 = item.borderSize === '20x20';
        const prefix = isLv4 ? '-lv4' : '';
        
        // Add border lines only on the edges between squares
        for (let r = borderStartRow; r <= borderEndRow; r++) {
            for (let c = borderStartCol; c <= borderEndCol; c++) {
                // Check if this cell is on the perimeter
                const isTopEdge = r === borderStartRow;
                const isBottomEdge = r === borderEndRow;
                const isLeftEdge = c === borderStartCol;
                const isRightEdge = c === borderEndCol;
                
                // Only add border if it's on the edge of the border area
                if (isTopEdge || isBottomEdge || isLeftEdge || isRightEdge) {
                    const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (cell && !cell.dataset.itemId && !cell.dataset.borderFor) {
                        const baseClass = isLv4 ? 'alliance-city-border-lv4' : 'alliance-city-border-lv3';
                        cell.classList.add(baseClass);
                        
                        // Add specific edge classes for lines
                        if (isTopEdge) cell.classList.add(`border-top${prefix}`);
                        if (isBottomEdge) cell.classList.add(`border-bottom${prefix}`);
                        if (isLeftEdge) cell.classList.add(`border-left${prefix}`);
                        if (isRightEdge) cell.classList.add(`border-right${prefix}`);
                        
                        cell.dataset.borderFor = item.id;
                    }
                }
            }
        }
    }

// Check if placement is valid
function isValidPlacement(startRow, startCol, width, height) {
    // Check boundaries
    if (startRow + height > GRID_SIZE || startCol + width > GRID_SIZE) {
        return false;
    }
    
    // Check for overlaps
    const grid = document.getElementById('gameGrid');
    for (let r = startRow; r < startRow + height; r++) {
        for (let c = startCol; c < startCol + width; c++) {
            const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cell && cell.dataset.itemId) {
                return false;
            }
        }
    }
    
    return true;
}

// Find item at specific position
function findItemAt(row, col) {
    return placedItems.find(item => 
        row >= item.row && row < item.row + item.height &&
        col >= item.col && col < item.col + item.width
    );
}

// Show item information
function showItemInfo(item) {
    const infoPanel = document.getElementById('selectionInfo');
    infoPanel.innerHTML = `
        <p><span class="info-label">Name:</span> ${item.name}</p>
        <p><span class="info-label">Type:</span> ${item.type === 'player' ? 'Player' : 'Building'}</p>
        <p><span class="info-label">Size:</span> ${item.size}</p>
        <p><span class="info-label">Position:</span> Row ${item.row}, Col ${item.col}</p>
        ${item.borderSize ? `<p><span class="info-label">Border:</span> ${item.borderSize}</p>` : ''}
        <button class="clear-btn" onclick="removeItem(${item.id})">Remove Item</button>
    `;
}

// Remove item from grid
function removeItem(itemId) {
    const grid = document.getElementById('gameGrid');
    const itemIndex = placedItems.findIndex(item => item.id === itemId);
    
    if (itemIndex > -1) {
        const item = placedItems[itemIndex];
        
        // Don't allow removing alliance city via this function
        if (item.isAllianceCity) {
            return;
        }
        
        // Remove main item cells
        for (let r = item.row; r < item.row + item.height; r++) {
            for (let c = item.col; c < item.col + item.width; c++) {
                const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    // Remove all item-specific classes
                    cell.classList.remove('player-2x2', 'player-3x3', 'alliance-city-lv3', 
                                        'alliance-city-lv4', 'rss-tile', 'warehouse', 'dead-spot');
                    cell.classList.remove('item-border-top', 'item-border-bottom', 
                                        'item-border-left', 'item-border-right');
                    
                    // Restore default border
                    cell.style.border = '1px solid #689F38';
                    
                    delete cell.dataset.itemId;
                    
                    // Remove labels (only from first cell)
                    if (r === item.row && c === item.col) {
                        const nameLabel = cell.querySelector('.player-name-label');
                        if (nameLabel) nameLabel.remove();
                        const coordLabel = cell.querySelector('.player-coordinate-label');
                        if (coordLabel) coordLabel.remove();
                    }
                }
            }
        }
        
        // Remove alliance city border
        if (item.borderSize) {
            const borderSize = item.borderSize.split('x').map(Number);
            const borderOffset = Math.floor((borderSize[0] - item.width) / 2);
            
            const borderStartRow = Math.max(0, item.row - borderOffset);
            const borderStartCol = Math.max(0, item.col - borderOffset);
            const borderEndRow = Math.min(GRID_SIZE - 1, item.row + item.height + borderOffset - 1);
            const borderEndCol = Math.min(GRID_SIZE - 1, item.col + item.width + borderOffset - 1);
            
            for (let r = borderStartRow; r <= borderEndRow; r++) {
                for (let c = borderStartCol; c <= borderEndCol; c++) {
                    const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (cell && cell.dataset.borderFor == item.id) {
                        cell.classList.remove('alliance-city-border-lv3', 'alliance-city-border-lv4');
                        delete cell.dataset.borderFor;
                    }
                }
            }
        }
        
        // If it's a player, add back to unassigned list
        if (item.type === 'player') {
            players.push({
                name: item.name,
                size: item.size,
                assigned: false
            });
        }
        
        // Remove from placed items
        placedItems.splice(itemIndex, 1);
        
        // Update UI
        updateUnassignedList();
        updatePlacedList();
        updatePlayerStats();
        updateBuildingModalAvailability();
        
        // Clear selection info
        document.getElementById('selectionInfo').innerHTML = '<p class="empty-state">Click on an item to see details</p>';
    }
}

// Add player manually
function addManualPlayer() {
    const nameInput = document.getElementById('playerName');
    const sizeSelect = document.getElementById('keepSize');
    
    const name = nameInput.value.trim();
    const size = sizeSelect.value;
    
    if (!name) {
        alert('Please enter a player name.');
        return;
    }
    
    // Check if player already exists
    if (players.some(p => p.name === name)) {
        alert('Player already exists.');
        return;
    }
    
    // Add player
    players.push({
        name: name,
        size: size,
        assigned: false
    });
    
    // Clear input
    nameInput.value = '';
    
    // Update UI
    updateUnassignedList();
    updatePlayerStats();
    
    alert(`Player "${name}" added successfully!`);
}

// Import players from Google Sheet (simulated)
function importFromGoogleSheet() {
    const url = document.getElementById('googleSheetUrl').value.trim();
    
    if (!url) {
        alert('Please enter a Google Sheet URL.');
        return;
    }
    
    // Extract sheet ID from URL
    const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
        alert('Invalid Google Sheet URL. Please provide a valid Google Sheet URL.');
        return;
    }
    
    const sheetId = sheetIdMatch[1];
    
    // Build CSV export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    
    // Fetch CSV data
    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch Google Sheet. Make sure the sheet is publicly accessible or published to web.');
            }
            return response.text();
        })
        .then(csvText => {
            // Parse CSV
            const rows = csvText.split('\n');
            let importedCount = 0;
            
            // Skip header row (row 0) and process data rows
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue; // Skip empty rows
                
                // Split row by comma (basic CSV parsing)
                const columns = row.split(',');
                
                // Column A is index 0 - Player name
                // Column B is index 1 - Keep Size
                const playerName = columns[0] ? columns[0].trim().replace(/^"|"$/g, '') : '';
                const keepSize = columns[1] ? columns[1].trim().replace(/^"|"$/g, '') : '';
                
                // Only import if player name is not empty and not just whitespace
                if (playerName && playerName.length > 0 && playerName !== 'Player') {
                    // Determine size from column B, default to 2x2 if not specified
                    let size = '2x2';
                    if (keepSize.includes('3') || keepSize.toLowerCase().includes('3x3')) {
                        size = '3x3';
                    }
                    
                    // Check if player already exists
                    if (!players.some(p => p.name === playerName)) {
                        players.push({
                            name: playerName,
                            size: size,
                            assigned: false
                        });
                        importedCount++;
                    }
                }
            }
            
            // Update UI
            updateUnassignedList();
            updatePlayerStats();
            
            if (importedCount > 0) {
                alert(`Successfully imported ${importedCount} players!`);
            } else {
                alert('No players found to import. Make sure column A contains player names.');
            }
        })
        .catch(error => {
            console.error('Import error:', error);
            alert(`Error importing players: ${error.message}\n\nNote: Make sure your Google Sheet is published to web (File > Share > Publish to web) or publicly accessible.`);
        });
}

// Update unassigned player list (no longer needed with modal, but kept for stats)
function updateUnassignedList() {
    // This function is no longer needed for display purposes
    // The player modal now handles displaying unassigned players
}

// Update placed items list
function updatePlacedList() {
    const placedList = document.getElementById('placedList');
    
    if (placedItems.length === 0) {
        placedList.innerHTML = '<p class="empty-state">No items placed</p>';
    } else {
        placedList.innerHTML = '';
        placedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'placed-item';
            div.innerHTML = `
                <div>
                    <span class="item-name">${item.name}</span>
                    <span class="item-position">(${item.size}) R${item.row},C${item.col}</span>
                </div>
                <button class="item-remove" onclick="removeItem(${item.id})">X</button>
            `;
            placedList.appendChild(div);
        });
    }
}

// Update zoom level
function updateZoom() {
    const grid = document.getElementById('gameGrid');
    const zoomPercent = Math.round(currentZoom * 100);
    
    grid.style.transform = `rotateX(60deg) rotateZ(45deg) scale(${currentZoom})`;
    document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
}

// Convert grid coordinates to game coordinates
function gridToGameCoords(row, col, width, height) {
    // Bottom-left cell coordinates (used for display)
    const bottomRow = row + height - 1;
    const bottomCol = col;
    
    // Total grid: x:545-575, y:624-654 (30x30 grid, each cell = 1 unit)
    // Grid coordinates: row 0-29 (top to bottom), col 0-29 (left to right)
    // Bottom-left cell (row 29, col 0) should map to x:545, y:624
    // Top-right cell (row 0, col 29) should map to x:575, y:654
    
    // Map grid coordinates to game coordinates
    const gameX = GAME_X_MIN + bottomCol;
    const gameY = GAME_Y_MIN + (29 - bottomRow);
    
    return {
        x: gameX,
        y: gameY
    };
}

// Add player name label
function addPlayerNameLabel(cell, name, width, height) {
    // Add label that spans the entire item
    const label = document.createElement('div');
    label.className = 'player-name-label';
    
    // Add size class for auto-scaling
    label.classList.add(`size-${width}x${height}`);
    
    label.textContent = name;
    label.style.width = `${width * 25}px`;
    label.style.height = `${height * 25}px`;
    cell.appendChild(label);
}

// Add player coordinate label
function addPlayerCoordinateLabel(cell, row, col, width, height) {
    const coords = gridToGameCoords(row, col, width, height);
    const label = document.createElement('div');
    label.className = 'player-coordinate-label';
    label.textContent = `x:${coords.x} y:${coords.y}`;
    cell.appendChild(label);
}

// Add perimeter borders to item
function addItemPerimeterBorders(item) {
    const grid = document.getElementById('gameGrid');
    
    // Add border to top edge
    for (let c = item.col; c < item.col + item.width; c++) {
        const cell = grid.querySelector(`[data-row="${item.row}"][data-col="${c}"]`);
        if (cell) cell.classList.add('item-border-top');
    }
    
    // Add border to bottom edge
    const bottomRow = item.row + item.height - 1;
    for (let c = item.col; c < item.col + item.width; c++) {
        const cell = grid.querySelector(`[data-row="${bottomRow}"][data-col="${c}"]`);
        if (cell) cell.classList.add('item-border-bottom');
    }
    
    // Add border to left edge
    for (let r = item.row; r < item.row + item.height; r++) {
        const cell = grid.querySelector(`[data-row="${r}"][data-col="${item.col}"]`);
        if (cell) cell.classList.add('item-border-left');
    }
    
    // Add border to right edge
    const rightCol = item.col + item.width - 1;
    for (let r = item.row; r < item.row + item.height; r++) {
        const cell = grid.querySelector(`[data-row="${r}"][data-col="${rightCol}"]`);
        if (cell) cell.classList.add('item-border-right');
    }
}

// Update coordinate display for all items
function updateCoordinateDisplay() {
    const grid = document.getElementById('gameGrid');
    
    // Clear all coordinate labels
    document.querySelectorAll('.player-coordinate-label').forEach(label => {
        label.remove();
    });
    
    if (!showCoordinates) return;
    
    // Add coordinates to all placed items
    placedItems.forEach(item => {
        const cell = grid.querySelector(`[data-row="${item.row}"][data-col="${item.col}"][data-item-id="${item.id}"]`);
        if (cell && !cell.querySelector('.player-coordinate-label')) {
            addPlayerCoordinateLabel(cell, item.row, item.col, item.width, item.height);
        }
    });
}

// Update player statistics
function updatePlayerStats() {
    document.getElementById('playerCount').textContent = players.length + placedItems.filter(item => item.type === 'player').length;
    document.getElementById('unassignedCount').textContent = players.length;
}

// Clear all items from grid
function clearAllItems() {
    if (placedItems.length === 0) {
        alert('No items to clear.');
        return;
    }
    
    if (confirm('Are you sure you want to clear all placed items? This will move all players back to the unassigned list. Note: Alliance City will not be removed.')) {
        // Move all players back to unassigned list (except alliance city)
        placedItems.forEach(item => {
            if (item.type === 'player' && !item.isAllianceCity) {
                players.push({
                    name: item.name,
                    size: item.size,
                    assigned: false
                });
            }
        });
        
        // Clear grid (but keep alliance city)
        const grid = document.getElementById('gameGrid');
        const cells = grid.querySelectorAll('.grid-cell');
        cells.forEach(cell => {
            // Don't remove alliance city
            if (!cell.dataset.isAllianceCity) {
                cell.className = 'grid-cell';
                delete cell.dataset.itemId;
                delete cell.dataset.borderFor;
                
                // Remove labels
                const nameLabel = cell.querySelector('.player-name-label');
                if (nameLabel) nameLabel.remove();
                const coordLabel = cell.querySelector('.player-coordinate-label');
                if (coordLabel) coordLabel.remove();
            }
        });
        
        // Keep only alliance city in placed items
        placedItems = placedItems.filter(item => item.isAllianceCity);
        
        // Update UI
        updateUnassignedList();
        updatePlacedList();
        updatePlayerStats();
        
        // Clear selection info
        document.getElementById('selectionInfo').innerHTML = '<p class="empty-state">Click on an item to see details</p>';
    }
}

// Show building selection modal
function showBuildingModal() {
    document.getElementById('buildingModal').style.display = 'block';
    updateBuildingModalAvailability();
}

// Update building modal button availability based on placement limits
function updateBuildingModalAvailability() {
    const rssOption = document.querySelector('.building-option[data-type="rss-tile"]');
    const warehouseOption = document.querySelector('.building-option[data-type="warehouse"]');
    
    // Check RSS Tile placement
    if (rssOption) {
        const existingRSS = placedItems.find(item => item.buildingType === 'rss-tile');
        if (existingRSS) {
            rssOption.classList.add('disabled');
        } else {
            rssOption.classList.remove('disabled');
        }
    }
    
    // Check Warehouse placement
    if (warehouseOption) {
        const existingWarehouse = placedItems.find(item => item.buildingType === 'warehouse');
        if (existingWarehouse) {
            warehouseOption.classList.add('disabled');
        } else {
            warehouseOption.classList.remove('disabled');
        }
    }
}

// Update alliance city based on size selection
function updateAllianceCity() {
    const size = document.getElementById('allianceCitySize').value;
    const grid = document.getElementById('gameGrid');
    
    // Remove existing alliance city
    removeExistingAllianceCity();
    
    if (size === 'none') {
        return;
    }
    
    // Alliance city configuration based on level
    // Grid center is at row 14.5, col 14.5 (game coordinates x:560, y:639)
    let cityConfig;
    if (size === 'lv3') {
        cityConfig = {
            type: 'alliance-city-lv3',
            size: '2x2',
            width: 2,
            height: 2,
            borderSize: '16x16',
            borderOffset: 7,
            row: 14,  // Centers 2x2 at grid center (14.5, 14.5)
            col: 14
        };
    } else if (size === 'lv4') {
        cityConfig = {
            type: 'alliance-city-lv4',
            size: '4x4',
            width: 4,
            height: 4,
            borderSize: '20x20',
            borderOffset: 8,
            row: 13,  // Centers 4x4 at grid center (14.5, 14.5)
            col: 13
        };
    }
    
    if (!cityConfig) return;
    
    // Create alliance city item
    const allianceCity = {
        id: 'alliance-city',
        name: size === 'lv3' ? 'Alliance City Lv3' : 'Alliance City Lv4',
        type: 'building',
        buildingType: size === 'lv3' ? 'alliance-city-lv3' : 'alliance-city-lv4',
        size: cityConfig.size,
        width: cityConfig.width,
        height: cityConfig.height,
        row: cityConfig.row,
        col: cityConfig.col,
        borderSize: cityConfig.borderSize,
        isAllianceCity: true
    };
    
    placeAllianceCityOnGrid(allianceCity);
}

// Remove existing alliance city
function removeExistingAllianceCity() {
    const grid = document.getElementById('gameGrid');
    const allianceCityItem = placedItems.find(item => item.isAllianceCity);
    
    if (allianceCityItem) {
        // Remove main item cells
        for (let r = allianceCityItem.row; r < allianceCityItem.row + allianceCityItem.height; r++) {
            for (let c = allianceCityItem.col; c < allianceCityItem.col + allianceCityItem.width; c++) {
                const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.remove('alliance-city-lv3', 'alliance-city-lv4');
                    delete cell.dataset.itemId;
                    // Remove name label if present
                    const nameLabel = cell.querySelector('.player-name-label');
                    if (nameLabel) nameLabel.remove();
                    const coordLabel = cell.querySelector('.player-coordinate-label');
                    if (coordLabel) coordLabel.remove();
                }
            }
        }
        
        // Remove alliance city border
        if (allianceCityItem.borderSize) {
            const borderSize = allianceCityItem.borderSize.split('x').map(Number);
            const borderOffset = Math.floor((borderSize[0] - allianceCityItem.width) / 2);
            
            const borderStartRow = Math.max(0, allianceCityItem.row - borderOffset);
            const borderStartCol = Math.max(0, allianceCityItem.col - borderOffset);
            const borderEndRow = Math.min(GRID_SIZE - 1, allianceCityItem.row + allianceCityItem.height + borderOffset - 1);
            const borderEndCol = Math.min(GRID_SIZE - 1, allianceCityItem.col + allianceCityItem.width + borderOffset - 1);
            
            const isLv4 = allianceCityItem.borderSize === '20x20';
            const prefix = isLv4 ? '-lv4' : '';
            
            for (let r = borderStartRow; r <= borderEndRow; r++) {
                for (let c = borderStartCol; c <= borderEndCol; c++) {
                    const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (cell && cell.dataset.borderFor === 'alliance-city') {
                        cell.classList.remove('alliance-city-border-lv3', 'alliance-city-border-lv4',
                                            `border-top${prefix}`, `border-bottom${prefix}`, 
                                            `border-left${prefix}`, `border-right${prefix}`);
                        delete cell.dataset.borderFor;
                    }
                }
            }
        }
        
        // Remove from placed items
        const index = placedItems.findIndex(item => item.isAllianceCity);
        if (index > -1) {
            placedItems.splice(index, 1);
        }
    }
}

// Place alliance city on grid
function placeAllianceCityOnGrid(item) {
    const grid = document.getElementById('gameGrid');
    
    // Place the main item cells
    for (let r = item.row; r < item.row + item.height; r++) {
        for (let c = item.col; c < item.col + item.width; c++) {
            const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cell) {
                cell.classList.add(item.buildingType);
                cell.dataset.itemId = item.id;
                cell.dataset.isAllianceCity = 'true';
                
                // Remove individual cell borders
                cell.style.border = 'none';
            }
        }
    }
    
    // Add perimeter borders to alliance city
    addItemPerimeterBorders(item);
    
    // Add name label to first cell
    const firstCell = grid.querySelector(`[data-row="${item.row}"][data-col="${item.col}"]`);
    if (firstCell) {
        addPlayerNameLabel(firstCell, item.name, item.width, item.height);
        if (showCoordinates) {
            addPlayerCoordinateLabel(firstCell, item.row, item.col, item.width, item.height);
        }
    }
    
    // Add alliance city border if applicable
    if (item.borderSize) {
        const borderSize = item.borderSize.split('x').map(Number);
        const borderOffset = Math.floor((borderSize[0] - item.width) / 2);
        
        const borderStartRow = Math.max(0, item.row - borderOffset);
        const borderStartCol = Math.max(0, item.col - borderOffset);
        const borderEndRow = Math.min(GRID_SIZE - 1, item.row + item.height + borderOffset - 1);
        const borderEndCol = Math.min(GRID_SIZE - 1, item.col + item.width + borderOffset - 1);
        
        const isLv4 = item.borderSize === '20x20';
        const prefix = isLv4 ? '-lv4' : '';
        
        for (let r = borderStartRow; r <= borderEndRow; r++) {
            for (let c = borderStartCol; c <= borderEndCol; c++) {
                const isTopEdge = r === borderStartRow;
                const isBottomEdge = r === borderEndRow;
                const isLeftEdge = c === borderStartCol;
                const isRightEdge = c === borderEndCol;
                
                if (isTopEdge || isBottomEdge || isLeftEdge || isRightEdge) {
                    const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (cell && !cell.dataset.itemId && !cell.dataset.borderFor) {
                        const baseClass = isLv4 ? 'alliance-city-border-lv4' : 'alliance-city-border-lv3';
                        cell.classList.add(baseClass);
                        
                        if (isTopEdge) cell.classList.add(`border-top${prefix}`);
                        if (isBottomEdge) cell.classList.add(`border-bottom${prefix}`);
                        if (isLeftEdge) cell.classList.add(`border-left${prefix}`);
                        if (isRightEdge) cell.classList.add(`border-right${prefix}`);
                        
                        cell.dataset.borderFor = item.id;
                    }
                }
            }
        }
    }
    
    // Add to placed items
    placedItems.push(item);
}

// Show player selection modal
function showPlayerModal() {
    const modal = document.getElementById('playerModal');
    const optionsContainer = document.getElementById('playerOptions');
    const deleteAllBtn = document.getElementById('deleteAllPlayersBtn');
    
    // Sort players alphabetically
    players.sort((a, b) => a.name.localeCompare(b.name));
    
    optionsContainer.innerHTML = '';
    
    if (players.length === 0) {
        optionsContainer.innerHTML = '<p class="empty-state">No unassigned players available</p>';
        deleteAllBtn.style.display = 'none';
    } else {
        deleteAllBtn.style.display = 'block';
        
        players.forEach(player => {
            const option = document.createElement('div');
            option.className = 'player-option';
            option.innerHTML = `
                <button class="delete-player-btn" data-player-name="${player.name}">&times;</button>
                <div class="player-preview size-${player.size}">${player.size}</div>
                <span class="player-name">${player.name}</span>
                <span class="player-size">Keep Size: ${player.size}</span>
            `;
            
            // Click to select player for placement
            option.addEventListener('click', function(e) {
                // Don't select if delete button was clicked
                if (e.target.classList.contains('delete-player-btn')) return;
                
                modal.style.display = 'none';
                selectedPlayer = {
                    type: 'player',
                    name: player.name,
                    size: player.size
                };
                alert(`Selected: ${selectedPlayer.name} (${selectedPlayer.size}). Click on the grid to place them.`);
            });
            
            // Delete button event
            const deleteBtn = option.querySelector('.delete-player-btn');
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${player.name}" from the player list?`)) {
                    // Remove player from array
                    players = players.filter(p => p.name !== player.name);
                    // Remove from grid if placed
                    for (let row = 0; row < GRID_SIZE; row++) {
                        for (let col = 0; col < GRID_SIZE; col++) {
                            const item = findItemAt(row, col);
                            if (item && item.type === 'player' && item.name === player.name) {
                                removeItem(item);
                            }
                        }
                    }
                    // Refresh modal
                    showPlayerModal();
                    // Update stats
                    updatePlayerStats();
                    updatePlacedList();
                }
            });
            
            optionsContainer.appendChild(option);
        });
    }
    
    modal.style.display = 'block';
}

// Drag and drop functionality
function handleDragStart(event) {
    const cell = event.target;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    
    const item = findItemAt(row, col);
    if (item) {
        isDragging = true;
        selectedItem = item;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        
        // Show visual feedback
        showItemInfo(item);
        event.preventDefault();
    }
}

function handleDrag(event) {
    if (!isDragging || !selectedItem) return;
    
    // Clear previous drag preview
    clearDragPreview();
    
    // Get the cell under the mouse
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const cell = elements.find(el => el.classList.contains('grid-cell'));
    
    if (cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // Show drag preview
        showDragPreview(row, col, selectedItem);
    }
    
    event.preventDefault();
}

function handleDragEnd(event) {
    if (!isDragging || !selectedItem) return;
    
    // Clear drag preview
    clearDragPreview();
    
    // Don't allow dragging alliance city
    if (selectedItem.isAllianceCity) {
        isDragging = false;
        selectedItem = null;
        return;
    }
    
    // Get the cell under the mouse
    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const cell = elements.find(el => el.classList.contains('grid-cell'));
    
    if (cell) {
        const newRow = parseInt(cell.dataset.row);
        const newCol = parseInt(cell.dataset.col);
        
        // Check if this is a new position
        if (newRow !== selectedItem.row || newCol !== selectedItem.col) {
            // Remove item from old position
            const oldItem = {...selectedItem};
            removeItem(selectedItem.id);
            
            // Try to place at new position
            const tempItem = {
                ...selectedItem,
                row: newRow,
                col: newCol
            };
            
            if (isValidPlacement(newRow, newCol, tempItem.width, tempItem.height)) {
                // Place at new position
                placeItemOnGrid(tempItem);
                placedItems.push(tempItem);
                updatePlacedList();
            } else {
                // Restore at old position if placement failed
                placeItemOnGrid(oldItem);
                placedItems.push(oldItem);
                alert('Cannot place item at this location.');
            }
        }
    }
    
    isDragging = false;
    selectedItem = null;
}

// Show drag preview on grid
function showDragPreview(startRow, startCol, item) {
    const grid = document.getElementById('gameGrid');
    const isValid = isValidPlacement(startRow, startCol, item.width, item.height);
    const previewClass = isValid ? 'drag-preview' : 'drag-preview-invalid';
    
    for (let r = startRow; r < startRow + item.height; r++) {
        for (let c = startCol; c < startCol + item.width; c++) {
            if (r < GRID_SIZE && c < GRID_SIZE) {
                const cell = grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add(previewClass);
                    cell.dataset.dragPreview = 'true';
                }
            }
        }
    }
}

// Clear drag preview
function clearDragPreview() {
    const grid = document.getElementById('gameGrid');
    const previewCells = grid.querySelectorAll('.drag-preview, .drag-preview-invalid');
    previewCells.forEach(cell => {
        cell.classList.remove('drag-preview', 'drag-preview-invalid');
        delete cell.dataset.dragPreview;
    });
}
