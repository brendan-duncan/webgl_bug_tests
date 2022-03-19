/** @module color */

/**
 * Convert an RGB color (in [0, 1] range) to an HTML hex string.
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @return {String}
 */
export function rgbToHex(r, g, b) {
    r = Math.min(255, r * 255) | 0;
    g = Math.min(255, g * 255) | 0;
    b = Math.min(255, b * 255) | 0;
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Convert an RGB color (in [0, 255] range) to an HTML hex string.
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @return {String}
 */
export function rgb8ToHex(r, g, b) {
    r = Math.max(Math.min(255, r), 0) | 0;
    g = Math.max(Math.min(255, g), 0) | 0;
    b = Math.max(Math.min(255, b), 0) | 0;
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Convert an HTML color (hex string, rgb(r, g, b), or rgba(r, g, b, a)) to a color in
 * [0, 1] range.
 * 
 * @param {String} hex 
 * @param {Array<number>} out Storage for the resulting color.
 * @param {number?} alpha 
 * @return {Array<number>}
 */
export function parseHtmlColor(hex, out, alpha) {
    const outLength = out.length;

    alpha = (alpha === undefined ? 1 : alpha);
    if (outLength == 4) {
        out[3] = alpha;
    }

    if (hex.constructor !== String) {
        return out;
    }

    // for those hardcoded colors, like "red", "black", etc.
    const col = _stringColors[hex];
    if (col !== undefined) {
        out[0] = col[0];
        out[1] = col[1];
        out[2] = col[2];
        if (outLength == 4 && col.length == 4) {
            out[3] = col[3] * alpha;
        }
        return out;
    }

    // rgba colors
    let pos = hex.indexOf("rgba(");
    if (pos != -1) {
        const str = hex.substr(5, hex.length - 2).split(",");
        out[0] = parseInt(str[0]) / 255;
        out[1] = parseInt(str[1]) / 255;
        out[2] = parseInt(str[2]) / 255;
        if (outLength == 4) {
            out[3] = parseFloat(str[3]) * alpha;
        }
        return out;
    }

    pos = hex.indexOf("hsla(");
    if (pos != -1) {
        const str = hex.substr(5, hex.length - 2).split(",");
        hslToRGB(parseInt(str[0]) / 360,
            parseInt(str[1]) / 100,
            parseInt(str[2]) / 100,
            out);
        if (outLength == 4) {
            out[3] = parseFloat(str[3]) * alpha;
        }
        return out;
    }

    // rgb colors
    pos = hex.indexOf("rgb(");
    if (pos != -1) {
        const str = hex.substr(4, hex.length - 2).split(",");
        out[0] = parseInt(str[0]) / 255;
        out[1] = parseInt(str[1]) / 255;
        out[2] = parseInt(str[2]) / 255;
        return out;
    }

    pos = hex.indexOf("hsl(");
    if (pos != -1) {
        const str = hex.substr(4,hex.length-2).split(",");
        hslToRGB(parseInt(str[0]) / 360,
            parseInt(str[1]) / 100,
            parseInt(str[2]) / 100,
            out);
        return out;
    }

    // the rest
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return out;
    }

    out[0] = parseInt(result[1], 16) / 255;
    out[1] = parseInt(result[2], 16) / 255;
    out[2] = parseInt(result[3], 16) / 255;
    return out;
}

/**
 * Convert an HSL color to RGB
 * @param {number} h 
 * @param {number} s 
 * @param {number} l 
 * @param {Array<number>} out 
 * @return {Array<number>}
 */
export function hslToRGB(h, s, l, out) {
    let r;
    let g;
    let b;
    if (s == 0) {
        r = l;
        g = l;
        b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = _hueToRGB(p, q, h + 1 / 3);
        g = _hueToRGB(p, q, h);
        b = _hueToRGB(p, q, h - 1/3);
    }
    out[0] = r;
    out[1] = g;
    out[2] = b;
    return out;
}

/**
 * Calculate the luminance of an RGB color.
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @return {number}
 */
export function rgbToLuminance(r, g, b) {
    return 0.265106 * r + 0.670106 * g + 0.0647883 * b;
}

function _hueToRGB(p, q, t) {
    if (t < 0) {
        t += 1;
    }
    if (t > 1) {
        t -= 1;
    }
    if (t < 1/6) {
        return q + (q - p) * 6 * t;
    }
    if (t < 1/2) {
        return q;
    }
    if (t < 2/3) {
        return p + (q - p) * (2/3 - t) * 6;
    }
    return p;
}

// Color strings. from http://www.w3schools.com/cssref/css_colorsfull.asp
const _stringColors = {
    white: [1, 1, 1],
    black: [0, 0, 0],
    gray: [0.501960813999176, 0.501960813999176, 0.501960813999176],
    red: [1, 0, 0],
    orange: [1, 0.6470588445663452, 0],
    pink: [1, 0.7529411911964417, 0.7960784435272217],
    green: [0, 0.501960813999176, 0],
    lime: [0, 1, 0],
    blue: [0, 0, 1],
    violet: [0.9333333373069763, 0.5098039507865906, 0.9333333373069763],
    magenta: [1, 0, 1],
    cyan: [0, 1, 1],
    yellow: [1, 1, 0],
    brown: [0.6470588445663452, 0.16470588743686676, 0.16470588743686676],
    silver: [0.7529411911964417, 0.7529411911964417, 0.7529411911964417],
    gold: [1, 0.843137264251709, 0],
    transparent: [0, 0, 0, 0]
};
