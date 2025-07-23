export class LightTrack {
    constructor(name = "Track") {
        this.name = name;
        this.states = []; // { time, lights: { [lightName]: { intensity, color } } }
        this.length = 0;
    }

    addState(time, lights) {
        this.states.push({ time, lights: JSON.parse(JSON.stringify(lights)) });
        if (time > this.length) this.length = time;
    }

    getStateAt(time) {
        let last = null;
        for (const state of this.states) {
            if (state.time <= time) last = state;
            else break;
        }
        return last ? last.lights : null;
    }

    mergeWith(other) {
        const merged = new LightTrack(this.name + "+" + other.name);
        const times = Array.from(
            new Set([
                ...this.states.map((s) => s.time),
                ...other.states.map((s) => s.time),
            ])
        ).sort((a, b) => a - b);
        let i = 0,
            j = 0,
            lastA = {},
            lastB = {};
        for (const t of times) {
            while (i < this.states.length && this.states[i].time <= t) {
                lastA = this.states[i].lights;
                i++;
            }
            while (j < other.states.length && other.states[j].time <= t) {
                lastB = other.states[j].lights;
                j++;
            }
            merged.addState(t, { ...lastA, ...lastB });
        }
        merged.length = Math.max(this.length, other.length);
        return merged;
    }

    static fromJSON(name, obj) {
        const t = new LightTrack(name);
        t.states = obj.states || [];
        t.length =
            obj.length ??
            (t.states.length ? t.states[t.states.length - 1].time : 0);
        return t;
    }

    toJSON() {
        return {
            states: this.states,
            length: this.length,
        };
    }

    static shiftedCopy(track, offset = 0) {
        const copy = new LightTrack(track.name + "@" + offset);
        track.states.forEach((s) => copy.addState(s.time + offset, s.lights));
        copy.length = track.length + offset;
        return copy;
    }

    static trimmedCopy(track, start = 0, end = track.length) {
        const copy = new LightTrack(track.name + `[${start}-${end}]`);
        track.states.forEach((s) => {
            if (s.time >= start && s.time <= end) {
                copy.addState(s.time - start, s.lights);
            }
        });
        return copy;
    }
}
