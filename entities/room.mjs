import * as THREE from "../js/lib/three.module.min.js";

export class Room {
    constructor(name, pos, size, color = 0x888888) {
        this.name = name;
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshStandardMaterial({
                color,
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
            })
        );
        this.mesh.position.copy(pos);
        this.lights = [];
    }
    addLight(light) {
        this.lights.push(light);
        this.mesh.add(light.mesh);
    }
    addPNJ(pnj) {
        this.mesh.add(pnj.mesh);
    }
}
