function openPlanSetupModal() {
    // Changed from 'master-breed-search' to 'breed-search' to match breedingchangesv7.html
    const name = document.getElementById('breed-search').value.trim();
    if (!TEM_DATABASE[name]) return alert("Select a valid target species from the search box first.");
    
    document.getElementById('planTargetSpecies').value = name;
    
    const container = document.getElementById('plan-egg-moves-selection');
    container.innerHTML = '';
    
    const familyName = TEM_DATABASE[name].family || name;
    let eggMoves = typeof FAMILY_DATA !== 'undefined' ? (FAMILY_DATA[familyName] || []) : [];
    
    if (eggMoves.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:#888; grid-column: span 2;">No egg moves found for family</span>';
    } else {
        eggMoves = [...eggMoves].sort((a, b) => a.localeCompare(b));
        eggMoves.forEach(move => {
            container.innerHTML += `
                <label style="display:flex; align-items:center; gap:6px; margin:2px 0;">
                    <input type="checkbox" class="plan-move-checkbox" value="${move}"> 
                    <span style="font-size:11px;">${move}</span>
                </label>`;
        });
    }
    document.getElementById('planSetupModal').style.display = 'block';
}

function closePlanSetupModal() {
    document.getElementById('planSetupModal').style.display = 'none';
}

function findMoveSourceInInventory(move, targetSpecies) {
    const targetTypes = TEM_DATABASE[targetSpecies].type;
    const activeInventory = JSON.parse(localStorage.getItem('breeding_stock') || '[]').filter(s => !s.isLuma);

    // Tier 1: Direct match in compatible type inventory
    for (let stock of activeInventory) {
        if (stock.name === "Mimit") continue;
        const stockTypes = TEM_DATABASE[stock.name]?.type || [];
        const matchesType = stockTypes.some(t => targetTypes.includes(t));
        
        if (matchesType) {
            const hasMoveDirect = (stock.parentMoves || []).includes(move) || (stock.eggMoves || []).includes(move);
            if (hasMoveDirect && stock.gender === 'Male') {
                return { status: "Available", card: stock, detail: `Direct parent: ${stock.name} ♂` };
            }
        }
    }

    // Tier 2: Search database configurations for family tree data
    for (let speciesName in TEM_DATABASE) {
        const dbEntry = TEM_DATABASE[speciesName];
        if (dbEntry.parent_moves?.includes(move) || FAMILY_DATA[dbEntry.family]?.includes(move)) {
            const sharesTypeWithTarget = dbEntry.type.some(t => targetTypes.includes(t));
            if (sharesTypeWithTarget) {
                return { status: "Missing", detail: `Requires Male ${speciesName} (Shares type & inherits move natively)` };
            }
        }
    }

    // Tier 3: Intermediary Bridge Validation
    for (let speciesName in TEM_DATABASE) {
        const bridgeEntry = TEM_DATABASE[speciesName];
        if (bridgeEntry.parent_moves?.includes(move)) {
            for (let innerName in TEM_DATABASE) {
                const vectorEntry = TEM_DATABASE[innerName];
                const matchesBridge = vectorEntry.type.some(t => bridgeEntry.type.includes(t));
                const matchesTarget = vectorEntry.type.some(t => targetTypes.includes(t));
                if (matchesBridge && matchesTarget) {
                    return { status: "Bridge Required", detail: `Cross-Type vector: Breed Male ${speciesName} with Female ${innerName} line.` };
                }
            }
        }
    }
    return { status: "Unavailable", detail: "No programmatic inheritance vector found in data maps." };
}

function generateCalculatedPlan() {
    const species = document.getElementById('planTargetSpecies').value;
    const targetPhase = parseInt(document.getElementById('planTargetPhase').value);
    const selectedMoves = Array.from(document.querySelectorAll('.plan-move-checkbox:checked')).map(cb => cb.value);

    const newPlan = {
        id: 'plan_' + Date.now(),
        species: species,
        phase: targetPhase,
        targetMoves: selectedMoves,
        createdAt: new Date().toLocaleDateString()
    };

    // Use window scope to match app_logic declaration
    window.breedingPlans.push(newPlan);
    localStorage.setItem('breeding_plans', JSON.stringify(window.breedingPlans));
    closePlanSetupModal();
    renderPlans();
    showView('plans-view', document.getElementById('nav-plans'));
}

function getMatchingStock(species, stat, genderRequirement) {
    const stock = JSON.parse(localStorage.getItem('breeding_stock') || '[]').filter(s => !s.isLuma);
    const targetTypes = TEM_DATABASE[species]?.type || [];
    const correctStatCards = stock.filter(s => s.svs.includes(stat));

    for (let item of correctStatCards) {
        if (item.name === "Mimit") continue;
        const itemTypes = TEM_DATABASE[item.name]?.type || [];
        const isCompatible = itemTypes.some(t => targetTypes.includes(t));
        
        if (isCompatible) {
            if (item.name === species && item.gender === genderRequirement) return item;
            if (item.gender === genderRequirement) return item; 
        }
    }

    const availableMimits = correctStatCards.filter(s => s.name === "Mimit");
    if (availableMimits.length > 0) {
        return { ...availableMimits[0], isMimitPlaceholder: true };
    }

    return null;
}

function renderPlans() {
    const container = document.getElementById('plans-container');
    if (!container) return;
    container.innerHTML = '';

    if (!window.breedingPlans || window.breedingPlans.length === 0) {
        container.innerHTML = '<div style="color:#888; padding:20px;">No calculation profiles currently configured. Search a species in the Breeding Lab to establish one.</div>';
        return;
    }

    window.breedingPlans.forEach(plan => {
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.style.minWidth = '420px';
        card.style.background = '#1e1e1e';
        card.style.border = '1px solid #333';
        card.style.borderRadius = '8px';
        card.style.padding = '15px';

        let moveEvaluationHtml = '';
        if (plan.targetMoves && plan.targetMoves.length > 0) {
            moveEvaluationHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #2a2a2a; padding-bottom:8px;">
                <div style="font-size:11px; color:#aaa; font-weight:bold; margin-bottom:4px;">GENETIC MOVE CHECKLIST:</div>`;
            plan.targetMoves.forEach(move => {
                const lookup = findMoveSourceInInventory(move, plan.species);
                const color = lookup.status === "Available" ? "#2ecc71" : "#e74c3c";
                moveEvaluationHtml += `<div style="font-size:11px; margin-bottom:2px; display:flex; justify-content:space-between;">
                    <span style="color:#fff;">✨ ${move}</span>
                    <span style="color:${color}; font-size:10px;">${lookup.detail}</span>
                </div>`;
            });
            moveEvaluationHtml += `</div>`;
        }

        let processingHtml = '';
        const p = plan.phase;

        const buildBlock = (title, statA, statB, defaultGenderA, defaultGenderB) => {
            const cardA = getMatchingStock(plan.species, statA, defaultGenderA);
            const cardB = getMatchingStock(plan.species, statB, defaultGenderB);

            let statusColor = "#2ecc71";
            let message = "Ready to pair";
            
            if (!cardA || !cardB) {
                statusColor = "#e74c3c";
                let missingText = [];
                if (!cardA) missingText.push(`Missing ${statA}`);
                if (!cardB) missingText.push(`Missing ${statB}`);
                message = missingText.join(' & ');
            } else {
                const computedFert = Math.min(cardA.fert, cardB.fert) - 1;
                message = `Valid Pair (Est. Child Fert: ${computedFert}/8)`;
                if (computedFert < 0) {
                    statusColor = "#e67e22";
                    message = `Fertility Drain Hazard (Child at ${computedFert})`;
                }
            }

            return `
                <div style="background:#252525; padding:8px; border-radius:4px; margin-bottom:8px; border-left:4px solid ${statusColor};">
                    <div style="font-size:11px; font-weight:bold; display:flex; justify-content:space-between; color:#fff;">
                        <span>${title}</span>
                        <span style="color:${statusColor}; font-size:10px;">${message}</span>
                    </div>
                    <div style="font-size:10px; color:#aaa; margin-top:4px; display:flex; justify-content:space-between;">
                        <span>Left Parent: ${cardA ? `${cardA.name} (${cardA.isMimitPlaceholder ? 'Mimit Substitution' : cardA.gender}) [Fert:${cardA.fert}]` : `None (Need ${statA})`}</span>
                        <span>Right Parent: ${cardB ? `${cardB.name} (${cardB.isMimitPlaceholder ? 'Mimit Substitution' : cardB.gender}) [Fert:${cardB.fert}]` : `None (Need ${statB})`}</span>
                    </div>
                </div>`;
        };

        if (p >= 1) {
            processingHtml += `<div class="plan-step-header" style="font-size:12px; font-weight:bold; color:var(--primary); margin-top:10px; margin-bottom:6px;">PHASE 1 MILESTONES:</div>`;
            processingHtml += buildBlock("ATK + SPATK Execution", "ATK", "SPATK", "Male", "Female");
            processingHtml += buildBlock("HP + STA Execution (Line Alpha)", "HP", "STA", "Male", "Female");
            processingHtml += buildBlock("HP + STA Execution (Line Beta)", "HP", "STA", "Female", "Male");
            processingHtml += buildBlock("DEF + SPDEF Execution", "DEF", "SPDEF", "Male", "Female");
        }

        if (p >= 2) {
            processingHtml += `<div class="plan-step-header" style="font-size:12px; font-weight:bold; color:var(--primary); margin-top:10px; margin-bottom:6px;">PHASE 2 MILESTONES:</div>`;
            processingHtml += buildBlock("3SV Left: (ATK/SPATK) + SPD", "ATK", "SPD", "Male", "Female");
            processingHtml += buildBlock("3SV Center: (HP/STA Alpha) + SPD", "HP", "SPD", "Male", "Female");
            processingHtml += buildBlock("3SV Right: (DEF/SPDEF) + SPD", "DEF", "SPD", "Male", "Female");
        }

        if (p >= 3) {
            processingHtml += `<div class="plan-step-header" style="font-size:12px; font-weight:bold; color:var(--primary); margin-top:10px; margin-bottom:6px;">PHASE 3 MILESTONES:</div>`;
            processingHtml += buildBlock("5SV Left Segment Generation", "ATK", "HP", "Male", "Female");
            processingHtml += buildBlock("5SV Right Segment Generation", "DEF", "HP", "Male", "Female");
        }

        if (p >= 4) {
            processingHtml += `<div class="plan-step-header" style="font-size:12px; font-weight:bold; color:#2ecc71; margin-top:10px; margin-bottom:6px;">FINAL PHASE: 7SV SPECIMEN</div>`;
            processingHtml += buildBlock(`Perfect 7SV ${plan.species} Assembly`, "ATK", "DEF", "Male", "Female");
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:8px; margin-bottom:10px;">
                <h3 style="margin:0; font-size:16px; color:#fff;">${plan.species}</h3>
                <button class="delete-btn" onclick="deletePlan('${plan.id}')" style="margin:0; background:none; border:none; color:#e74c3c; cursor:pointer; font-size:12px;">Delete Profile</button>
            </div>
            <div style="font-size:11px; color:#888; margin-bottom:10px;">Calculated up through Target Phase ${p} | Profile Created: ${plan.createdAt}</div>
            ${moveEvaluationHtml}
            ${processingHtml}
        `;
        container.appendChild(card);
    });
}

function deletePlan(id) {
    window.breedingPlans = window.breedingPlans.filter(p => p.id !== id);
    localStorage.setItem('breeding_plans', JSON.stringify(window.breedingPlans));
    renderPlans();
}