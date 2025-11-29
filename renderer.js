const factionNames = {
    steel: 'Steel Meridian',
    arbiters: 'Arbiters of Hexis',
    suda: 'Cephalon Suda',
    perrin: 'Perrin Sequence',
    veil: 'Red Veil',
    loka: 'New Loka'
};

const factions = ['steel', 'arbiters', 'suda', 'perrin', 'veil', 'loka'];

// Get all inputs and listen for changes
const inputs = document.querySelectorAll('input[type="number"]');
inputs.forEach(input => input.addEventListener('input', solve));

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
        const input = document.getElementById(`val-${faction}`);
        const currentValue = parseFloat(input.value) || 0;
        input.value = currentValue + change;
        
        // Recalculate solver
        solve();
        
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
    const row = document.querySelector(`.faction-row[data-faction="${faction}"]`);
    if (row) {
        row.style.transition = 'background-color 0.3s ease';
        row.style.backgroundColor = 'rgba(212, 175, 55, 0.3)';
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 1000);
    }
}

function solve() {
    // 1. Get current values
    const steel = parseFloat(document.getElementById('val-steel').value) || 0;
    const arbiters = parseFloat(document.getElementById('val-arbiters').value) || 0;
    const suda = parseFloat(document.getElementById('val-suda').value) || 0;
    const perrin = parseFloat(document.getElementById('val-perrin').value) || 0;
    const veil = parseFloat(document.getElementById('val-veil').value) || 0;
    const loka = parseFloat(document.getElementById('val-loka').value) || 0;

    const CAP = 132000;
    
    // UI Elements
    const targetEl = document.getElementById('pledge-target');
    const amountEl = document.getElementById('farm-amount');
    const reasonEl = document.getElementById('reason-text');
    const iconEl = document.getElementById('mission-icon');
    const boxEl = document.getElementById('mission-box');

    // Reset Styles
    boxEl.className = 'mission-box';

    // --- THE LOGIC ENGINE ---

    // Priority 1: EMERGENCY REPAIR (Don't let Loka/Veil de-rank)
    // We assume a safety buffer of 5000 standing
    const SAFETY_BUFFER = 5000;

    if (loka < SAFETY_BUFFER && loka < CAP) {
        setMission("New Loka", "loka", "L", 
            `Farm until Loka is ${SAFETY_BUFFER}+`, 
            "CRITICAL: New Loka is dangerously low. Repair immediately.");
        return;
    }

    if (veil < SAFETY_BUFFER && veil < CAP) {
        setMission("Red Veil", "veil", "V", 
            `Farm until Veil is ${SAFETY_BUFFER}+`, 
            "CRITICAL: Red Veil is dangerously low. Repair immediately.");
        return;
    }

    // Priority 2: Fix Steel Meridian (It's the easiest fix via Red Veil)
    // If Steel is not maxed, and Veil is safe, pump Veil.
    // Why? Because Veil gives +50% to Steel without hurting Loka.
    if (steel < CAP && veil < CAP) {
        let spaceInSteel = CAP - steel;
        let spaceInVeil = CAP - veil;
        
        // We can only farm as much as Red Veil can hold
        let amount = Math.min(spaceInVeil, spaceInSteel * 2); 
        
        setMission("Red Veil", "veil", "V", 
            `Farm: ${formatNumber(amount)} Standing`, 
            "Goal: Raise Steel Meridian (Passive) & Red Veil.");
        return;
    }

    // Priority 3: The Hard Part (Suda & Hexis)
    // We need to raise Suda, but Suda hurts Loka (-100%) and Veil (-50%).
    if (suda < CAP || arbiters < CAP) {
        
        // How much 'Health' do our victims have?
        // Suda deals 1.0 damage to Loka, and 0.5 damage to Veil.
        
        let safeFarmLoka = loka - SAFETY_BUFFER; // How much we can lose from Loka
        let safeFarmVeil = (veil - SAFETY_BUFFER) * 2; // How much we can lose from Veil (Suda deals half dmg)
        
        // The maximum we can farm for Suda is limited by the weakest link
        let maxSafeFarm = Math.min(safeFarmLoka, safeFarmVeil);
        
        if (maxSafeFarm > 1000) {
            // We have room to grow!
            let amount = Math.min(maxSafeFarm, CAP - suda);
            setMission("Cephalon Suda", "suda", "S", 
                `Farm: ${formatNumber(amount)} Standing`, 
                "Goal: Raise Suda/Hexis. Stop before Loka/Veil crash.");
            return;
        } else {
            // We have NO room. We must rebuild the buffer.
            if (safeFarmLoka < safeFarmVeil) {
                // Loka is the bottleneck
                let amount = Math.min(CAP - loka, 20000); // Farm a chunk
                setMission("New Loka", "loka", "L", 
                    `Farm: ${formatNumber(amount)} Standing`, 
                    "Buffer Rebuild: Suda cannot be leveled until Loka is higher.");
                return;
            } else {
                // Veil is the bottleneck
                let amount = Math.min(CAP - veil, 20000);
                setMission("Red Veil", "veil", "V", 
                    `Farm: ${formatNumber(amount)} Standing`, 
                    "Buffer Rebuild: Suda cannot be leveled until Veil is higher.");
                return;
            }
        }
    }

    // If we are here... everything is Maxed?
    setMission("None", "steel", "★", "You are Maxed Out!", "Congratulations. All relevant factions are at cap.");

    // Helper functions
    function setMission(name, styleClass, icon, amountTxt, reason) {
        targetEl.innerText = "Pledge: " + name;
        targetEl.style.color = getFactionColor(styleClass);
        amountEl.innerText = amountTxt;
        reasonEl.innerText = reason;
        iconEl.innerText = icon;
        iconEl.style.borderColor = getFactionColor(styleClass);
        iconEl.style.color = getFactionColor(styleClass);
        boxEl.classList.add(`pledge-${styleClass}`);
    }

    function getFactionColor(c) {
        const colors = { 
            steel: '#d85134', veil: '#b30000', loka: '#7a9c68', 
            suda: '#0088ff', perrin: '#1a5e63', arbiters: '#a8a8a8' 
        };
        return colors[c] || '#fff';
    }

    function formatNumber(num) {
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}
