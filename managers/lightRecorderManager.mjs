import { LightTrack } from "./lightTrack.mjs";
export class LightRecorderManager {
    constructor(engine) {
        this.engine = engine;
        this.tracks = [];
        this.selectedTrackIndex = -1;
        this.isRecording = false;
        this.isPlaying = false;
        this.isLooping = false;
        this.recordStartTime = 0;
        this.playStartTime = 0;
        this.playbackTimer = null;
        this.recordedStates = [];

        // Load saved tracks asynchronously
        if (window.lightFS) {
            window.lightFS.loadTracks().then((arr) => {
                arr.forEach(({ name, data }) => {
                    const track = LightTrack.fromJSON(name, data);
                    this.tracks.push(track);
                });
                // ensure selected index valid
                this.selectedTrackIndex = this.tracks.length ? 0 : -1;
                this._notify();
            });
        }
    }
    get selectedTrack() {
        return this.selectedTrackIndex >= 0
            ? this.tracks[this.selectedTrackIndex]
            : null;
    }

    startRecording() {
        if (this.isRecording) return;
        this.isRecording = true;
        this.recordStartTime = performance.now();
        this.recordedStates = [];
        this._lastSnapshot = {}; // track last recorded state per light for delta detection
        this._notify();
    }
    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;
        const track = new LightTrack(`Track_${Date.now()}`);
        for (const { time, lights } of this.recordedStates)
            track.addState(time, lights);
        this.tracks.push(track);
        // Persist track to disk
        if (window.lightFS) {
            window.lightFS
                .saveTrack(track.name, track.toJSON())
                .catch(console.error);
        }
        this.selectedTrackIndex = this.tracks.length - 1;
        this.recordedStates = [];
        this._notify();
    }
    recordStep() {
        if (!this.isRecording) return;
        const t = (performance.now() - this.recordStartTime) / 1000;
        const delta = {};
        for (const [name, l] of this.engine.lightManager.lights.entries()) {
            const cur = {
                intensity: l.light.intensity,
                color: `#${l.light.color.getHexString()}`,
            };
            // If playback is active and this light's value equals playback snapshot, skip
            const playVal = this._playbackSnapshot?.[name];
            if (
                playVal &&
                playVal.intensity === cur.intensity &&
                playVal.color === cur.color
            ) {
                continue; // change came from playback
            }
            const prev = this._lastSnapshot[name];
            if (
                !prev ||
                prev.intensity !== cur.intensity ||
                prev.color !== cur.color
            ) {
                delta[name] = cur;
                this._lastSnapshot[name] = cur;
            }
        }
        if (Object.keys(delta).length) {
            this.recordedStates.push({ time: t, lights: delta });
        }
    }
    play() {
        if (!this.selectedTrack) return;
        this.isPlaying = true;
        this.playStartTime = performance.now();
        this._step();
        this._notify();
    }
    _step() {
        if (!this.isPlaying || !this.selectedTrack) return;
        const t = (performance.now() - this.playStartTime) / 1000;
        const state = this.selectedTrack.getStateAt(t);
        if (state) {
            // store current playback state so recorder can ignore it
            this._playbackSnapshot = state;
            for (const [name, s] of Object.entries(state)) {
                this.engine.lightManager.setLightIntensity(name, s.intensity);
                this.engine.lightManager.setLightColor(name, s.color);
            }
        }
        if (t < this.selectedTrack.length) {
            this.playbackTimer = requestAnimationFrame(() => this._step());
        } else if (this.isLooping) {
            this.playStartTime = performance.now();
            this.playbackTimer = requestAnimationFrame(() => this._step());
        } else {
            this.isPlaying = false;
            this._notify();
        }
    }
    stop() {
        this.isPlaying = false;
        if (this.playbackTimer) cancelAnimationFrame(this.playbackTimer);
        this._notify();
    }
    next() {
        if (this.tracks.length) {
            const idx =
                this.selectedTrackIndex >= 0 ? this.selectedTrackIndex : 0;
            this.selectedTrackIndex = (idx + 1) % this.tracks.length;
            this._notify();
        }
    }
    prev() {
        if (this.tracks.length) {
            const idx =
                this.selectedTrackIndex >= 0 ? this.selectedTrackIndex : 0;
            this.selectedTrackIndex =
                (idx - 1 + this.tracks.length) % this.tracks.length;
            this._notify();
        }
    }
    toggleLoop() {
        this.isLooping = !this.isLooping;
        this._notify();
    }
    _notify() {
        this.onStatusChange && this.onStatusChange();
    }
    // alias for backward compatibility
    _notifyStatus() {
        this._notify();
    }
    getStatus() {
        return {
            isRecording: this.isRecording,
            isPlaying: this.isPlaying,
            isLooping: this.isLooping,
            selectedTrack: this.selectedTrack?.name,
            selectedTrackIndex:
                this.selectedTrackIndex >= 0 ? this.selectedTrackIndex : null,
            trackCount: this.tracks.length,
        };
    }

    deleteTrack(index) {
        if (index < 0 || index >= this.tracks.length) return;
        const [removed] = this.tracks.splice(index, 1);
        if (window.lightFS) {
            window.lightFS.deleteTrack(removed.name).catch(() => {});
        }
        this.selectedTrackIndex = this.tracks.length ? 0 : -1;
        this._notify();
    }

    /**
     * Compose new track by superposing others with given offsets (seconds)
     * @param {Array<number>} indexes indexes of tracks to use
     * @param {Array<number>} offsets same length offsets in seconds
     */
    composeTracks(indexes, offsets) {
        if (!indexes?.length) return null;
        const baseName = indexes.map((i) => this.tracks[i].name).join("+");
        let composite = LightTrack.shiftedCopy(
            this.tracks[indexes[0]],
            offsets[0] || 0
        );
        for (let k = 1; k < indexes.length; k++) {
            const shifted = LightTrack.shiftedCopy(
                this.tracks[indexes[k]],
                offsets[k] || 0
            );
            composite = composite.mergeWith(shifted);
        }
        composite.name = "Composite_" + Date.now();
        this.tracks.push(composite);
        this.selectedTrackIndex = this.tracks.length - 1;
        // Save
        window.lightFS?.saveTrack(composite.name, composite.toJSON());
        this._notify();
        return composite;
    }

    /**
     * segments: [{trackIndex,start,end,offset}]
     */
    composeFromSegments(segments, name = "Composite", save = true) {
        if (!segments?.length) return null;
        let composite = null;
        segments.forEach((seg) => {
            const tr = this.tracks[seg.trackIndex];
            if (!tr) return;
            let part = LightTrack.trimmedCopy(
                tr,
                seg.start ?? 0,
                seg.end ?? tr.length
            );
            part = LightTrack.shiftedCopy(part, seg.offset ?? 0);
            composite = composite ? composite.mergeWith(part) : part;
        });
        if (!composite) return null;
        composite.name = name;
        this.tracks.push(composite);
        this.selectedTrackIndex = this.tracks.length - 1;
        if (save) window.lightFS?.saveTrack(composite.name, composite.toJSON());
        this._notify();
        return composite;
    }
}
