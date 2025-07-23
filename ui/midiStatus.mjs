export class MidiStatusUI {
    constructor({ container = document.body } = {}) {
        this.container = container;
        this.root = document.createElement("div");
        this.root.className = "midi-status-ui";
        this.container.appendChild(this.root);
        this._inject();
    }
    update({ profile, lastCC, lastNote }) {
        this.root.innerHTML = `Profile: <b>${profile}</b> | CC: ${
            lastCC ? `${lastCC.cc}:${lastCC.val}` : "-"
        } | Note: ${lastNote ? `${lastNote.note} ${lastNote.vel}` : "-"} `;
    }
    _inject() {
        if (document.getElementById("midi-status-style")) return;
        const s = document.createElement("style");
        s.id = "midi-status-style";
        s.textContent = `.midi-status-ui{position:fixed;top:5px;left:5px;color:#fff;background:rgba(0,0,0,.5);padding:4px 8px;font-family:monospace;font-size:12px;z-index:1200;border-radius:4px}`;
        document.head.appendChild(s);
    }
}
