/**
 * This is the file handling the startup and lifetime of the game
 * running in Electron Runtime.
 */
// Modules to control application life and create native browser window
const { app, BrowserWindow, shell, Menu } = require("electron");

// --- NEW: GPU OPTIMIZATION & AUTO-FIX LOGIC ---
const { execSync, spawn } = require('child_process');
const os = require('os');

// 1. LINUX: Relaunch with Environment Variables if not present
if (os.platform() === 'linux') {
    // Check for our custom flag to prevent infinite loops
    if (!process.env.GDEVELOP_GPU_OPTIMIZED) {
        console.log("Linux detected. Restarting with High Performance GPU flags...");

        // Define the High Performance flags for AMD (DRI_PRIME) and NVIDIA (NV_PRIME...)
        const newEnv = {
            ...process.env,
            GDEVELOP_GPU_OPTIMIZED: 'true',
            DRI_PRIME: '1',
            __NV_PRIME_RENDER_OFFLOAD: '1',
            __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
            __VK_LAYER_NV_optimus: 'NVIDIA_only'
        };

        // Relaunch the app with the new environment
        spawn(process.execPath, process.argv.slice(1), {
            env: newEnv,
            detached: true,
            stdio: 'ignore'
        }).unref();

        // Kill this low-performance instance immediately
        app.exit(0);
    }
}

// 2. WINDOWS: Check Registry & Auto-Restart if missing
if (os.platform() === 'win32') {
    const exePath = app.getPath('exe');
    const registryKey = 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences';
    const regValue = 'GpuPreference=2;'; // 2 = High Performance

    try {
        // Check if our specific EXE is already listed in the registry
        execSync(`reg query "${registryKey}" /v "${exePath}"`, { stdio: 'ignore' });
        // If successful, the key exists. We do nothing and let the game load.
        
    } catch (e) {
        // If "reg query" fails, the entry is missing. Let's add it.
        try {
            console.log("Applying High Performance GPU preference...");
            // Add the registry key forcing High Performance
            execSync(`reg add "${registryKey}" /v "${exePath}" /t REG_SZ /d "${regValue}" /f`);
            
            // Restart the app so Windows Scheduler picks up the new setting
            console.log("Optimization applied. Restarting...");
            app.relaunch();
            app.exit(0);
        } catch (err) {
            console.error("Failed to set GPU preference:", err);
            // We continue anyway so the game still plays, even if optimization failed
        }
    }
}
// --- END OF GPU OPTIMIZATION LOGIC ---

// Initialize `@electron/remote` module
require('@electron/remote/main').initialize();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800 /*GDJS_WINDOW_WIDTH*/,
    height: 600 /*GDJS_WINDOW_HEIGHT*/,
    useContentSize: true,
    title: "GDJS_GAME_NAME",
    backgroundColor: '#000000',
    webPreferences: {
      // Allow Node.js API access in renderer process, as long
      // as we've not removed dependency on it and on "@electron/remote".
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Enable `@electron/remote` module for renderer process
  require('@electron/remote/main').enable(mainWindow.webContents);

  // Open external link in the OS default browser
  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // and load the index.html of the app.
  mainWindow.loadFile("app/index.html");

  Menu.setApplicationMenu(null);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on("closed", function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  app.quit();
});
