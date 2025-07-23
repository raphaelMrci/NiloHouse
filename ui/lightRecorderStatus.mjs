export class LightRecorderStatusUI {
    constructor({ container = document.body, manager } = {}) {
        this.container = container;
        this.manager = manager;

        this.root = document.createElement("div");
        this.root.className = "lrs-panel";
        this.container.appendChild(this.root);

        // Build UI skeleton
        this._buildStructure();
        this._injectStyles();

        // selection set must exist before update()
        this._checked = new Set(); // remember checked indexes across re-renders

        // first render
        this.update(manager?.getStatus?.() ?? {});

        // Register click handlers if manager provided
        if (this.manager) this._wireEvents();
    }

    _buildStructure() {
        // Track list
        this.trackList = document.createElement("div");
        this.trackList.className = "lrs-tracks";
        this.root.appendChild(this.trackList);

        // Controls
        this.controlsBar = document.createElement("div");
        this.controlsBar.className = "lrs-controls";
        this.root.appendChild(this.controlsBar);

        const btn = (icon, title, id) => {
            const b = document.createElement("button");
            b.className = "lrs-btn";
            b.innerHTML = icon;
            b.title = title;
            b.dataset.action = id;
            this.controlsBar.appendChild(b);
            return b;
        };
        this.btnRecord = btn("⏺", "Record", "record");
        this.btnPlay = btn("▶️", "Play", "play");
        this.btnStop = btn("⏹", "Stop", "stop");
        this.btnPrev = btn("⏮", "Prev", "prev");
        this.btnNext = btn("⏭", "Next", "next");
        this.btnLoop = btn("🔁", "Loop", "loop");
        this.btnMerge = btn("🔀", "Merge Selected", "merge");
        this.btnDelete = btn("🗑", "Delete Selected", "delete");
        this.btnEditor = btn("🎞️", "Open Editor", "editor");

        // Timeline
        this.timeline = document.createElement("div");
        this.timeline.className = "lrs-timeline";
        this.root.appendChild(this.timeline);

        // Collapse toggle
        this.toggleBtn = document.createElement("button");
        this.toggleBtn.className = "lrs-toggle";
        this.toggleBtn.innerHTML = "▼";
        this.toggleBtn.title = "Hide panel";
        this.root.appendChild(this.toggleBtn);

        /* Compose modal */
        this.composeModal = document.createElement("div");
        this.composeModal.className = "lrs-compose hidden";
        this.composeModal.innerHTML = `<div class='compose-inner'><h3>Compose Tracks</h3><div class='compose-list'></div><button class='compose-create'>Create Composite</button><button class='compose-close'>Close</button></div>`;
        document.body.appendChild(this.composeModal);
    }

    _wireEvents() {
        this.controlsBar.addEventListener("click", (e) => {
            const action = e.target.closest("button")?.dataset?.action;
            if (!action) return;
            e.preventDefault();
            switch (action) {
                case "record":
                    this.manager.isRecording
                        ? this.manager.stopRecording()
                        : this.manager.startRecording();
                    break;
                case "play":
                    if (!this.manager.isPlaying) this.manager.play();
                    break;
                case "stop":
                    this.manager.stop();
                    break;
                case "prev":
                    this.manager.prev();
                    break;
                case "next":
                    this.manager.next();
                    break;
                case "loop":
                    this.manager.toggleLoop();
                    break;
                case "merge":
                    this._mergeSelected();
                    break;
                case "delete":
                    this._deleteSelected();
                    break;
                case "compose":
                    this._openCompose();
                    break;
                case "editor":
                    this._openTimelineEditor();
                    break;
            }
        });

        // track list selection
        this.trackList.addEventListener("change", (e) => {
            this._updateSelectedIndexes();
        });

        this.trackList.addEventListener("click", (e) => {
            const row = e.target.closest(".lrs-track-row");
            if (!row) return;
            const idx = parseInt(row.dataset.idx, 10);
            if (!isNaN(idx)) {
                this.manager.selectedTrackIndex = idx;
                this.manager._notify();
            }
        });

        this.toggleBtn.addEventListener("click", () => {
            const collapsed = this.root.classList.toggle("collapsed");
            this.toggleBtn.innerHTML = collapsed ? "▲" : "▼";
        });

        // compose modal events
        this.composeModal.querySelector(".compose-close").onclick = () =>
            this.composeModal.classList.add("hidden");
        this.composeModal.querySelector(".compose-create").onclick = () =>
            this._createCompositeFromModal();
    }

    _mergeSelected() {
        const indexes = this._selectedIndexes();
        if (indexes.length < 2) return;
        const base = this.manager.selectedTrackIndex;
        indexes.forEach((i) => {
            if (i !== base) this.manager.mergeSelectedWith(i);
        });
    }

    _deleteSelected() {
        let indexes = this._selectedIndexes();
        if (!indexes.length && this.manager.selectedTrackIndex >= 0) {
            // if none checked, delete currently selected
            indexes = [this.manager.selectedTrackIndex];
        }
        indexes
            .sort((a, b) => b - a) // delete high to low
            .forEach((i) => this.manager.deleteTrack(i));
    }

    _selectedIndexes() {
        return Array.from(
            this.trackList.querySelectorAll("input[type=checkbox]:checked")
        ).map((c) => parseInt(c.closest(".lrs-track-row").dataset.idx, 10));
    }

    _updateSelectedIndexes() {
        this._checked = new Set(this._selectedIndexes());
    }

    update(status) {
        // ensure checked set only keeps existing indexes
        this._checked.forEach((i) => {
            if (i >= status.trackCount) this._checked.delete(i);
        });
        // update buttons active state
        this.btnRecord.classList.toggle("active", status?.isRecording);
        this.btnPlay.classList.toggle("active", status?.isPlaying);
        this.btnLoop.classList.toggle("active", status?.isLooping);

        const tracksArr = this.manager?.tracks ?? [];
        // Rebuild track list
        this.trackList.innerHTML = "";
        const count = status?.trackCount ?? tracksArr.length;
        for (let i = 0; i < count; i++) {
            const row = document.createElement("div");
            row.className = "lrs-track-row";
            row.dataset.idx = i;
            if (i === status.selectedTrackIndex) row.classList.add("selected");

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "lrs-track-cb";
            cb.checked = this._checked.has(i);
            row.appendChild(cb);

            const label = document.createElement("span");
            label.textContent = tracksArr[i]?.name ?? `Track ${i + 1}`;
            row.appendChild(label);

            this.trackList.appendChild(row);
        }

        // Update timeline
        this._renderTimeline();
    }

    _renderTimeline() {
        const tracksArr = this.manager?.tracks ?? [];
        if (!tracksArr.length) {
            this.timeline.innerHTML = "";
            return;
        }
        const maxLen = Math.max(...tracksArr.map((t) => t.length), 1);
        this.timeline.innerHTML = "";
        tracksArr.forEach((t, idx) => {
            const row = document.createElement("div");
            row.className = "lrs-time-row";
            const bar = document.createElement("div");
            bar.className = "lrs-time-bar";
            bar.style.width = `${(t.length / maxLen) * 100}%`;
            if (idx === this.manager.selectedTrackIndex)
                bar.classList.add("selected");
            row.appendChild(bar);
            this.timeline.appendChild(row);
        });
    }

    _injectStyles() {
        if (document.getElementById("lrs-style")) return;
        const css = `
      .lrs-panel{position:fixed;left:20px;right:20px;bottom:110px;background:rgba(20,20,20,.9);backdrop-filter:blur(8px);padding:12px 16px;border-radius:10px;color:#fff;font-family:Arial,Helvetica,sans-serif;z-index:1100;box-shadow:0 4px 12px #0008;display:flex;flex-direction:column;gap:8px;max-height:45vh;overflow:hidden}
      .lrs-tracks{display:flex;flex-direction:column;gap:4px;overflow-y:auto;max-height:120px}
      .lrs-track-row{display:flex;align-items:center;gap:6px;padding:2px 6px;border-radius:4px;cursor:pointer;transition:background .2s}
      .lrs-track-row.selected{background:#444}
      .lrs-track-row:hover{background:#333}
      .lrs-track-cb{margin:0}
      .lrs-controls{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
      .lrs-btn{background:#333;border:none;color:#fff;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
      .lrs-btn:hover{background:#555}
      .lrs-btn.active{background:#e22}
      .lrs-timeline{display:flex;flex-direction:column;gap:3px;padding-top:4px;overflow-x:hidden;max-height:80px}
      .lrs-time-row{height:6px;background:#222;border-radius:3px;position:relative}
      .lrs-time-bar{height:100%;background:#888;border-radius:3px}
      .lrs-time-bar.selected{background:#2a6}
      .lrs-toggle{position:absolute;top:4px;right:4px;background:#222;border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:20px;padding:0}
      .lrs-panel.collapsed{height:auto;max-height:24px;overflow:hidden;padding-bottom:4px}
      .lrs-panel.collapsed .lrs-tracks,.lrs-panel.collapsed .lrs-controls,.lrs-panel.collapsed .lrs-timeline{display:none}
      .lrs-compose{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;color:#fff;padding:12px 16px;border-radius:8px;z-index:1201;box-shadow:0 4px 12px #000c}
      .lrs-compose.hidden{display:none}
      .compose-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin:8px 0}
      .compose-row{display:flex;align-items:center;gap:8px}
      .compose-inner button{margin-right:8px;padding:4px 8px;border:none;background:#444;color:#fff;border-radius:4px;cursor:pointer}
      @media (max-width:600px){.lrs-panel{left:5px;right:5px}}
      `;
        const style = document.createElement("style");
        style.id = "lrs-style";
        style.textContent = css;
        document.head.appendChild(style);
    }

    _openCompose() {
        // populate list
        const list = this.composeModal.querySelector(".compose-list");
        list.innerHTML = "";
        this.manager.tracks.forEach((t, idx) => {
            const row = document.createElement("div");
            row.className = "compose-row";
            row.innerHTML = `<label><input type='checkbox' data-idx='${idx}'/> ${t.name}</label> Offset: <input type='number' class='offset' value='0' step='0.1' style='width:4em'>s`;
            list.appendChild(row);
        });
        this.composeModal.classList.remove("hidden");
    }

    _createCompositeFromModal() {
        const rows = this.composeModal.querySelectorAll(".compose-row");
        const idxs = [];
        const offs = [];
        rows.forEach((r) => {
            const cb = r.querySelector("input[type=checkbox]");
            if (cb.checked) {
                idxs.push(parseInt(cb.dataset.idx, 10));
                offs.push(parseFloat(r.querySelector(".offset").value) || 0);
            }
        });
        if (idxs.length >= 1) {
            this.manager.composeTracks(idxs, offs);
            this.composeModal.classList.add("hidden");
        }
    }

    _openTimelineEditor() {
        import("./lightTrackEditor.mjs").then(({ LightTrackEditorUI }) => {
            if (!this._editor) {
                this._editor = new LightTrackEditorUI({
                    manager: this.manager,
                });
            }
            this._editor.show();
        });
    }
}
