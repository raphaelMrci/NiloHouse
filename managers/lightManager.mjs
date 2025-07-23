export class LightManager {
    constructor(engine) {
        this.engine = engine;
        this.lights = new Map();
    }
    registerLight(light) {
        this.lights.set(light.name, light);
    }
    setLightIntensity(name, intensity) {
        const l = this.lights.get(name);
        if (l) {
            l.light.intensity = intensity * 3;
            if (l.updateGizmo) l.updateGizmo();
        }
    }
    setLightColor(name, color) {
        const l = this.lights.get(name);
        if (l) {
            l.light.color.set(color);
            if (l.updateGizmo) l.updateGizmo();
        }
    }
}
