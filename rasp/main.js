import ws281xInit from "rpi-ws281x-native";
import midi from "midi";

// Simple debug helper – disable by setting DEBUG=false in env
const DEBUG_ENABLED = process.env.DEBUG !== "false";
function debug(...args) {
    if (DEBUG_ENABLED) console.log("[DEBUG]", ...args);
}

// ====================== CONFIGURATION ======================
// Number of LEDs in your strip (can be overridden with LED_COUNT env var)
const LED_COUNT = parseInt(process.env.LED_COUNT, 10) || 18;
// GPIO pin where the LED strip is connected (must support PWM, e.g., 18)
const GPIO_PIN = parseInt(process.env.GPIO_PIN, 10) || 18;
// Brightness (0-255)
const DEFAULT_BRIGHTNESS = 255;
// ===========================================================

debug("Starting raspled script");
debug("Config:", { LED_COUNT, GPIO_PIN, DEFAULT_BRIGHTNESS });

// --- Helper utilities --------------------------------------
function rgbToInt(r, g, b) {
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    return rgbToInt(
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    );
}

// --- LED strip initialisation ------------------------------
// The package exports a function that returns a CHANNEL object when
// called: const channel = ws281x(numLeds, options)
// Using it is the most compatible way across package versions.

const channel = ws281xInit(LED_COUNT, {
    dma: 10,
    freq: 800000,
    gpio: GPIO_PIN,
    invert: false,
    brightness: DEFAULT_BRIGHTNESS,
    stripType: ws281xInit.stripType ? ws281xInit.stripType.WS2812 : "ws2812",
});

const pixelData = channel.array; // Uint32Array representing LED colors
pixelData.fill(0);
ws281xInit.render();

debug("LED driver initialised – array length", pixelData.length);

// --- MIDI input setup --------------------------------------
const input = new midi.Input();
const portCount = input.getPortCount();
if (portCount === 0) {
    console.error(
        "No MIDI input ports found. Connect your controller and restart."
    );
    process.exit(1);
}

console.log("Available MIDI input ports:");
for (let i = 0; i < portCount; i++) {
    console.log(`${i}: ${input.getPortName(i)}`);
}

// Open the first port by default or use MIDI_PORT env var
const MIDI_PORT = process.env.MIDI_PORT
    ? parseInt(process.env.MIDI_PORT, 10)
    : 0;
if (MIDI_PORT >= portCount) {
    console.error(`Requested MIDI port ${MIDI_PORT} does not exist.`);
    process.exit(1);
}

input.openPort(MIDI_PORT);
input.ignoreTypes(false, false, false);
console.log(
    `Listening to MIDI port ${MIDI_PORT} – ${input.getPortName(MIDI_PORT)}`
);
console.log(`Controlling ${LED_COUNT} LEDs on GPIO ${GPIO_PIN}`);

debug("Waiting for MIDI messages…");

// Keep per-LED state so brightness and hue can be set independently
const ledBrightness = Array(LED_COUNT).fill(0); // 0-1
const ledHue = Array(LED_COUNT).fill(0); // 0-1
const buttonStates = new Map();

function applyLed(index) {
    const b = Math.max(0, Math.min(1, ledBrightness[index]));
    const h = ((ledHue[index] % 1) + 1) % 1; // wrap 0-1
    pixelData[index] = hsvToRgb(h, 1, b);
    debug("applyLed", { index, hue: h.toFixed(3), brightness: b.toFixed(3) });
}

// --- MIDI message handler ----------------------------------
input.on("message", (deltaTime, message) => {
    const [status, data1, data2] = message;
    debug("MIDI message", { deltaTime, raw: message });
    const command = status & 0xf0;

    if (command === 0xb0) {
        // Control Change => faders/knobs/buttons
        handleCC(data1, data2);
        return;
    }

    switch (command) {
        case 0x90: // Note On (with velocity > 0)
            debug("Note ON", { note: data1, velocity: data2 });
            if (data2 !== 0) {
                turnOnLed(data1, data2);
            } else {
                turnOffLed(data1);
            }
            break;
        case 0x80: // Note Off
            debug("Note OFF", { note: data1 });
            turnOffLed(data1);
            break;
        default:
            break;
    }
});

function handleCC(cc, val) {
    debug("CC received", { cc, val });

    // --- Brightness faders (CC 3-11) ----------------------
    if (cc >= 3 && cc <= 11) {
        const idx = cc - 3;
        if (idx < LED_COUNT) {
            ledBrightness[idx] = val / 127;
            debug(`Brightness set LED ${idx} ->`, val / 127);
            applyLed(idx);
            ws281xInit.render();
            debug("Rendered strip");
        }
        return;
    }

    // --- Hue knobs (CC 14-22) -----------------------------
    if (cc >= 14 && cc <= 22) {
        const idx = cc - 14;
        if (idx < LED_COUNT) {
            ledHue[idx] = val / 127; // 0-1
            debug(`Hue set LED ${idx} ->`, val / 127);
            applyLed(idx);
            ws281xInit.render();
            debug("Rendered strip");
        }
        return;
    }

    // --- Toggle buttons (CC 23-31, value 127 on press) ----
    if (cc >= 23 && cc <= 31 && val === 127) {
        const idx = cc - 23;
        const key = `btn_${idx}`;
        const next = !buttonStates.get(key);
        buttonStates.set(key, next);
        if (idx < LED_COUNT) {
            ledBrightness[idx] = next ? 1 : 0;
            debug(`Toggle LED ${idx} ->`, next);
            applyLed(idx);
            ws281xInit.render();
            debug("Rendered strip");
        }
        return;
    }
}

function turnOnLed(noteNumber, velocity) {
    const ledIndex = noteNumber % LED_COUNT;
    const hue = (noteNumber % 12) / 12;
    ledHue[ledIndex] = hue;
    ledBrightness[ledIndex] = velocity / 127;
    applyLed(ledIndex);
    ws281xInit.render();
    debug("Rendered strip");
}

function turnOffLed(noteNumber) {
    const ledIndex = noteNumber % LED_COUNT;
    ledBrightness[ledIndex] = 0;
    applyLed(ledIndex);
    ws281xInit.render();
    debug("Rendered strip");
}

// --- Graceful shutdown -------------------------------------
function shutdown() {
    console.log("\nShutting down – clearing LEDs...");
    pixelData.fill(0);
    ws281xInit.render();
    debug("Rendered strip (shutdown)");
    ws281xInit.reset();
    input.closePort();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
