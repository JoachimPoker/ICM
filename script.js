/* ============================================================================
   ICM & Chip-Chop Calculator
   ----------------------------------------------------------------------------
   Sections:
     1. State
     2. DOM bootstrapping
     3. Input / totals helpers
     4. Money Left (£ / %) handling
     5. ICM math
     6. Chip-Chop math
     7. Rounding
     8. Manual adjustments (proportional rebalance)
     9. Results rendering
    10. Per-table actions (export / reset adjustments)
    11. Settings wiring (slider, rounding, toggles)
    12. Share / load
   ============================================================================ */


/* ---------- 1. State ------------------------------------------------------ */

const MAX_PLAYERS = 9;

// Raw (pre-rounding, pre-adjustment) values from the last calculation.
// Keeping raw values means rounding/adjustment changes never compound.
let rawICMPrizes = [];
let rawChopPrizes = [];
let rawMixedPrizes = [];

// Per-player proportional adjustments. 100 = unchanged. Higher = bigger slice.
// Length matches the number of active players (non-zero stacks) at calc time.
let icmAdjustments = [];
let chopAdjustments = [];
let mixedAdjustments = [];

// Cached active-player metadata from the last calculation (for rendering).
let activePlayerNames = [];
let activePlayerStacks = [];


/* ---------- 2. DOM bootstrapping ----------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    // Settings panel toggle
    const settingsButton = document.getElementById("settingsButton");
    const settingsContainer = document.getElementById("settingsContainer");
    if (settingsButton && settingsContainer) {
        settingsButton.addEventListener("click", () => {
            const shown = settingsContainer.style.display === "block";
            settingsContainer.style.display = shown ? "none" : "block";
        });
    }

    // Live totals as user types stacks / payouts
    document.querySelectorAll('.stack, .payout').forEach(input => {
        input.addEventListener('input', onInputChanged);
    });

    // Money Left wiring
    document.getElementById('moneyLeftValue').addEventListener('input', updateMoneyLeftHelper);
    document.getElementById('moneyLeftMode').addEventListener('change', onMoneyLeftModeChange);

    // Rounding change re-renders with new rounding (no recomputation needed)
    document.getElementById('roundingSelect').addEventListener('change', () => {
        if (rawICMPrizes.length) renderAllResults();
    });

    // Slider changes re-compute mixed prizes only
    document.getElementById('icmChipChopSlider').addEventListener('input', () => {
        updateSliderLabel();
        if (rawICMPrizes.length && rawChopPrizes.length) {
            recomputeMixedFromRaw();
            renderAllResults();
        }
    });

    // Try to load a shared link
    loadSharedData();
});

function onInputChanged() {
    calculateTotals();
    updateMoneyLeftHelper();
}


/* ---------- 3. Input / totals helpers ------------------------------------ */

function getActivePlayers() {
    // Returns arrays of active players (stack > 0), in entry order.
    const stackEls = document.querySelectorAll('.stack');
    const payoutEls = document.querySelectorAll('.payout');
    const nameEls = document.querySelectorAll('.player-name');

    const stacks = [];
    const payouts = [];
    const names = [];

    stackEls.forEach((el, i) => {
        const stackVal = parseFloat((el.value || '').replace(/,/g, ''));
        if (!isNaN(stackVal) && stackVal > 0) {
            stacks.push(stackVal);
            const payoutVal = parseFloat((payoutEls[i].value || '').replace(/,/g, ''));
            payouts.push(!isNaN(payoutVal) && payoutVal > 0 ? payoutVal : 0);
            names.push(nameEls[i].value.trim() || `Player ${i + 1}`);
        }
    });

    return { stacks, payouts, names };
}

function getAllPayouts() {
    // All 9 payout inputs in position order (zeros for empty).
    return Array.from(document.querySelectorAll('.payout')).map(el => {
        const v = parseFloat((el.value || '').replace(/,/g, ''));
        return !isNaN(v) && v > 0 ? v : 0;
    });
}

function calculateTotals() {
    let totalStack = 0;
    let totalPayout = 0;

    document.querySelectorAll('.stack').forEach(el => {
        const v = parseFloat((el.value || '').replace(/,/g, ''));
        if (!isNaN(v) && v > 0) totalStack += v;
    });

    document.querySelectorAll('.payout').forEach(el => {
        const v = parseFloat((el.value || '').replace(/,/g, ''));
        if (!isNaN(v) && v > 0) totalPayout += v;
    });

    document.getElementById('totalStack').innerText = totalStack.toLocaleString();
    document.getElementById('totalPayout').innerText = `£${totalPayout.toLocaleString()}`;
}


/* ---------- 4. Money Left (£ / %) handling ------------------------------- */

function getTotalPayout() {
    return getAllPayouts().reduce((s, v) => s + v, 0);
}

function getMoneyLeftAmount() {
    // Always returns the £ amount, regardless of input mode.
    const mode = document.getElementById('moneyLeftMode').value;
    const raw = parseFloat(document.getElementById('moneyLeftValue').value) || 0;

    if (mode === 'percent') {
        const total = getTotalPayout();
        return Math.max(0, Math.min(100, raw)) / 100 * total;
    }
    return Math.max(0, raw);
}

function onMoneyLeftModeChange() {
    const mode = document.getElementById('moneyLeftMode').value;
    const input = document.getElementById('moneyLeftValue');
    const prefix = document.getElementById('moneyLeftPrefix');
    const total = getTotalPayout();
    const currentVal = parseFloat(input.value) || 0;

    if (mode === 'percent') {
        prefix.textContent = '%';
        // Convert current £ to % of current total (if total > 0)
        if (total > 0 && currentVal > 0) {
            const pct = (currentVal / total) * 100;
            input.value = Math.round(pct * 100) / 100; // 2 dp
        }
        input.max = 100;
    } else {
        prefix.textContent = '£';
        // Convert current % to £
        if (total > 0 && currentVal > 0) {
            const amt = (currentVal / 100) * total;
            input.value = Math.round(amt * 100) / 100;
        }
        input.removeAttribute('max');
    }
    updateMoneyLeftHelper();
}

function updateMoneyLeftHelper() {
    const mode = document.getElementById('moneyLeftMode').value;
    const helper = document.getElementById('moneyLeftHelper');
    const raw = parseFloat(document.getElementById('moneyLeftValue').value) || 0;
    const total = getTotalPayout();

    if (raw <= 0 || total <= 0) {
        helper.textContent = '';
        return;
    }

    if (mode === 'percent') {
        const amt = (raw / 100) * total;
        helper.textContent = `= £${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of £${total.toLocaleString()}`;
    } else {
        const pct = total > 0 ? (raw / total) * 100 : 0;
        helper.textContent = `= ${pct.toFixed(2)}% of £${total.toLocaleString()}`;
    }
}


/* ---------- 5. ICM math --------------------------------------------------- */

function permuteArray(arr) {
    const result = [];
    (function permute(remaining, temp) {
        if (!remaining.length) {
            result.push(temp);
            return;
        }
        for (let i = 0; i < remaining.length; i++) {
            permute(
                [...remaining.slice(0, i), ...remaining.slice(i + 1)],
                [...temp, remaining[i]]
            );
        }
    })(arr, []);
    return result;
}

function calculateICMDistribution(stackValues) {
    const n = stackValues.length;
    const finishDist = Array.from({ length: n }, () => Array(n).fill(0));
    const perms = permuteArray([...Array(n).keys()]);

    perms.forEach(perm => {
        let prob = 1;
        for (let i = 0; i < n; i++) {
            const playerIndex = perm[i];
            const playerStack = stackValues[playerIndex];
            // Sum of stacks still "alive" at this finishing-position step
            let remainingStack = 0;
            for (let k = i; k < n; k++) remainingStack += stackValues[perm[k]];
            if (remainingStack > 0) prob *= playerStack / remainingStack;
        }
        for (let i = 0; i < n; i++) {
            finishDist[perm[i]][i] += prob;
        }
    });

    return finishDist;
}

function calculateICMPrizes(stackValues, allPayouts, moneyLeft) {
    const n = stackValues.length;
    const finishDist = calculateICMDistribution(stackValues);

    const icmPrizes = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const payoutValue = allPayouts[j] || 0;
            icmPrizes[i] += finishDist[i][j] * (payoutValue - (j === 0 ? moneyLeft : 0));
        }
    }
    return { icmPrizes, finishDist };
}


/* ---------- 6. Chip-Chop math -------------------------------------------- */

function calculateChopPrizes(stackValues, allPayouts, moneyLeft) {
    const n = stackValues.length;
    if (n === 0) return [];

    const totalStacks = stackValues.reduce((s, v) => s + v, 0);
    // "b" = min-cash amount (nth-place payout for n players)
    const b = allPayouts.length >= n ? (allPayouts[n - 1] || 0) : 0;
    // "c" = pool above the min-cash, minus money held back
    let c = 0;
    for (let i = 0; i < n; i++) c += (allPayouts[i] || 0) - b;
    c -= moneyLeft;

    return stackValues.map(stack => ((stack / totalStacks) * c) + b);
}


/* ---------- 7. Rounding --------------------------------------------------- */

function applyRounding(prizes) {
    const roundValue = parseInt(document.getElementById('roundingSelect').value, 10);
    if (!roundValue || roundValue === 0) {
        return prizes.map(v => Math.round(v * 100) / 100); // 2 dp when no rounding
    }

    const rounded = prizes.map(v => Math.round(v / roundValue) * roundValue);
    const totalAdjustment = prizes.reduce((sum, v, i) => sum + (rounded[i] - v), 0);

    if (totalAdjustment === 0) return rounded.map(Number);

    // Pick the element that can best absorb the drift
    let closestIndex = 0;
    let minDifference = Infinity;
    for (let i = 0; i < prizes.length; i++) {
        const diff = Math.abs(rounded[i] - totalAdjustment - prizes[i]);
        if (diff < minDifference) {
            minDifference = diff;
            closestIndex = i;
        }
    }
    rounded[closestIndex] -= totalAdjustment;
    return rounded.map(Number);
}


/* ---------- 8. Manual adjustments (proportional rebalance) --------------- */
/*
   Adjustments work on the principle from the original calculator:
     adjusted[i] = raw[i] * (adjustment[i] / 100)
     then rescale all adjusted values so the total matches the original total.
   This means "boosting" one player shrinks everyone else's share
   proportionally. It preserves the pool exactly.
*/

function applyAdjustments(rawPrizes, adjustments) {
    const n = rawPrizes.length;
    if (!adjustments || adjustments.length !== n) {
        return rawPrizes.slice();
    }

    const tentative = rawPrizes.map((v, i) => v * (adjustments[i] / 100));
    const originalTotal = rawPrizes.reduce((s, v) => s + v, 0);
    const tentativeTotal = tentative.reduce((s, v) => s + v, 0);

    if (tentativeTotal === 0) return rawPrizes.slice();

    return tentative.map(v => v * originalTotal / tentativeTotal);
}

function isAdjusted(adjustments) {
    return adjustments && adjustments.some(a => Math.abs(a - 100) > 0.001);
}

/**
 * User typed a new value for player `playerIdx` in `tableKey`.
 * Compute the adjustment % that would produce this value after rebalancing.
 *
 * Math: given raw r[i], target t for player i:
 *   t = r[i] * a[i] / S   where S = sum(r[j] * a[j] / 100)   -- but we only
 *   change a[i] (all others stay at whatever they were, typically 100).
 *
 * Let k = sum over j≠i of r[j] * a[j]. Let a = a[i].
 *   final[i] = (r[i] * a) / ( (k + r[i]*a)/100 ) * (originalTotal / 100)... simplify.
 *
 * Simpler: the final[i] after rebalance is:
 *   r[i]*a * T / (k + r[i]*a)   where T = sum(r)   (adjustment-scales cancel against the 1/100s)
 *
 * Solving for a:
 *   final[i] * (k + r[i]*a) = r[i]*a*T
 *   final[i]*k = r[i]*a*T - final[i]*r[i]*a = r[i]*a*(T - final[i])
 *   a = (final[i] * k) / ( r[i] * (T - final[i]) )
 *
 * Then we convert back to percentage by multiplying by 100 (since others are at 100).
 */
function computeAdjustmentForTarget(rawPrizes, adjustments, playerIdx, targetValue) {
    const r = rawPrizes;
    const n = r.length;
    const T = r.reduce((s, v) => s + v, 0);

    if (r[playerIdx] <= 0) return adjustments[playerIdx]; // can't adjust a zero prize
    if (targetValue <= 0) return 0.01; // effectively remove this player's share
    if (targetValue >= T) return 1e9; // user asked for more than the whole pool - clamp via rescale later

    // k = sum over j != i of r[j] * a[j], treating a[j] as the current percentages (so a[j]/100 is the factor)
    // But since we scale the whole thing at the end to match T, and the multiplier on the "others" cancels in
    // the relative shares, we just need the sum of their weighted raws. Use a[j] directly.
    let k = 0;
    for (let j = 0; j < n; j++) {
        if (j !== playerIdx) k += r[j] * adjustments[j];
    }

    if (k <= 0) return 100; // degenerate
    // Solve: final = r[i]*a*T / (k + r[i]*a)  for a (where a = adjustments[i] on the same /100 scale as others)
    // final * (k + r[i]*a) = r[i]*a*T
    // final*k = r[i]*a*(T - final)
    // a = final*k / ( r[i] * (T - final) )
    const a = (targetValue * k) / (r[playerIdx] * (T - targetValue));
    return Math.max(0.01, a);
}

function resetAdjustments(tableKey) {
    if (tableKey === 'icm') icmAdjustments = icmAdjustments.map(() => 100);
    if (tableKey === 'chop') chopAdjustments = chopAdjustments.map(() => 100);
    if (tableKey === 'mixed') mixedAdjustments = mixedAdjustments.map(() => 100);
    renderAllResults();
}


/* ---------- 9. Results rendering ----------------------------------------- */

function recomputeMixedFromRaw() {
    const mix = parseInt(document.getElementById('icmChipChopSlider').value, 10) / 100;
    const n = rawICMPrizes.length;
    rawMixedPrizes = Array(n).fill(0).map((_, i) =>
        rawICMPrizes[i] * mix + rawChopPrizes[i] * (1 - mix)
    );
    // Keep adjustments length in sync
    if (mixedAdjustments.length !== n) mixedAdjustments = Array(n).fill(100);
}

function calculateAll() {
    calculateTotals();

    const { stacks, names } = getActivePlayers();
    if (stacks.length === 0) {
        alert("Please enter at least one stack value.");
        return;
    }

    const allPayouts = getAllPayouts();
    const moneyLeft = getMoneyLeftAmount();

    const { icmPrizes } = calculateICMPrizes(stacks, allPayouts, moneyLeft);
    const chopPrizes = calculateChopPrizes(stacks, allPayouts, moneyLeft);

    rawICMPrizes = icmPrizes;
    rawChopPrizes = chopPrizes;
    activePlayerNames = names;
    activePlayerStacks = stacks;

    // Reset adjustments on fresh calculate
    icmAdjustments = Array(stacks.length).fill(100);
    chopAdjustments = Array(stacks.length).fill(100);
    mixedAdjustments = Array(stacks.length).fill(100);

    recomputeMixedFromRaw();
    renderAllResults();
}

function renderAllResults() {
    if (!rawICMPrizes.length) return;

    renderResultsTable({
        containerId: 'icmResultsContainer',
        title: 'ICM Results',
        tableKey: 'icm',
        rawPrizes: rawICMPrizes,
        adjustments: icmAdjustments,
        show: true
    });

    renderResultsTable({
        containerId: 'chipChopResultsContainer',
        title: 'Chip-Chop Results',
        tableKey: 'chop',
        rawPrizes: rawChopPrizes,
        adjustments: chopAdjustments,
        show: document.getElementById('showChipChop').checked
    });

    renderResultsTable({
        containerId: 'mixedResultsContainer',
        title: 'Mixed Results',
        tableKey: 'mixed',
        rawPrizes: rawMixedPrizes,
        adjustments: mixedAdjustments,
        show: document.getElementById('showMixed').checked
    });
}

function renderResultsTable({ containerId, title, tableKey, rawPrizes, adjustments, show }) {
    const container = document.getElementById(containerId);
    if (!show) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const adjusted = applyAdjustments(rawPrizes, adjustments);
    const displayed = applyRounding(adjusted);
    const moneyLeft = getMoneyLeftAmount();
    const total = displayed.reduce((s, v) => s + v, 0) + moneyLeft;
    const stacks = activePlayerStacks;
    const names = activePlayerNames;
    const hasAdjustments = isAdjusted(adjustments);

    const columnLabel =
        tableKey === 'icm' ? 'ICM Result (£)' :
        tableKey === 'chop' ? 'Chip Chop (£)' :
        'Mixed Prize (£)';

    let html = `
        <div class="results-container" id="${containerId}Content">
            <h3 class="text-center mt-5">${title}${hasAdjustments ? ' <small class="adjusted-indicator">(adjusted)</small>' : ''}</h3>
            <div class="table-container">
                <table class="table table-bordered text-center">
                    <thead class="table-dark">
                        <tr><th>Player</th><th>Stack</th><th>${columnLabel}</th></tr>
                    </thead>
                    <tbody>
    `;

    for (let i = 0; i < displayed.length; i++) {
        const playerName = names[i] || `Player ${i + 1}`;
        const stackValue = stacks[i] || 0;
        const isAdj = Math.abs(adjustments[i] - 100) > 0.001;
        const val = displayed[i];
        const formatted = val.toFixed(2);

        html += `
            <tr>
                <td>${escapeHtml(playerName)}</td>
                <td>${stackValue.toLocaleString()}</td>
                <td>
                    <input
                        type="number"
                        step="any"
                        class="editable-prize ${isAdj ? 'adjusted' : ''}"
                        data-table="${tableKey}"
                        data-index="${i}"
                        value="${formatted}"
                        onchange="onPrizeEdited(this)"
                    />
                </td>
            </tr>
        `;
    }

    html += `
                    </tbody>
                    <tfoot class="table-dark">
                        <tr>
                            <td colspan="2"><strong>Money Left to Be Played For:</strong></td>
                            <td>£${moneyLeft.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td><strong>Total:</strong></td>
                            <td>${stacks.reduce((s, v) => s + v, 0).toLocaleString()}</td>
                            <td><strong>£${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="results-actions no-export">
                <button class="btn btn-sm btn-success" onclick="shareResults()">
                    <i class="fas fa-share-alt"></i> Share
                </button>
                <button class="btn btn-sm btn-success" onclick="exportTableAsImage('${containerId}Content', '${tableKey}')">
                    <i class="fas fa-image"></i> Export Image
                </button>
                ${hasAdjustments
                    ? `<button class="btn btn-sm btn-outline-light" onclick="resetAdjustments('${tableKey}')">
                         <i class="fas fa-undo"></i> Reset Adjustments
                       </button>`
                    : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;
    container.style.display = 'block';
}

function onPrizeEdited(inputEl) {
    const tableKey = inputEl.dataset.table;
    const playerIdx = parseInt(inputEl.dataset.index, 10);
    const newValue = parseFloat(inputEl.value);

    if (isNaN(newValue) || newValue < 0) {
        renderAllResults(); // revert
        return;
    }

    // Get the right raw prizes + adjustments refs
    const raw =
        tableKey === 'icm' ? rawICMPrizes :
        tableKey === 'chop' ? rawChopPrizes :
        rawMixedPrizes;
    const adj =
        tableKey === 'icm' ? icmAdjustments :
        tableKey === 'chop' ? chopAdjustments :
        mixedAdjustments;

    // Because displayed values are rounded, we need to target the *pre-rounding*
    // value that would round to (or be close to) what the user typed. Simplest:
    // use the typed value directly as the post-adjust target. The rounding
    // pass will snap the final displayed number.
    const newA = computeAdjustmentForTarget(raw, adj, playerIdx, newValue);
    adj[playerIdx] = newA;

    renderAllResults();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* ---------- 10. Per-table actions: Export as PNG ------------------------- */

function exportTableAsImage(contentId, tableKey) {
    const node = document.getElementById(contentId);
    if (!node) return;

    if (typeof html2canvas === 'undefined') {
        alert("Image export library failed to load. Please check your internet connection.");
        return;
    }

    // Hide action buttons in the capture
    const actionBars = node.querySelectorAll('.no-export');
    actionBars.forEach(el => el.style.visibility = 'hidden');

    html2canvas(node, {
        backgroundColor: '#1c173d',
        scale: 2,
        useCORS: true
    }).then(canvas => {
        actionBars.forEach(el => el.style.visibility = '');

        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `icm-${tableKey}-results-${stamp}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }).catch(err => {
        actionBars.forEach(el => el.style.visibility = '');
        console.error('Export failed:', err);
        alert("Sorry, something went wrong exporting the image.");
    });
}


/* ---------- 11. Settings wiring ------------------------------------------ */

function updateSliderLabel() {
    const sliderValue = document.getElementById('icmChipChopSlider').value;
    document.getElementById('sliderValue').innerText = sliderValue;
    document.getElementById('chipChopValue').innerText = 100 - sliderValue;
}

function toggleResults() {
    const showChipChop = document.getElementById('showChipChop').checked;
    const showMixed = document.getElementById('showMixed').checked;

    document.getElementById('sliderContainer').style.display = showMixed ? 'block' : 'none';

    if (rawICMPrizes.length) {
        renderAllResults();
    } else {
        document.getElementById('chipChopResultsContainer').style.display = showChipChop ? 'block' : 'none';
        document.getElementById('mixedResultsContainer').style.display = showMixed ? 'block' : 'none';
    }
}


/* ---------- 12. Share / load --------------------------------------------- */

async function shareResults() {
    const players = [];
    const stacks = [];
    const payouts = [];

    document.querySelectorAll('.player-name').forEach(input => players.push(encodeURIComponent(input.value)));
    document.querySelectorAll('.stack').forEach(input => stacks.push(input.value));
    document.querySelectorAll('.payout').forEach(input => payouts.push(input.value));

    const queryParams = new URLSearchParams();
    queryParams.set("players", players.join(","));
    queryParams.set("stacks", stacks.join(","));
    queryParams.set("payouts", payouts.join(","));
    queryParams.set("moneyLeft", document.getElementById('moneyLeftValue').value || 0);
    queryParams.set("moneyLeftMode", document.getElementById('moneyLeftMode').value);
    queryParams.set("rounding", document.getElementById('roundingSelect').value);
    queryParams.set("icm", document.getElementById('icmChipChopSlider').value);
    queryParams.set("showChop", document.getElementById('showChipChop').checked ? 1 : 0);
    queryParams.set("showMixed", document.getElementById('showMixed').checked ? 1 : 0);

    const shareableURL = window.location.origin + window.location.pathname + "?" + queryParams.toString();

    // Modern clipboard API with graceful fallback
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(shareableURL);
            flashToast("Link copied to clipboard!");
            return;
        }
    } catch (err) {
        console.warn("Clipboard API failed, falling back:", err);
    }

    // Fallback: show the URL in a temporary input so the user can copy manually
    const tempInput = document.createElement('input');
    tempInput.value = shareableURL;
    tempInput.style.position = 'fixed';
    tempInput.style.top = '-1000px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        flashToast("Link copied to clipboard!");
    } catch {
        prompt("Copy this link:", shareableURL);
    }
    document.body.removeChild(tempInput);
}

function flashToast(msg) {
    let toast = document.getElementById('_icmToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = '_icmToast';
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #00cd70; color: #1c173d; padding: 10px 20px; border-radius: 5px;
            font-weight: bold; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: opacity 0.3s ease; opacity: 0;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 1800);
}

function loadSharedData() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("players")) return;

    const players = params.get("players").split(",");
    const stacks = params.get("stacks").split(",");
    const payouts = params.get("payouts").split(",");

    document.querySelectorAll('.player-name').forEach((input, i) => input.value = decodeURIComponent(players[i] || ""));
    document.querySelectorAll('.stack').forEach((input, i) => input.value = stacks[i] || "");
    document.querySelectorAll('.payout').forEach((input, i) => input.value = payouts[i] || "");

    document.getElementById('moneyLeftValue').value = params.get("moneyLeft") || 0;
    const mlMode = params.get("moneyLeftMode") || 'amount';
    document.getElementById('moneyLeftMode').value = mlMode;
    document.getElementById('moneyLeftPrefix').textContent = mlMode === 'percent' ? '%' : '£';

    document.getElementById('roundingSelect').value = params.get("rounding") || 1;
    document.getElementById('icmChipChopSlider').value = params.get("icm") || 50;

    if (params.get("showChop") === '1') document.getElementById('showChipChop').checked = true;
    if (params.get("showMixed") === '1') {
        document.getElementById('showMixed').checked = true;
        document.getElementById('sliderContainer').style.display = 'block';
    }

    updateSliderLabel();
    calculateTotals();
    updateMoneyLeftHelper();
    calculateAll();
}