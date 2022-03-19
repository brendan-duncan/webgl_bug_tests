import { Loki } from "../loki.js";

/**
 * Provides information about the browser environment.
 * Access the global singleton from L3D.Loki.platform.
 * @hideconstructor
 * @category Util
 */
export class Platform {
    /**
     * @private
     */
    static initialize() {
        Loki.platform = new Platform();
    }

    constructor() {
        this._desktop = false;
        this._mobile =  false;
        this._ios = false;
        this._android = false;
        this._windows = false;
        this._xbox = false;
        this._gamepads = false;
        this._touch = false;
        this._workers = false;
        this._passiveEvents = false;
        this._initialize();
    }

    /**
     * @property {bool} isDesktop Is it a desktop or laptop device?
     */
    get isDesktop() { return this._desktop; }

    /**
     * @property {bool} isMobile Is it a mobile or tablet device?
     */
    get isMobile() { return this._mobile; }

    /**
     * @property {bool} isIOS Is it an iOS device?
     */
    get isIOS() { return this._ios; }

    /**
     * @property {bool} isAndroid Is it an Android device?
     */
    get isAndroid() { return this._android; }

    /**
     * @property {bool} isWindows Is it running on Windows?
     */
    get isWindows() { return this._windows; }

    /**
     * @property {bool} isXbox Is it running on an Xbox?
     */
    get isXbox() { return this._xbox; }

    /**
     * @property {bool} gamepads Does the platform support gamepads?
     */
    get gamepads() { return this._gamepads; }

    /**
     * @property {bool} touch Does the platform support touch input?
     */
    get touch() { return this._touch; }

    /**
     * @property {bool} workers Does the platform support web workers?
     */
    get workers() { return this._workers; }

    /**
     * @property {bool} passiveEvents Does the platform support passive events for
     * EventTarget.addEventListener?
     */
    get passiveEvents() { return this._passiveEvents; }

    /*
     * Extract the platform information from the browser. This is done from initializeLoki.
     */
    _initialize() {
        if (typeof navigator !== 'undefined') {
            let ua = navigator.userAgent;
    
            if (/(windows|mac os|linux|cros)/i.test(ua))
                this._desktop = true;
    
            if (/xbox/i.test(ua))
                this._xbox = true;
    
            if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
                this._desktop = false;
                this._mobile = true;
                this._windows = true;
            } else if (/android/i.test(ua)) {
                this._desktop = false;
                this._mobile = true;
                this._android = true;
            } else if (/ip([ao]d|hone)/i.test(ua)) {
                this._desktop = false;
                this._mobile = true;
                this._ios = true;
            }
    
            if (typeof(window) !== 'undefined') {
                this._touch = 'ontouchstart' in window || 
                    ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
            }
    
            this._gamepads = 'getGamepads' in navigator;
    
            this._workers = (typeof(Worker) !== 'undefined');
    
            try {
                const opts = Object.defineProperty({}, 'passive', {
                    get: function () {
                        this._passiveEvents = true;
                        return false;
                    }
                });
                window.addEventListener("testpassive", null, opts);
                window.removeEventListener("testpassive", null, opts);
            } catch (e) {
                // ...
            }
        }
    }
}
