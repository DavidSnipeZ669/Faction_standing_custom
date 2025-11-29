# Faction_standing_custom
Same as the other Faction_Standing repo but for electron app

## Features

### Syndicate Standing Calculator
Plan your syndicate standing gains and see how they affect all factions based on Warframe's relationship matrix.

### 📡 Live Tracking (NEW)
Automatically track your syndicate standing changes in real-time by reading Warframe's EE.log file:

- **Automatic Detection**: Default EE.log path is auto-detected for Windows and Linux
- **Real-time Updates**: Standing changes appear instantly as you play
- **Event Log**: View recent standing changes with timestamps
- **Visual Feedback**: Rows flash when standing changes are detected

#### How to Use Live Tracking
1. Start Warframe
2. Click "Start Tracking" in the app
3. Play the game - standing changes will be automatically detected
4. (Optional) Click "Browse..." to select a custom EE.log location

#### Default Log Locations
- **Windows**: `%LOCALAPPDATA%\Warframe\EE.log`
- **Linux (Wine/Proton)**: `~/.local/share/Warframe/EE.log`

## Installation

```bash
npm install
npm start
```

## Requirements
- Node.js
- Electron