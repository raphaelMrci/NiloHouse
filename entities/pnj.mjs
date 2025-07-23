import * as THREE from "../js/lib/three.module.min.js";
export class PNJ {
    constructor(name, color, position) {
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            new THREE.MeshStandardMaterial({ color })
        );
        this.mesh.position.copy(position);
    }
}
