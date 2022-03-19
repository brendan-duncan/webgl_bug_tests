import { Loki } from "../loki.js";

/**
 * WebGL context state management, allowing for the pushing and popping of the GL state to
 * be able to temporarily change the GL state and restore it. This requires all state changes
 * to go through GLState. Access the global GLState from {@link GLContext}.state.
 * @category GL
 */
export class GLState {
    constructor(gl) {
        this.gl = gl;
        this._top = null;
        this._stack = [];
        this._skipped = 0;
    }

    push() {
        this._top = new Map();
        this._stack.push(this._top);
    }

    pop() {
        if (this._stack.length == 0) {
            return;
        }

        const top = this._stack.pop();
        if (this._stack.length) {
            this._top = this._stack[this._stack.length - 1];
        } else {
            this._top = null;
        }

        for (const tf of top) {
            const flag = tf[0];
            let l = this._stack.length - 1;
            if (flag === 'flags') {
                const topFlags = top.get('flags');
                for (const en of topFlags) {
                    const topFlag = en[0];

                    for (let i = l; i >= 0; --i) {
                        const state = this._stack[i];
                        const stateFlags = state.get('flags');
                        if (stateFlags) {
                            if (stateFlags.has(topFlag)) {
                                const stateFlagValue = stateFlags.get(topFlag);
                                if (stateFlagValue) {
                                    this.gl.enable(topFlag);
                                } else {
                                    this.gl.disable(topFlag);
                                }
                                break;
                            }
                        }
                    }
                }
            } else {
                for (let i = l; i >= 0; --i) {
                    const state = this._stack[i];
                    if (state.has(flag)) {
                        const value = state.get(flag);
                        if (value.constructor === Array) {
                            this.gl[flag](...value);
                        } else {
                            this.gl[flag](value);
                        }
                        break;
                    }
                }
            }
        }

        if (this._stack.length == 0) {
            this._skipped = 0;
        }
    }

    /**
     * Set the gl.enable, gl.disable state of a flag
     * @param {number} flag 
     * @param {bool} state 
     */
    setFlag(flag, state) {
        let l = this._stack.length - 1;
        for (let i = l; i >= 0; --i) {
            const state = this._stack[i];
            const flags = state.get('flags');
            if (flags) {
                if (flags.has(flag)) {
                    if (flags.get(flag) === state) {
                        this._skipped++;
                        return;
                    }
                    break;
                }
            }
        }
        let flags = this._top.get('flags');
        if (!flags) {
            flags = new Map();
            this._top.set('flags', flags);
        }
        flags.set(flag, state);
        if (state) {
            this.gl.enable(flag);
        } else {
            this.gl.disable(flag);
        }
    }

    enable(flag) {
        this.setFlag(flag, true);
    }

    disable(flag) {
        this.setFlag(flag, false);
    }

    set(flag, value) {
        if (!this._top || value === undefined) {
            return;
        }
        let l = this._stack.length - 1;
        for (let i = l; i >= 0; --i) {
            const state = this._stack[i];
            if (state.has(flag)) {
                const previousValue = state.get(flag);
                if (Loki.isEqual(previousValue, value)) {
                    this._skipped++;
                    return;
                }
                break;
            }
        }
        this._top.set(flag, value);
        if (value.constructor === Array) {
            this.gl[flag](...value);
        } else {
            this.gl[flag](value);
        }
    }

    get(flag) {
        return this._top.get(flag);
    }

    has(flag) {
        return this._top.has(flag);
    }
}
