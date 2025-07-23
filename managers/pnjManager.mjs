export class PNJManager {
    constructor(engine) {
        this.engine = engine;
        this.pnjs = new Map();
        this.pnjStates = new Map(); // name -> state object
    }

    registerPNJ(pnj, roomName) {
        this.pnjs.set(pnj.mesh.uuid, pnj);
        this.pnjStates.set(pnj.mesh.uuid, {
            name: pnj.mesh.uuid,
            currentRoom: roomName,
            visible: true,
        });
    }

    getNPC(name) {
        for (const p of this.pnjs.values()) if (p.name === name) return p;
        return null;
    }
}
