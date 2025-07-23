import * as THREE from "../js/lib/three.module.min.js";

function createGlowTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.2, "rgba(255,255,255,0.7)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

export class Light {
    constructor(name, color, intensity, distance, position) {
        this.name = name;
        // Apply a global brightness multiplier
        const realIntensity = (intensity ?? 1) * 3;
        this.light = new THREE.PointLight(color, realIntensity, distance);
        this.light.position.copy(position);
        this.mesh = this.light;

        // small colored sphere gizmo
        const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12);
        this.gizmoMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: this._opacityFromIntensity(realIntensity),
        });
        const sphere = new THREE.Mesh(sphereGeo, this.gizmoMat);
        sphere.renderOrder = 999; // render on top of transparent room walls
        this.gizmoMat.depthWrite = false;
        this.light.add(sphere);

        // glow sprite
        const spriteMat = new THREE.SpriteMaterial({
            map: createGlowTexture(),
            color,
            transparent: true,
            opacity: this._glowOpacity(realIntensity),
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.renderOrder = 998;
        spriteMat.depthWrite = false;
        sprite.scale.set(0.6, 0.6, 1);
        this.light.add(sprite);

        this._spriteMat = spriteMat;
    }

    updateGizmo() {
        this.gizmoMat.color.copy(this.light.color);
        this._spriteMat.color.copy(this.light.color);
        const op = this._opacityFromIntensity(this.light.intensity);
        this.gizmoMat.opacity = op;
        this._spriteMat.opacity = this._glowOpacity(this.light.intensity);
        this.gizmoMat.needsUpdate = true;
        this._spriteMat.needsUpdate = true;
    }

    _opacityFromIntensity(i) {
        // sphere fully opaque by intensity 3 (after multiplier)
        return Math.max(0.15, Math.min(1, i / 3));
    }
    _glowOpacity(i) {
        // allow up to full opacity at intensity 3
        return Math.max(0.08, Math.min(1, i / 3));
    }
}
