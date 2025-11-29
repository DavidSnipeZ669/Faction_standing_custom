// The Relationship Matrix
// Key = Faction Name, Value = How it affects others when YOU farm Key.
const relationships = {
    steel: { steel: 1.0, veil: 0.5, loka: -0.5, perrin: -1.0 },
    arbiters: { arbiters: 1.0, suda: 0.5, perrin: -0.5, veil: -1.0 },
    suda: { suda: 1.0, arbiters: 0.5, veil: -0.5, loka: -1.0 },
    perrin: { perrin: 1.0, loka: 0.5, arbiters: -0.5, steel: -1.0 },
    veil: { veil: 1.0, steel: 0.5, suda: -0.5, arbiters: -1.0 },
    loka: { loka: 1.0, perrin: 0.5, steel: -0.5, suda: -1.0 }
};

const factionNames = {
    steel: 'Steel Meridian',
    arbiters: 'Arbiters of Hexis',
    suda: 'Cephalon Suda',
    perrin: 'Perrin Sequence',
    veil: 'Red Veil',
    loka: 'New Loka'
};

const factions = ['steel', 'arbiters', 'suda', 'perrin', 'veil', 'loka'];

// Get all inputs
const inputs = document.querySelectorAll('input[type="number"]');

// Add listeners to all inputs
inputs.forEach(input => {
    input.addEventListener('input', calculate);
});

// IPC communication with main process
const { ipcRenderer } = require('electron');

// Tracking state
let isTracking = false;
let currentLogPath = '';

// UI Elements for tracking
const btnStartTracking = document.getElementById('btn-start-tracking');
const btnStopTracking = document.getElementById('btn-stop-tracking');
const btnBrowseLog = document.getElementById('btn-browse-log');
const logPathInput = document.getElementById('log-path');
const trackingIndicator = document.getElementById('tracking-indicator');
const trackingStatusText = document.getElementById('tracking-status-text');
const eventsSection = document.getElementById('events-section');
const eventsLog = document.getElementById('events-log');
const btnClearEvents = document.getElementById('btn-clear-events');

// Initialize with default log path
ipcRenderer.invoke('get-default-log-path').then(path => {
    logPathInput.value = path;
    currentLogPath = path;
});

// Event handlers for tracking controls
btnStartTracking.addEventListener('click', async () => {
    const path = currentLogPath || logPathInput.value;
    await ipcRenderer.invoke('start-tracking', path);
});

btnStopTracking.addEventListener('click', async () => {
    await ipcRenderer.invoke('stop-tracking');
});

btnBrowseLog.addEventListener('click', async () => {
    const path = await ipcRenderer.invoke('select-log-file');
    if (path) {
        logPathInput.value = path;
        currentLogPath = path;
    }
});

btnClearEvents.addEventListener('click', () => {
    eventsLog.innerHTML = '';
});

// Handle tracking status updates
ipcRenderer.on('tracking-status', (event, status) => {
    isTracking = status.active;
    
    if (status.active) {
        trackingIndicator.className = 'indicator active';
        trackingStatusText.textContent = 'Tracking active';
        trackingStatusText.style.color = '#4caf50';
        btnStartTracking.disabled = true;
        btnStopTracking.disabled = false;
        eventsSection.style.display = 'block';
    } else {
        trackingIndicator.className = 'indicator inactive';
        if (status.error) {
            trackingIndicator.className = 'indicator error';
            trackingStatusText.textContent = status.error;
            trackingStatusText.style.color = '#ff4444';
        } else {
            trackingStatusText.textContent = 'Not tracking';
            trackingStatusText.style.color = '#888';
        }
        btnStartTracking.disabled = false;
        btnStopTracking.disabled = true;
    }
});

// Handle standing change events from log parsing
ipcRenderer.on('standing-change', (event, data) => {
    const { faction, change } = data;
    
    if (factions.includes(faction)) {
        // Update the current balance for this faction
        const currInput = document.getElementById(`curr-${faction}`);
        const currentValue = parseFloat(currInput.value) || 0;
        currInput.value = currentValue + change;
        
        // Recalculate all projections
        calculate();
        
        // Add to events log
        addEventToLog(faction, change);
        
        // Highlight the row briefly
        highlightRow(faction);
    }
});

// Add event to the log display
function addEventToLog(faction, change) {
    const time = new Date().toLocaleTimeString();
    const factionName = factionNames[faction] || faction;
    const changeClass = change >= 0 ? 'positive' : 'negative';
    const changeText = change >= 0 ? `+${change}` : change;
    
    const eventItem = document.createElement('div');
    eventItem.className = 'event-item';
    eventItem.innerHTML = `
        <span class="event-time">${time}</span>
        <span class="event-faction">${factionName}</span>
        <span class="event-change ${changeClass}">${changeText}</span>
    `;
    
    // Add at the top
    eventsLog.insertBefore(eventItem, eventsLog.firstChild);
    
    // Limit to last 50 events
    while (eventsLog.children.length > 50) {
        eventsLog.removeChild(eventsLog.lastChild);
    }
}

// Highlight a row when it gets updated
function highlightRow(faction) {
    const row = document.querySelector(`tr[data-faction="${faction}"]`);
    if (row) {
        row.style.transition = 'background-color 0.3s ease';
        row.style.backgroundColor = 'rgba(212, 175, 55, 0.3)';
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 1000);
    }
}

function calculate() {
    // 1. Initialize Net Changes for all factions to 0
    let netChanges = {
        steel: 0, arbiters: 0, suda: 0, perrin: 0, veil: 0, loka: 0
    };

    // 2. Loop through every "Farm Input" to see what the user is planning
    factions.forEach(sourceFaction => {
        const farmAmount = parseFloat(document.getElementById(`farm-${sourceFaction}`).value) || 0;
        
        // If user is farming "sourceFaction", apply impacts to everyone else
        if (farmAmount !== 0) {
            const impacts = relationships[sourceFaction];
            
            // Apply impacts defined in matrix
            // Note: impacts object only contains affected parties. 
            // We iterate through the specific impacts defined in the matrix.
            for (const [targetFaction, multiplier] of Object.entries(impacts)) {
                netChanges[targetFaction] += (farmAmount * multiplier);
            }
        }
    });

    // 3. Update the UI
    factions.forEach(faction => {
        const currentBalance = parseFloat(document.getElementById(`curr-${faction}`).value) || 0;
        const netChange = netChanges[faction];
        const finalTotal = currentBalance + netChange;

        // Update Net Change Cell
        const netEl = document.getElementById(`net-${faction}`);
        netEl.textContent = (netChange > 0 ? "+" : "") + netChange;
        
        // Color code Net Change
        netEl.style.color = netChange > 0 ? "#90ff90" : (netChange < 0 ? "#ff8888" : "#888");

        // Update Final Total Cell
        const totalEl = document.getElementById(`total-${faction}`);
        totalEl.textContent = finalTotal;

        // Apply Conditional Formatting
        totalEl.className = "readonly"; // reset classes
        if (finalTotal < 0) {
            totalEl.classList.add('negative');
        } else if (finalTotal > 132000) {
            totalEl.classList.add('warning');
        } else {
            totalEl.classList.add('safe');
        }
    });
}
