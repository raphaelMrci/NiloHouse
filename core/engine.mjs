import * as THREE from "../js/lib/three.module.min.js";
import { OrbitControls } from "../js/lib/OrbitControls.module.js";
import { Room } from "../entities/room.mjs";
import { Light } from "../entities/light.mjs";
import { PNJ } from "../entities/pnj.mjs";
import { LightManager } from "../managers/lightManager.mjs";
import { PNJManager } from "../managers/pnjManager.mjs";
import { RemoteControllerUI } from "../ui/remoteController.mjs";
import { LightRecorderManager } from "../managers/lightRecorderManager.mjs";
import { MIDIManager } from "../managers/midiManager.mjs";
import { LightRecorderStatusUI } from "../ui/lightRecorderStatus.mjs";
import { MidiStatusUI } from "../ui/midiStatus.mjs";

export class Engine {
    constructor() {
        // scene + renderer
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 2, 6);

        // Orbit controls
        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.enableDamping = true;

        this.lightManager = new LightManager(this);
        this.pnjManager = new PNJManager(this);

        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // after RemoteControllerUI instantiate, create recorder manager, midi manager and status UI in constructor
        this.lightRecorderManager = new LightRecorderManager(this);
        this.midiManager = new MIDIManager(this);
        this.lightRecorderStatusUI = new LightRecorderStatusUI({
            manager: this.lightRecorderManager,
        });
        this.lightRecorderStatusUI.update(
            this.lightRecorderManager.getStatus()
        );
        this.lightRecorderManager.onStatusChange = () => {
            this.lightRecorderStatusUI.update(
                this.lightRecorderManager.getStatus()
            );
        };
        this.midiStatusUI = new MidiStatusUI({});
        this.midiManager.onUpdate = (st) => this.midiStatusUI.update(st);
    }

    /* ---------- bootstrap ---------- */
    async start() {
        await this.loadFromJson(); // rooms / lights / pnjs
        this.animate();
    }

    /* ---------- load JSON ---------- */
    async loadFromJson() {
        const rooms = await fetch("./data/rooms.json").then((r) => r.json());
        const lights = await fetch("./data/lights.json").then((r) => r.json());
        const pnjs = await fetch("./data/pnjs.json").then((r) => r.json());

        /* rooms */
        this.rooms = new Map();
        rooms.forEach((r) => {
            const room = new Room(
                r.name,
                new THREE.Vector3(r.position.x, r.position.y, r.position.z),
                new THREE.Vector3(r.size.x, r.size.y, r.size.z)
            );
            this.rooms.set(r.name, room);
            this.scene.add(room.mesh);
        });

        /* lights */
        lights.forEach((l) => {
            const room = this.rooms.get(l.room);
            if (!room) return;
            // convert world position to local within room
            const localPos = new THREE.Vector3(
                l.position.x - room.mesh.position.x,
                l.position.y - room.mesh.position.y,
                l.position.z - room.mesh.position.z
            );
            const lightEnt = new Light(
                l.name,
                l.color,
                l.intensity,
                l.distance,
                localPos
            );
            room.addLight(lightEnt);
            this.lightManager.registerLight(lightEnt);
        });

        /* pnjs (just place coloured spheres for now) */
        pnjs.forEach((p) => {
            const room = this.rooms.get(p.room);
            if (!room) return;
            const localPos = new THREE.Vector3(
                p.position.x - room.mesh.position.x,
                p.position.y - room.mesh.position.y,
                p.position.z - room.mesh.position.z
            );
            const pnj = new PNJ(p.name, p.color, localPos);
            if (room) room.addPNJ(pnj);
            this.pnjManager.registerPNJ(pnj, p.room);
        });

        /* ambient light */
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        // After ambient light, instantiate remote controller once data loaded
        this.remote = new RemoteControllerUI({
            buttons: pnjs.map((pnj) => ({
                name: pnj.name,
                color: pnj.color,
                enabled: true,
                blinking: false,
                onClick: () => console.log(`Clicked ${pnj.name}`),
            })),
        });
    }

    /* ---------- render-loop ---------- */
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
