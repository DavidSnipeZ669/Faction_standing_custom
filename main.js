const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let logWatcher = null;
let lastFileSize = 0;
let watchDebounceTimer = null;

// Default EE.log path (Windows default location)
function getDefaultLogPath() {
    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'AppData', 'Local', 'Warframe', 'EE.log');
    }
    // Linux/Wine location (common for Proton/Wine users)
    return path.join(os.homedir(), '.local', 'share', 'Warframe', 'EE.log');
}

// Parse EE.log lines for syndicate standing changes
function parseLogLine(line) {
    // Pattern to match syndicate standing changes
    // Common patterns in EE.log for standing:
    // "Syndicate Standing: <Name> <+/-amount>"
    // "Script [Info]: SyndicateRepChange"
    
    const syndicateMap = {
        'SteelMeridian': 'steel',
        'Steel Meridian': 'steel',
        'ArbitersOfHexis': 'arbiters',
        'Arbiters of Hexis': 'arbiters',
        'CephalonSuda': 'suda',
        'Cephalon Suda': 'suda',
        'PerrinSequence': 'perrin',
        'Perrin Sequence': 'perrin',
        'ThePerrinSequence': 'perrin',
        'RedVeil': 'veil',
        'Red Veil': 'veil',
        'NewLoka': 'loka',
        'New Loka': 'loka'
    };

    // Match patterns like: "Syndicate Standing: Steel Meridian +500" or similar
    const standingPattern = /(?:Standing|Rep(?:utation)?)[:\s]+([A-Za-z\s]+?)\s*([+-]?\d+)/i;
    const syndicatePattern = /Syndicate.*?([A-Za-z\s]+?)\s*([+-]?\d+)/i;
    
    let match = line.match(standingPattern) || line.match(syndicatePattern);
    
    if (match) {
        const syndicateName = match[1].trim();
        const change = parseInt(match[2], 10);
        
        // Find the faction key from the syndicate name
        for (const [name, key] of Object.entries(syndicateMap)) {
            if (syndicateName.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(syndicateName.toLowerCase())) {
                return { faction: key, change };
            }
        }
    }
    
    return null;
}

// Read new lines from the log file
function readNewLogContent(logPath) {
    let fd = null;
    try {
        const stats = fs.statSync(logPath);
        const currentSize = stats.size;
        
        if (currentSize < lastFileSize) {
            // Log file was reset (new game session)
            lastFileSize = 0;
        }
        
        if (currentSize > lastFileSize) {
            fd = fs.openSync(logPath, 'r');
            const buffer = Buffer.alloc(currentSize - lastFileSize);
            fs.readSync(fd, buffer, 0, buffer.length, lastFileSize);
            
            lastFileSize = currentSize;
            return buffer.toString('utf-8');
        }
    } catch (err) {
        console.error('Error reading log file:', err.message);
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch (closeErr) {
                console.error('Error closing file:', closeErr.message);
            }
        }
    }
    return '';
}

// Start watching the log file
function startLogWatcher(logPath) {
    if (logWatcher) {
        logWatcher.close();
        logWatcher = null;
    }
    
    if (watchDebounceTimer) {
        clearTimeout(watchDebounceTimer);
        watchDebounceTimer = null;
    }
    
    if (!fs.existsSync(logPath)) {
        if (mainWindow) {
            mainWindow.webContents.send('tracking-status', { 
                active: false, 
                error: 'Log file not found: ' + logPath 
            });
        }
        return false;
    }
    
    // Initialize last file size
    try {
        lastFileSize = fs.statSync(logPath).size;
    } catch (err) {
        lastFileSize = 0;
    }
    
    // Watch for file changes with debouncing to handle multiple events
    logWatcher = fs.watch(logPath, (eventType) => {
        if (eventType === 'change') {
            // Debounce to prevent processing the same change multiple times
            if (watchDebounceTimer) {
                clearTimeout(watchDebounceTimer);
            }
            watchDebounceTimer = setTimeout(() => {
                const newContent = readNewLogContent(logPath);
                if (newContent) {
                    const lines = newContent.split('\n');
                    for (const line of lines) {
                        const result = parseLogLine(line);
                        if (result && mainWindow) {
                            mainWindow.webContents.send('standing-change', result);
                        }
                    }
                }
            }, 100); // 100ms debounce
        }
    });
    
    if (mainWindow) {
        mainWindow.webContents.send('tracking-status', { 
            active: true, 
            path: logPath 
        });
    }
    
    return true;
}

// Stop watching the log file
function stopLogWatcher() {
    if (watchDebounceTimer) {
        clearTimeout(watchDebounceTimer);
        watchDebounceTimer = null;
    }
    if (logWatcher) {
        logWatcher.close();
        logWatcher = null;
    }
    if (mainWindow) {
        mainWindow.webContents.send('tracking-status', { active: false });
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        backgroundColor: '#121212', // Dark background to prevent white flash
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true // cleaner look
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.on('closed', () => {
        mainWindow = null;
        stopLogWatcher();
    });
}

// IPC handlers
ipcMain.handle('start-tracking', async (event, customPath) => {
    const logPath = customPath || getDefaultLogPath();
    return startLogWatcher(logPath);
});

ipcMain.handle('stop-tracking', async () => {
    stopLogWatcher();
    return true;
});

ipcMain.handle('select-log-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Warframe EE.log file',
        defaultPath: getDefaultLogPath(),
        filters: [
            { name: 'Log Files', extensions: ['log'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('get-default-log-path', async () => {
    return getDefaultLogPath();
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
