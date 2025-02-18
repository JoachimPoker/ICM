let latestICMPrizes = [];
let latestChipChopPrizes = [];
let latestMixedPrizes = [];

document.addEventListener("DOMContentLoaded", function () {
    let settingsButton = document.getElementById("settingsButton");
    let settingsContainer = document.getElementById("settingsContainer");

    if (settingsButton && settingsContainer) {
        settingsButton.addEventListener("click", function () {
            console.log("Settings button clicked"); // Debugging

            // Check current visibility and toggle it
            if (settingsContainer.style.display === "none" || settingsContainer.style.display === "") {
                settingsContainer.style.display = "block"; // ✅ Make it visible
            } else {
                settingsContainer.style.display = "none"; // ❌ Hide it again if clicked
            }
        });
    } else {
        console.error("Settings button or container not found!");
    }
});


document.querySelectorAll('.stack, .payout').forEach(input => {
    input.addEventListener('input', calculateTotals);
});


function updateSliderLabel() {
    let sliderValue = document.getElementById('icmChipChopSlider').value;
    document.getElementById('sliderValue').innerText = sliderValue;
    document.getElementById('chipChopValue').innerText = 100 - sliderValue;
}

 function calculateTotals() {
    let stacks = document.querySelectorAll('.stack');
    let payouts = document.querySelectorAll('.payout');
    let totalStack = 0;
    let totalPayout = 0;

    // Calculate total chip stacks
    stacks.forEach(stack => {
        let value = parseFloat(stack.value.replace(/,/g, '')); // Remove commas before parsing
        if (!isNaN(value) && value > 0) {
            totalStack += value;
        }
    });

    // Calculate total payouts
    payouts.forEach(payout => {
        let value = parseFloat(payout.value.replace(/,/g, '')); // Remove commas before parsing
        if (!isNaN(value) && value > 0) {
            totalPayout += value;
        }
    });

    // Update totals with proper formatting
    document.getElementById('totalStack').innerText = totalStack.toLocaleString();
    document.getElementById('totalPayout').innerText = `£${totalPayout.toLocaleString()}`;
}


    function permuteArray(arr) {
        function permute(arr, temp = []) {
            if (!arr.length) {
                result.push([...temp]);
            } else {
                for (let i = 0; i < arr.length; i++) {
                    permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...temp, arr[i]]);
                }
            }
        }
        let result = [];
        permute(arr);
        return result;
    }

 function calculateICMDistribution() {
    let stacks = document.querySelectorAll('.stack');
    let names = document.querySelectorAll('#playerTable input[type="text"]');
    let stackValues = [];
    let playerNames = [];

    stacks.forEach((stack, index) => {
        let value = parseFloat(stack.value);
        if (!isNaN(value) && value > 0) {
            stackValues.push(value);
            playerNames.push(names[index].value || `Player ${index + 1}`);
        }
    });

    if (stackValues.length === 0) {
        alert("Please enter at least one stack value.");
        return [];
    }

    let numPlayers = stackValues.length;
    let finishDist = Array.from({ length: numPlayers }, () => Array(numPlayers).fill(0));
    let permutations = permuteArray([...Array(numPlayers).keys()]);

    permutations.forEach(perm => {
        let prob = 1;

        for (let i = 0; i < numPlayers; i++) {
            let playerIndex = perm[i];
            let playerStack = stackValues[playerIndex];

            let totalStack = stackValues.reduce((sum, val, idx) => sum + (perm.indexOf(idx) >= i ? val : 0), 0);
            if (totalStack > 0) {
                prob *= playerStack / totalStack;
            }
        }

        for (let i = 0; i < numPlayers; i++) {
            finishDist[perm[i]][i] += prob;
        }
    });

    displayICMTable(finishDist, playerNames);
    return finishDist; // ✅ Return finishDist for use in calculateAll()
}

	
function applyRounding(prizes) {
    let roundValue = parseInt(document.getElementById('roundingSelect').value);
    if (roundValue === 0) return prizes.map(val => parseFloat(val.toFixed(2))); // No rounding

    let roundedPrizes = prizes.map(val => Math.round(val / roundValue) * roundValue);
    let totalAdjustment = prizes.reduce((sum, val, i) => sum + (roundedPrizes[i] - val), 0);

    // Find the element that can best absorb the rounding difference
    let closestIndex = 0;
    let minDifference = Math.abs(totalAdjustment);
    for (let i = 0; i < prizes.length; i++) {
        let diff = Math.abs(roundedPrizes[i] - totalAdjustment - prizes[i]);
        if (diff < minDifference) {
            minDifference = diff;
            closestIndex = i;
        }
    }

    // Adjust the closest element
    roundedPrizes[closestIndex] -= totalAdjustment;

    return roundedPrizes.map(Number); // Ensure it returns **numbers** instead of strings
}


    function calculateICMPrizes(finishDist) {
    let payouts = document.querySelectorAll('.payout');
    let icmResults = document.querySelectorAll('.icm-result');
    let moneyLeft = parseFloat(document.getElementById('moneyLeft').value) || 0;

    let numPlayers = finishDist.length;
    let icmPrizes = Array(numPlayers).fill(0);

    for (let i = 0; i < numPlayers; i++) {
        for (let j = 0; j < numPlayers; j++) {
            let payoutValue = parseFloat(payouts[j].value) || 0;
            icmPrizes[i] += finishDist[i][j] * (payoutValue - (j === 0 ? moneyLeft : 0));
        }
    }

    let roundedPrizes = applyRounding(icmPrizes);

    icmResults.forEach((cell, index) => {
        cell.innerText = `£${roundedPrizes[index]}`;
    });

    return roundedPrizes.map(Number); // Return as numbers for further calculations
}


	
function calculateChopPrizes() {
    let stacks = document.querySelectorAll('.stack');
    let payouts = document.querySelectorAll('.payout');
    let chopResults = document.querySelectorAll('.chip-chop'); // Ensure selection
    let moneyLeft = parseFloat(document.getElementById('moneyLeft').value) || 0;

    let stackValues = [];
    let payoutValues = [];

    stacks.forEach((stack, index) => {
        let stackValue = parseFloat(stack.value);
        let payoutValue = parseFloat(payouts[index].value) || 0;

        if (!isNaN(stackValue) && stackValue > 0) {
            stackValues.push(stackValue);
            payoutValues.push(payoutValue);
        }
    });

    let numPlayers = stackValues.length;

    if (numPlayers === 0) {
        console.warn("No players entered for Chop Prizes.");
        return Array(numPlayers).fill(0); // Return empty array if no players
    }

    let totalStacks = stackValues.reduce((sum, val) => sum + val, 0);
    let b = payoutValues.length >= numPlayers ? payoutValues[numPlayers - 1] : 0;
    let c = payoutValues.slice(0, numPlayers).reduce((sum, val) => sum + (val - b), 0) - moneyLeft;

    let chopPrizes = stackValues.map(stack => ((stack / totalStacks) * c) + b);

    let roundedPrizes = applyRounding(chopPrizes);

    // **Ensure Chop Prizes update in the table**
    chopResults.forEach((cell, index) => {
        if (index < roundedPrizes.length) {
            cell.innerText = `£${roundedPrizes[index]}`;
        } else {
            cell.innerText = '-';
        }
    });

    console.log("Chop Prizes Calculated:", roundedPrizes); // Debugging
    return roundedPrizes.map(Number); // Return for further calculations
}

function calculateMixedPrizes(icmPrizes, chopPrizes) {
    let mixResults = document.querySelectorAll('.mixed-prizes');
    let mixPercentage = parseInt(document.getElementById('icmChipChopSlider').value) / 100;

    if (icmPrizes.length === 0 || chopPrizes.length === 0) {
        console.error("ICM or Chip Chop Prizes are missing.");
        return;
    }

    let mixedPrizes = icmPrizes.map((icm, i) => (icm * mixPercentage) + (chopPrizes[i] * (1 - mixPercentage)));

    let roundedPrizes = applyRounding(mixedPrizes);

    mixResults.forEach((cell, index) => {
        if (index < roundedPrizes.length) {
            cell.innerText = `£${roundedPrizes[index]}`;
        } else {
            cell.innerText = '-';
        }
    });

    console.log("Mixed Prizes Calculated:", roundedPrizes); // Debugging
}
document.getElementById('icmChipChopSlider').addEventListener('input', function () {
    updateSliderLabel();

    // Get all ICM and Chip Chop results from the table
    let icmPrizes = document.querySelectorAll('.icm-result');
    let chopPrizes = document.querySelectorAll('.chip-chop');

    // Convert displayed text back to numbers (removing "£" sign)
    let icmValues = Array.from(icmPrizes).map(cell => parseFloat(cell.innerText.replace('£', '')) || 0);
    let chopValues = Array.from(chopPrizes).map(cell => parseFloat(cell.innerText.replace('£', '')) || 0);

    calculateMixedPrizes(icmValues, chopValues); // ✅ Update Mixed Prizes based on new slider value
});


function displayICMTable(finishDist, playerNames) {
    let icmSection = document.getElementById("icmDistributionSection"); 
    let icmHeader = document.getElementById('icmHeader');
    let icmTable = document.getElementById('icmTable');

    // If data exists, show the table
    if (finishDist.length > 0) {
        icmSection.style.display = "none"; // ✅ Show ICM section when data is available
    } else {
        icmSection.style.display = "none";  // ✅ Hide ICM section if no data
    }

    icmHeader.innerHTML = '<tr><th>Player</th>' + playerNames.map((_, i) => `<th>${i + 1}</th>`).join('') + '</tr>';
    icmTable.innerHTML = playerNames.map((player, i) => 
        `<tr><td>${player}</td>` + finishDist[i].map(prob => `<td>${(prob * 100).toFixed(2)}%</td>`).join('') + '</tr>'
    ).join('');
}


function calculateAll() {
    calculateTotals();
    let finishDist = calculateICMDistribution(); // ✅ Store finishDist

    latestICMPrizes = calculateICMPrizes(finishDist); // ✅ Store ICM Prizes
    latestChipChopPrizes = calculateChopPrizes(); // ✅ Store Chip Chop Prizes
    latestMixedPrizes = latestICMPrizes.map((icm, i) =>
        (icm * (document.getElementById('icmChipChopSlider').value / 100)) +
        (latestChipChopPrizes[i] * (1 - (document.getElementById('icmChipChopSlider').value / 100)))
    );

    generateResultsTable(latestICMPrizes, latestChipChopPrizes, latestMixedPrizes);
}


function generateResultsTable(icmPrizes, chopPrizes, mixedPrizes) {
    let icmContainer = document.getElementById("icmResultsContainer");
    let chipChopContainer = document.getElementById("chipChopResultsContainer");
    let mixedContainer = document.getElementById("mixedResultsContainer");

    let playerNames = document.querySelectorAll('#playerTable input[type="text"]');
    let playerStacks = document.querySelectorAll('.stack'); // ✅ Get stack values
    let moneyLeft = parseFloat(document.getElementById('moneyLeft').value) || 0;

    // Calculate Totals
    let totalStack = Array.from(playerStacks).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    let totalICM = icmPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;
    let totalChipChop = chopPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;
    let totalMixed = mixedPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;

    /*** ICM TABLE ***/
    let icmHTML = `
        <h3 class="text-center mt-5">ICM Results</h3>
        <div class="table-container">
            <table class="table table-bordered text-center">
                <thead class="table-dark">
                    <tr><th>Player</th><th>Stack</th><th>ICM Result (£)</th></tr>
                </thead>
                <tbody>
    `;

    for (let i = 0; i < icmPrizes.length; i++) {
        let playerName = playerNames[i].value || `Player ${i + 1}`;
        let stackValue = parseFloat(playerStacks[i].value) || 0;

        icmHTML += `<tr><td>${playerName}</td><td>${stackValue.toLocaleString()}</td><td class="icm-result">£${icmPrizes[i].toFixed(2)}</td></tr>`;
    }

    // **Money Left Row**
    icmHTML += `
        </tbody><tfoot class="table-warning">
			<tr>
				<td colspan="2"><strong>Money Left to Be Played For:</strong></td>
				<td id="moneyLeftRow">£${moneyLeft.toFixed(2)}</td>
			</tr>
		
    `;

    // **Total Stack & Total Payout Row**
    icmHTML += `
        <tr>
            <td><strong>Total:</strong></td>
            <td>${totalStack.toLocaleString()}</td>
            <td id="totalICM">£${totalICM.toFixed(2)}</td>
        </tr>
    `;

    icmHTML += `</tfoot></table></div>`;

    // **Add Share Button**
    icmHTML += `
        <div class="text-center mt-3">
            <button class="btn btn-success" onclick="shareResults()">Share Results</button>
            <input type="text" id="shareableLink" class="form-control mt-2" readonly style="display: none;">
        </div>
    `;

    icmContainer.innerHTML = icmHTML;

    /*** CHIP-CHOP TABLE (If Enabled) ***/
    if (document.getElementById("showChipChop").checked) {
        let chipChopHTML = `
            <h3 class="text-center mt-5">Chip-Chop Results</h3>
            <div class="table-container">
                <table class="table table-bordered text-center">
                    <thead class="table-dark"><tr><th>Player</th><th>Stack</th><th>Chip Chop (£)</th></tr></thead>
                    <tbody>
        `;

        for (let i = 0; i < chopPrizes.length; i++) {
            let stackValue = parseFloat(playerStacks[i].value) || 0;

            chipChopHTML += `<tr><td>${playerNames[i].value || `Player ${i + 1}`}</td><td>${stackValue.toLocaleString()}</td><td class="chip-chop">£${chopPrizes[i].toFixed(2)}</td></tr>`;
        }

 // **Money Left Row**
    icmHTML += `
        </tbody><tfoot class="table-warning">
			<tr>
				<td colspan="2"><strong>Money Left to Be Played For:</strong></td>
				<td id="moneyLeftRow">£${moneyLeft.toFixed(2)}</td>
			</tr>
		
    `;

    // **Total Stack & Total Payout Row**
    icmHTML += `
        <tr>
            <td><strong>Total:</strong></td>
            <td>${totalStack.toLocaleString()}</td>
            <td id="totalICM">£${totalICM.toFixed(2)}</td>
        </tr>
    `;

    icmHTML += `</tfoot></table></div>`;

        // **Add Share Button**
        chipChopHTML += `
            <div class="text-center mt-3">
                <button class="btn btn-success" onclick="shareResults()">Share Results</button>
                <input type="text" id="shareableLink" class="form-control mt-2" readonly style="display: none;">
            </div>
        `;

        chipChopContainer.innerHTML = chipChopHTML;
        chipChopContainer.style.display = "block";
    } else {
        chipChopContainer.style.display = "none";
    }

    /*** MIXED RESULTS TABLE (If Enabled) ***/
    if (document.getElementById("showMixed").checked) {
        let mixedHTML = `
            <h3 class="text-center mt-5">Mixed Results</h3>
            <div class="table-container">
                <table class="table table-bordered text-center">
                    <thead class="table-dark"><tr><th>Player</th><th>Stack</th><th>Mixed Prizes (£)</th></tr></thead>
                    <tbody>
        `;

        for (let i = 0; i < mixedPrizes.length; i++) {
            let stackValue = parseFloat(playerStacks[i].value) || 0;

            mixedHTML += `<tr><td>${playerNames[i].value || `Player ${i + 1}`}</td><td>${stackValue.toLocaleString()}</td><td class="mixed-prizes">£${mixedPrizes[i].toFixed(2)}</td></tr>`;
        }

 // **Money Left Row**
    icmHTML += `
        </tbody><tfoot class="table-warning">
			<tr>
				<td colspan="2"><strong>Money Left to Be Played For:</strong></td>
				<td id="moneyLeftRow">£${moneyLeft.toFixed(2)}</td>
			</tr>
		
    `;

    // **Total Stack & Total Payout Row**
    icmHTML += `
        <tr>
            <td><strong>Total:</strong></td>
            <td>${totalStack.toLocaleString()}</td>
            <td id="totalICM">£${totalICM.toFixed(2)}</td>
        </tr>
    `;

    icmHTML += `</tfoot></table></div>`;

        // **Add Share Button**
        mixedHTML += `
            <div class="text-center mt-3">
                <button class="btn btn-success" onclick="shareResults()">Share Results</button>
                <input type="text" id="shareableLink" class="form-control mt-2" readonly style="display: none;">
            </div>
        `;

        mixedContainer.innerHTML = mixedHTML;
        mixedContainer.style.display = "block";
    } else {
        mixedContainer.style.display = "none";
    }
}




// Function to apply rounding dynamically to existing results

function applyRoundingToResults() {
    let roundValue = parseInt(document.getElementById('roundingSelect').value);

    // If no calculations exist yet, exit
    if (!latestICMPrizes.length || !latestChipChopPrizes.length || !latestMixedPrizes.length) {
        return;
    }

    // Apply rounding to stored computed values
    latestICMPrizes = applyRounding([...latestICMPrizes]).map(Number);
    latestChipChopPrizes = applyRounding([...latestChipChopPrizes]).map(Number);
    latestMixedPrizes = applyRounding([...latestMixedPrizes]).map(Number);

    // **Re-render the results table with updated values**
    generateResultsTable(latestICMPrizes, latestChipChopPrizes, latestMixedPrizes);
}




// Function to update the totals in the results table
function updateResultsTotals(icmPrizes, chipChopPrizes, mixedPrizes) {
    let moneyLeft = parseFloat(document.getElementById('moneyLeft').value) || 0;

    let totalICM = icmPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;
    let totalChipChop = chipChopPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;
    let totalMixed = mixedPrizes.reduce((sum, val) => sum + parseFloat(val), 0) + moneyLeft;

    // Update displayed totals
    document.getElementById('totalICM').innerText = `£${totalICM.toFixed(2)}`;
    document.getElementById('totalChipChop').innerText = `£${totalChipChop.toFixed(2)}`;
    document.getElementById('totalMixed').innerText = `£${totalMixed.toFixed(2)}`;

    // Update the Money Left row
    document.getElementById('moneyLeftRow').innerText = `£${moneyLeft.toFixed(2)}`;
}


document.getElementById('roundingSelect').addEventListener('change', applyRoundingToResults);

function shareResults() {
    let players = [];
    let stacks = [];
    let payouts = [];
    
    document.querySelectorAll('#playerTable input[type="text"]').forEach(input => players.push(encodeURIComponent(input.value)));
    document.querySelectorAll('.stack').forEach(input => stacks.push(input.value));
    document.querySelectorAll('.payout').forEach(input => payouts.push(input.value));

    let moneyLeft = document.getElementById('moneyLeft').value || 0;
    let rounding = document.getElementById('roundingSelect').value;
    let icmPercentage = document.getElementById('icmChipChopSlider').value;

    let queryParams = new URLSearchParams();
    queryParams.set("players", players.join(","));
    queryParams.set("stacks", stacks.join(","));
    queryParams.set("payouts", payouts.join(","));
    queryParams.set("moneyLeft", moneyLeft);
    queryParams.set("rounding", rounding);
    queryParams.set("icm", icmPercentage);

    let shareableURL = window.location.origin + window.location.pathname + "?" + queryParams.toString();

    // Display the link in an input field
    let shareInput = document.getElementById('shareableLink');
    shareInput.value = shareableURL;
    shareInput.style.display = "block";
    shareInput.select();
    document.execCommand("copy");

    alert("Link copied to clipboard!");
}

function loadSharedData() {
    let params = new URLSearchParams(window.location.search);

    if (params.has("players")) {
        let players = params.get("players").split(",");
        let stacks = params.get("stacks").split(",");
        let payouts = params.get("payouts").split(",");
        let moneyLeft = params.get("moneyLeft") || 0;
        let rounding = params.get("rounding") || 0;
        let icmPercentage = params.get("icm") || 50;

        document.querySelectorAll('#playerTable input[type="text"]').forEach((input, i) => input.value = decodeURIComponent(players[i] || ""));
        document.querySelectorAll('.stack').forEach((input, i) => input.value = stacks[i] || 0);
        document.querySelectorAll('.payout').forEach((input, i) => input.value = payouts[i] || 0);
        
        document.getElementById('moneyLeft').value = moneyLeft;
        document.getElementById('roundingSelect').value = rounding;
        document.getElementById('icmChipChopSlider').value = icmPercentage;
        updateSliderLabel();

        calculateAll(); // Auto-run calculations when loaded from a shared link
    }
}

// Run this when the page loads
window.onload = loadSharedData;

function toggleResults() {
    let showChipChop = document.getElementById("showChipChop").checked;
    let showMixed = document.getElementById("showMixed").checked;

    document.getElementById("chipChopResultsContainer").style.display = showChipChop ? "block" : "none";
    document.getElementById("mixedResultsContainer").style.display = showMixed ? "block" : "none";
    document.getElementById("sliderContainer").style.display = showMixed ? "block" : "none";

    calculateAll();
}