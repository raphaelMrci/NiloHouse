export class RemoteControllerUI {
    constructor({ container = document.body, buttons = [] } = {}) {
        this.container = container;
        this.buttons = [];
        this.buttonElements = new Map();
        this.root = document.createElement("div");
        this.root.className = "remote-controller-ui";
        this.container.appendChild(this.root);
        this.setButtons(buttons);
        this._injectStyles();
        this._blinkInterval = setInterval(() => this._updateBlinking(), 500);
    }

    setButtons(buttons) {
        this.buttons = buttons;
        this.root.innerHTML = "";
        this.buttonElements.clear();
        buttons.forEach((btn, idx) => {
            const el = document.createElement("button");
            el.className = "remote-btn";
            el.textContent = btn.label || btn.name || `Button ${idx + 1}`;
            el.disabled = btn.enabled === false;
            el.style.background = btn.color || "#444";
            el.style.opacity = btn.enabled === false ? 0.5 : 1;
            if (btn.blinking) el.classList.add("blinking");
            el.onclick = btn.onClick || (() => {});
            this.root.appendChild(el);
            this.buttonElements.set(btn.name, el);
        });
    }

    updateButton(name, cfg) {
        const idx = this.buttons.findIndex((b) => b.name === name);
        if (idx === -1) return;
        this.buttons[idx] = { ...this.buttons[idx], ...cfg };
        const el = this.buttonElements.get(name);
        if (!el) return;
        if (cfg.label !== undefined) el.textContent = cfg.label;
        if (cfg.color !== undefined) el.style.background = cfg.color;
        if (cfg.enabled !== undefined) {
            el.disabled = !cfg.enabled;
            el.style.opacity = cfg.enabled ? 1 : 0.5;
        }
        if (cfg.blinking !== undefined) {
            cfg.blinking
                ? el.classList.add("blinking")
                : el.classList.remove("blinking");
        }
        if (cfg.onClick !== undefined) el.onclick = cfg.onClick;
    }

    _updateBlinking() {
        this.buttons.forEach((btn) => {
            const el = this.buttonElements.get(btn.name);
            if (!el) return;
            if (btn.blinking) {
                el.style.visibility =
                    el.style.visibility === "hidden" ? "visible" : "hidden";
            } else {
                el.style.visibility = "visible";
            }
        });
    }

    _injectStyles() {
        if (document.getElementById("remote-controller-ui-style")) return;
        const style = document.createElement("style");
        style.id = "remote-controller-ui-style";
        style.textContent = `
      .remote-controller-ui{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:1.2rem;padding:1.2rem 0;background:rgba(30,30,30,.85);z-index:1000}
      .remote-btn{min-width:90px;min-height:48px;border:none;border-radius:1.5em;font-size:1.1em;font-weight:bold;color:#fff;background:#444;box-shadow:0 2px 8px #0006;cursor:pointer;transition:background .2s,opacity .2s;outline:none}
      .remote-btn.blinking{animation:remote-blink 1s steps(1) infinite}
      @keyframes remote-blink{0%,50%{filter:brightness(1.2)}51%,100%{filter:brightness(.5)}}
      .remote-btn:disabled{cursor:not-allowed}`;
        document.head.appendChild(style);
    }

    destroy() {
        clearInterval(this._blinkInterval);
        this.root.remove();
    }
}
