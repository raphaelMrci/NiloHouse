export class LightTrackEditorUI {
    constructor({ manager }) {
        this.manager = manager;
        this._build();
    }
    _build() {
        this.root = document.createElement("div");
        this.root.className = "lte-overlay hidden";
        document.body.appendChild(this.root);
        this.root.innerHTML = `<div class='lte-window'><h2>Light Track Editor</h2><div class='lte-palette'></div><div class='lte-timeline'></div><div class='lte-actions'><input class='name' placeholder='Composite Name' style='flex:1;padding:4px 6px;border-radius:4px;border:none;background:#333;color:#fff;' /><button class='play'>Play</button><button class='save'>Save</button><button class='close'>Close</button></div></div>`;
        this.palette = this.root.querySelector(".lte-palette");
        this.timeline = this.root.querySelector(".lte-timeline");
        this.rows = new Map(); // trackIndex -> row element
        this.paletteColors = [
            "#2a6",
            "#e22",
            "#e2c800",
            "#00a8ff",
            "#ff7f50",
            "#8e44ad",
        ];
        // populate palette
        this.manager.tracks.forEach((t, idx) => {
            const btn = document.createElement("button");
            btn.textContent = t.name;
            btn.className = "pal-btn";
            btn.onclick = () => this._addSegment(idx);
            this.palette.appendChild(btn);
        });
        this.root.querySelector(".close").onclick = () => this.hide();
        this.root.querySelector(".save").onclick = () => this._saveComposite();
        this.root.querySelector(".play").onclick = () =>
            this._previewComposite();
        this.nameInput = this.root.querySelector(".name");
        this.segments = []; // {el,trackIndex,offset}
    }
    show() {
        this.root.classList.remove("hidden");
    }
    hide() {
        this.root.classList.add("hidden");
    }
    _addSegment(trackIndex) {
        const t = this.manager.tracks[trackIndex];
        if (!t) return;
        let row = this.rows.get(trackIndex);
        if (!row) {
            row = document.createElement("div");
            row.className = "lte-row";
            this.timeline.appendChild(row);
            this.rows.set(trackIndex, row);
        }
        const seg = document.createElement("div");
        seg.className = "seg";
        seg.textContent = t.name;
        seg.style.width = `${100 * t.length}px`;
        seg.style.left = "0px";
        seg.dataset.trackIndex = trackIndex;
        const color =
            this.paletteColors[trackIndex % this.paletteColors.length];
        seg.style.background = color;
        row.appendChild(seg);
        // simple drag
        let startX, orig;
        seg.onmousedown = (e) => {
            startX = e.clientX;
            orig = parseInt(seg.style.left);
            const move = (ev) => {
                const dx = ev.clientX - startX;
                seg.style.left = orig + dx + "px";
            };
            const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
        };
        this.segments.push(seg);

        // remove on double-click
        seg.ondblclick = () => this._removeSegment(seg);
    }

    _removeSegment(seg) {
        const row = seg.parentElement;
        row.removeChild(seg);
        this.segments = this.segments.filter((s) => s !== seg);
        if (!row.querySelector(".seg")) {
            // no more segments in row, remove row
            const idx = parseInt(seg.dataset.trackIndex);
            this.rows.delete(idx);
            row.remove();
        }
    }

    _saveComposite() {
        if (!this.segments.length) return;
        const segData = this.segments.map((seg) => ({
            trackIndex: parseInt(seg.dataset.trackIndex),
            start: 0,
            end: this.manager.tracks[parseInt(seg.dataset.trackIndex)].length,
            offset: parseInt(seg.style.left) / 100,
        }));
        const name = this.nameInput.value.trim() || "Composite";
        this.manager.composeFromSegments(segData, name);
        this.hide();
    }

    _previewComposite() {
        if (!this.segments.length) return;
        const segData = this.segments.map((seg) => ({
            trackIndex: parseInt(seg.dataset.trackIndex),
            start: 0,
            end: this.manager.tracks[parseInt(seg.dataset.trackIndex)].length,
            offset: parseInt(seg.style.left) / 100,
        }));
        const temp = this.manager.composeFromSegments(
            segData,
            "_preview",
            false
        );
        const idx = this.manager.tracks.indexOf(temp);
        if (idx !== -1) {
            this.manager.selectedTrackIndex = idx;
            this.manager.play();
            // remove temp after play finishes by listening
            setTimeout(() => {
                const index = this.manager.tracks.indexOf(temp);
                if (index !== -1) this.manager.deleteTrack(index);
            }, (temp.length + 1) * 1000);
        }
    }
}
// styles
if (!document.getElementById("lte-style")) {
    const s = document.createElement("style");
    s.id = "lte-style";
    s.textContent = `
    .lte-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:1300;display:flex;align-items:center;justify-content:center}
    .lte-overlay.hidden{display:none}
    .lte-window{background:#222;color:#fff;padding:16px;border-radius:8px;min-width:600px;max-width:90%;max-height:90%;display:flex;flex-direction:column;gap:8px}
    .lte-palette{display:flex;gap:6px;flex-wrap:wrap}
    .pal-btn{background:#444;border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer}
    .lte-timeline{position:relative;height:160px;background:#111;border:1px solid #555;overflow:auto;padding-top:10px}
    .lte-row{position:relative;height:32px;margin-bottom:8px}
    .seg{position:absolute;top:4px;height:24px;color:#fff;border-radius:4px;cursor:move;text-align:center;line-height:24px;user-select:none;padding:0 4px;font-size:12px}
    .lte-actions{display:flex;gap:8px;margin-top:8px;align-items:center}
    `;
    document.head.appendChild(s);
}
