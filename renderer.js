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

const factions = ['steel', 'arbiters', 'suda', 'perrin', 'veil', 'loka'];

// Get all inputs
const inputs = document.querySelectorAll('input');

// Add listeners to all inputs
inputs.forEach(input => {
    input.addEventListener('input', calculate);
});

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
