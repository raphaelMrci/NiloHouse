import * as THREE from "../js/lib/three.module.min.js";
export class MIDIManager {
    constructor(engine) {
        this.engine = engine;
        this.currentProfile = 0;
        this.buttonStates = new Map();
        this.lastValues = new Map();
        this.lastCC = null;
        this.lastNote = null;
        this.lightMappings = [
            [
                "andrei_1",
                "salon_2",
                "salon_1",
                "mial_1",
                "mial_2",
                "toilettes_1",
                "naeva_1",
                "nilo_1",
                null,
            ],
            [
                "L9_6",
                "L9_9",
                "L9_2",
                "L9_4",
                "L9_1",
                "L9_5",
                "L9_3",
                "L9_8",
                "L9_7",
            ],
            [
                "stone_1",
                "stone_2",
                "stone_3",
                "stone_4",
                "stone_5",
                "stone_6",
                "stone_7",
                "stone_8",
                "stone_9",
            ],
            [
                "bassin_1",
                "bassin_2",
                "cascade_1",
                "cascade_2",
                null,
                null,
                null,
                null,
                null,
            ],
        ];
        this._recFrame = null;
        this.onUpdate = null; // callback for UI
        this.init();
    }

    /* Notify UI */
    _notify() {
        this.onUpdate &&
            this.onUpdate({
                profile: this.currentProfile,
                lastCC: this.lastCC,
                lastNote: this.lastNote,
            });
    }

    init() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess({ sysex: true }).then((m) => {
                console.log("MIDI ready");
                for (const i of m.inputs.values()) {
                    console.log("MIDI input:", i.name);
                    i.onmidimessage = (e) => this.handle(e.data);
                }
            });
        } else {
            console.warn("WebMIDI not supported");
        }
    }

    handle(data) {
        const [status, d1, d2] = data;
        // SysEx (profile)
        if (status === 0xf0 && data[data.length - 1] === 0xf7) {
            const profileVal = data[data.length - 2];
            console.log("SysEx profile set to", profileVal);
            this.currentProfile = profileVal;
            this._notify();
            return;
        }
        const type = status & 0xf0;
        if (type === 0xb0) {
            // CC
            this.lastCC = { cc: d1, val: d2 };
            console.log(`CC#${d1} val ${d2}`);
            this._notify();
            this._handleCCMessage(d1, d2);
        } else if (type === 0x90) {
            // Note on
            this.lastNote = { note: d1, vel: d2 };
            console.log(`Note ON ${d1} vel ${d2}`);
            this._notify();
        } else if (type === 0x80) {
            this.lastNote = { note: d1, vel: 0 };
            console.log(`Note OFF ${d1}`);
            this._notify();
        }
    }

    _handleCCMessage(cc, val) {
        switch (cc) {
            case 44:
                if (val === 127) this._toggleRec();
                break;
            case 45:
                if (val === 127) this.engine.lightRecorderManager.play();
                break;
            case 46:
                if (val === 127) this.engine.lightRecorderManager.stop();
                break;
            case 47:
                if (val === 127) this.engine.lightRecorderManager.prev();
                break;
            case 48:
                if (val === 127) this.engine.lightRecorderManager.next();
                break;
            case 49:
                if (val === 127) this.engine.lightRecorderManager.toggleLoop();
                break;
            default:
                this._handleLightCC(cc, val);
        }
    }

    _toggleRec() {
        const mgr = this.engine.lightRecorderManager;
        if (!mgr) return;
        if (mgr.isRecording) {
            mgr.stopRecording();
            if (this._recFrame) {
                cancelAnimationFrame(this._recFrame);
                this._recFrame = null;
            }
        } else {
            mgr.startRecording();
            const loop = () => {
                mgr.recordStep();
                this._recFrame = requestAnimationFrame(loop);
            };
            loop();
        }
    }

    _handleLightCC(cc, val) {
        if (cc >= 3 && cc <= 11) {
            const col = cc - 3;
            const ln = this.lightMappings[this.currentProfile]?.[col];
            if (ln) this.engine.lightManager.setLightIntensity(ln, val / 127);
        }
        if (cc >= 14 && cc <= 22) {
            const col = cc - 14;
            const ln = this.lightMappings[this.currentProfile]?.[col];
            if (ln) {
                const hue = (val / 127) * 360;
                const color = new THREE.Color(`hsl(${hue},100%,50%)`);
                this.engine.lightManager.setLightColor(ln, color);
            }
        }
        if (cc >= 23 && cc <= 31 && val === 127) {
            const col = cc - 23;
            const key = `${this.currentProfile}_${col}`;
            const cur = this.buttonStates.get(key) || false;
            const next = !cur;
            this.buttonStates.set(key, next);
            const ln = this.lightMappings[this.currentProfile]?.[col];
            if (ln) {
                this.engine.lightManager.setLightIntensity(ln, next ? 1 : 0);
            }
        }
    }
}
