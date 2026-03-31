const { createCanvas } = require('canvas');

/**
 * Renders a high-resolution price chart as a PNG buffer.
 * @param {number[]} prices - Array of price points to plot.
 * @param {number[]} [timestamps=[]] - Array of corresponding timestamps (ms).
 * @param {number} [width=1608] - Base width of the chart.
 * @param {number} [height=500] - Base height of the chart.
 * @returns {Buffer} The generated PNG image as a Buffer.
 */
function renderChart(prices, timestamps = [], width = 1608, height = 500) {
    const DPR    = 2;
    const canvas = createCanvas(width * DPR, height * DPR);
    const ctx    = canvas.getContext('2d');

    ctx.scale(DPR, DPR);

    const PAD = { top: 30, right: 20, bottom: 45, left: 80 };
    const CW  = width  - PAD.left - PAD.right;
    const CH  = height - PAD.top  - PAD.bottom;

    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, width, height);

    const maxP  = Math.max(...prices);
    const minP  = Math.min(...prices);
    const pad   = (maxP - minP) * 0.08 || 1;
    const hi    = maxP + pad;
    const lo    = minP - pad;
    const range = hi - lo;

    /**
     * Calculates the X coordinate for a given data index.
     * @param {number} i 
     */
    const xOf = i => PAD.left + (i / (prices.length - 1)) * CW;

    /**
     * Calculates the Y coordinate for a given price value.
     * @param {number} p 
     */
    const yOf = p => PAD.top  + CH - ((p - lo) / range) * CH;

    /**
     * Calculates a "nice" human-readable step for axis ticks.
     * @param {number} rawRange 
     * @param {number} targetTicks 
     * @returns {number}
     */
    function niceStep(rawRange, targetTicks) {
        const rough = rawRange / targetTicks;
        const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm  = rough / mag;
        let nice;
        if      (norm < 1.5) nice = 1;
        else if (norm < 3)   nice = 2;
        else if (norm < 7)   nice = 5;
        else                 nice = 10;
        return nice * mag;
    }

    const step      = niceStep(hi - lo, 7);
    const firstTick = Math.ceil(lo / step) * step;
    const yTicks    = [];
    for (let v = firstTick; v <= hi + step * 0.01; v = parseFloat((v + step).toPrecision(12)))
        yTicks.push(parseFloat(v.toPrecision(10)));

    const targetXTicks = 9;
    const xStep        = Math.max(1, Math.round(prices.length / targetXTicks));
    const xTickIndices = [];
    for (let i = 0; i < prices.length; i += xStep) xTickIndices.push(i);

    ctx.strokeStyle = '#1e2736';
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([2, 4]);

    for (const v of yTicks) {
        const y = yOf(v);
        if (y < PAD.top - 2 || y > PAD.top + CH + 2) continue;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + CW, y);
        ctx.stroke();
    }

    for (const i of xTickIndices) {
        const x = xOf(i);
        ctx.beginPath();
        ctx.moveTo(x, PAD.top);
        ctx.lineTo(x, PAD.top + CH);
        ctx.stroke();
    }

    ctx.setLineDash([]);

    ctx.font         = '13px sans-serif';
    ctx.fillStyle    = '#b6c0d5';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';

    for (const v of yTicks) {
        const y = yOf(v);
        if (y < PAD.top - 2 || y > PAD.top + CH + 2) continue;
        let label;
        if (step >= 1) {
            label = Math.round(v).toLocaleString('en-US');
        } else {
            const decimals = Math.max(0, -Math.floor(Math.log10(step)));
            label = v.toFixed(decimals);
        }
        ctx.fillText(`${label} \u2013`, PAD.left - 6, y);
    }

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#b6c0d5';
    ctx.font         = '13px sans-serif';

    for (const i of xTickIndices) {
        if (timestamps.length > i) {
            const x   = xOf(i);
            const d   = new Date(timestamps[i]);
            const lbl = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            ctx.fillStyle = '#2a3040';
            ctx.fillRect(x - 0.5, PAD.top + CH, 1, 6);
            ctx.fillStyle = '#b6c0d5';
            ctx.fillText(lbl, x, PAD.top + CH + 10);
        }
    }

    const pts = prices.map((p, i) => ({ x: xOf(i), y: yOf(p) }));

    ctx.strokeStyle = '#4285f4';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    const dotEvery = Math.max(1, Math.round(prices.length / 22));
    for (let i = 0; i < pts.length; i += dotEvery) {
        ctx.fillStyle   = 'rgba(255,255,255,0.90)';
        ctx.strokeStyle = '#4285f4';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    const last = pts[pts.length - 1];
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle    = 'rgba(182,192,213,0.35)';
    ctx.font         = '16px sans-serif';
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('fxmbed', width - PAD.right - 10, PAD.top + 8);

    return canvas.toBuffer('image/png');
}

module.exports = { renderChart };