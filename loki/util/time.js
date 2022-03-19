/**
 * Provides information about both the system clock time, and about time related to the Engine's
 * execution.
 * @hideconstructor
 * @category Util
 */
export class Time {
    /**
     * @property {number} milliseconds The current system clock time, in milliseconds.
     */
    static get milliseconds() {
        return Time.now();
    }

    /**
     * @property {number} seconds The current system clock time, in seconds.
     */
    static get seconds() {
        return Time.now() * 0.001;
    }
}

/**
 * @property {number} startTime The time at which the engine started running, in seconds.
 */
Time.startTime = 0;
/**
 * @property {number} time The current time of the enigne, relative to when the engine started running,
 * in seconds.
 */
Time.time = 0;
/**
 * @property {number} lastTime The time of the previous engine frame, in seconds.
 */
Time.lastTime = 0;
/**
 * @property {number} deltaTime The amount of time from the previous frame to the current frame,
 * in seconds.
 */
Time.deltaTime = 0;
/**
 * @property {number} timeSinceStart Time since the playback started, in seconds.
 */
Time.timeSinceStart = 0;
/**
 * @property {number} unscaledTime If there is any scaling to the engine time, this is the unscaled
 * time, in seconds.
 */
Time.unscaledTime = 0;
/**
 * @property {number} lastFixedTime The time since the last fixed step of the engine, in seconds.
 */
Time.lastFixedTime = 0;
/**
 * @property {number} fixedDeltaTime The amount of time since the last fixed step of the engine,
 * in seconds.
 */
Time.fixedDeltaTime = 0;

/**
 * @property {number} now The current time, in milliseconds
 */
if (typeof(performance) != "undefined") {
    Time.now = performance.now.bind(performance);
} else {
    Time.now = Date.now.bind(Date);
}
