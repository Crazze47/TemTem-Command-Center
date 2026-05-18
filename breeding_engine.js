// --- CALCULATED BREEDING PLANS ENGINE (breeding_engine.js) ---

function openPlanSetupModal() {
    // Ensure the target array is initialized safely
    if (!window.breedingPlans) {
        window.breedingPlans = JSON.parse(localStorage.getItem('breeding_plans') || '[]');
    }

    // SAFE SELECTION: Try 'breed-search' first, fall back to 'master-breed-search' if null
    let searchInput = document.getElementById('breed-search') || document.getElementById('master-breed-search');
    
    // If neither element exists, alert clearly instead of crashing the page
    if (!searchInput) {
        return alert("Developer Error: Could not find the search input element in the HTML layout (checked 'breed-search' and 'master-breed-search').");
    }

    const name = searchInput.value.trim();
    if (!TEM_DATABASE[name]) return alert("Select a valid target species from the search box first.");
    
    document.getElementById('planTargetSpecies').value = name;
    
    const container = document.getElementById('plan-egg-moves-selection');
    container.innerHTML = '';
    
    const familyName = TEM_DATABASE[name].family || name;
    let eggMoves = typeof FAMILY_DATA !== 'undefined' ? (FAMILY_DATA[familyName] || []) : [];
    
    if (window.breedingPlans.length === 0) {
        // Safe check code...
    }

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

    for (let speciesName in TEM_DATABASE) {
        const dbEntry = TEM_DATABASE[speciesName];
        if (dbEntry.parent_moves?.includes(move) || FAMILY_DATA[dbEntry.family]?.includes(move)) {
            const sharesTypeWithTarget = dbEntry.type.some(t => targetTypes.includes(t));
            if (sharesTypeWithTarget) {
                return { status: "Missing", detail: `Requires Male ${speciesName} (Shares type & inherits move natively)` };
            }
        }
    }

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
    if (!window.breedingPlans) {
        window.breedingPlans = JSON.parse(localStorage.getItem('breeding_plans') || '[]');
    }

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

    window.breedingPlans.push(newPlan);
    localStorage.setItem('breeding_plans', JSON.stringify(window.breedingPlans));
    closePlanSetupModal();
    renderPlans();
    showView('plans-view', document.getElementById('nav-plans'));
}

function getMatchingStock(species, stat, genderRequirement, remainingMoves = []) {
    const stock = JSON.parse(localStorage.getItem('breeding_stock') || '[]').filter(s => !s.isLuma);
    const targetTypes = TEM_DATABASE[species]?.type || [];
    const correctStatCards = stock.filter(s => s.svs.includes(stat));
    
    // Determine the base family of the target species
    const targetFamily = TEM_DATABASE[species]?.family || species;

    // Helper to strictly enforce Temtem breeding gender & family rules
    const isStrictlyValid = (item) => {
        if (item.name === "Mimit") return false; 
        
        const itemTypes = TEM_DATABASE[item.name]?.type || [];
        const isCompatible = itemTypes.some(t => targetTypes.includes(t));

        if (!isCompatible || item.gender !== genderRequirement) return false;

        // The female determines the egg species line.
        // Check if the female belongs to the exact same evolutionary family.
        const itemFamily = TEM_DATABASE[item.name]?.family || item.name;
        if (genderRequirement === 'Female' && itemFamily !== targetFamily) return false;

        return true;
    };

    // 1. Prioritize finding a host that has both the required SV AND an unassigned Egg Move
    for (let item of correctStatCards) {
        if (isStrictlyValid(item)) {
            const itemMoves = [...(item.eggMoves || []), ...(item.parentMoves || [])];
            const matchingMoves = remainingMoves.filter(m => itemMoves.includes(m));
            
            if (matchingMoves.length > 0) {
                return { ...item, consumedMoves: matchingMoves }; 
            }
        }
    }

    // 2. Fallback: Find ANY valid card with the SV (standard pass)
    for (let item of correctStatCards) {
        if (isStrictlyValid(item)) {
            return item;
        }
    }

    // 3. Final Fallback: Mimit Substitution (Mimits bypass standard gender/species locks)
    const availableMimits = correctStatCards.filter(s => s.name === "Mimit");
    if (availableMimits.length > 0) {
        return { ...availableMimits[0], isMimitPlaceholder: true };
    }

    return null;
}

function renderPlans() {
    if (!window.breedingPlans) {
        window.breedingPlans = JSON.parse(localStorage.getItem('breeding_plans') || '[]');
    }

    const container = document.getElementById('plans-container');
    if (!container) return;
    container.innerHTML = '';

    if (window.breedingPlans.length === 0) {
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

        let remainingMoves = [...(plan.targetMoves || [])];

        let moveEvaluationHtml = '';
        if (plan.targetMoves && plan.targetMoves.length > 0) {
            moveEvaluationHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #2a2a2a; padding-bottom:8px;">
                <div style="font-size:11px; color:#aaa; font-weight:bold; margin-bottom:4px;">GENETIC SOURCE CHECKLIST (INVENTORY):</div>`;
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
            const cardA = getMatchingStock(plan.species, statA, defaultGenderA, remainingMoves);
            if (cardA && cardA.consumedMoves) {
                remainingMoves = remainingMoves.filter(m => !cardA.consumedMoves.includes(m));
            }
            
            const cardB = getMatchingStock(plan.species, statB, defaultGenderB, remainingMoves);
            if (cardB && cardB.consumedMoves) {
                remainingMoves = remainingMoves.filter(m => !cardB.consumedMoves.includes(m));
            }

            let statusColor = "#2ecc71";
            let message = "Ready to pair";
            
            if (!cardA || !cardB) {
                statusColor = "#e74c3c";
                message = "Missing Required Parents";
            } else {
                const computedFert = Math.min(cardA.fert, cardB.fert) - 1;
                message = `Valid Pair (Est. Child Fert: ${computedFert}/8)`;
                if (computedFert < 0) {
                    statusColor = "#e67e22";
                    message = `Fertility Drain Hazard (Child at ${computedFert})`;
                }
            }

            // HTML Generator for Mini Vault Cards
            const renderMiniCard = (stockCard, requiredStat, requiredGender) => {
                if (stockCard) {
                    // Render Found Parent
                    const svTags = stockCard.svs.map(sv => `<span style="background:#444; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:bold; color:#fff; border:1px solid #555;">${sv}</span>`).join('');
                    const genderIcon = stockCard.isMimitPlaceholder ? '🧬 (Mimit)' : (stockCard.gender === 'Male' ? '♂' : '♀');
                    const moveAlert = stockCard.consumedMoves ? `<div style="color:#f1c40f; font-size:9px; font-weight:bold; margin-top:6px; background:#f1c40f20; padding:3px; border-radius:3px;">✨ Injects: ${stockCard.consumedMoves.join(', ')}</div>` : '';
                    
                    return `
                        <div style="background:#1a1a1a; border:1px solid #444; border-radius:5px; padding:8px; display:flex; flex-direction:column;">
                            <div style="font-weight:bold; color:#fff; font-size:12px; margin-bottom:4px; display:flex; justify-content:space-between;">
                                <span>${stockCard.name}</span>
                                <span style="color:#aaa;">${genderIcon}</span>
                            </div>
                            <div style="font-size:10px; color:#888; margin-bottom:6px;">Fert: ${stockCard.fert}/8</div>
                            <div style="display:flex; flex-wrap:wrap; gap:3px;">${svTags}</div>
                            ${moveAlert}
                        </div>`;
                } else {
                    // Render Missing Parent Slot
                    return `
                        <div style="background:rgba(231, 76, 60, 0.05); border:1px dashed #e74c3c; border-radius:5px; padding:8px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                            <div style="color:#e74c3c; font-weight:bold; font-size:11px; margin-bottom:4px;">⚠️ Missing Parent</div>
                            <div style="color:#aaa; font-size:10px; margin-bottom:4px;">Requires: ${requiredGender}</div>
                            <span style="background:#e74c3c; color:#fff; padding:2px 5px; border-radius:3px; font-size:9px; font-weight:bold;">Needs ${requiredStat} SV</span>
                        </div>`;
                }
            };

            return `
                <div style="background:#252525; padding:8px; border-radius:6px; margin-bottom:12px; border-left:4px solid ${statusColor}; border-top:1px solid #333; border-right:1px solid #333; border-bottom:1px solid #333;">
                    <div style="font-size:11px; font-weight:bold; display:flex; justify-content:space-between; color:#fff; margin-bottom:8px;">
                        <span>${title}</span>
                        <span style="color:${statusColor}; font-size:10px;">${message}</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        ${renderMiniCard(cardA, statA, defaultGenderA)}
                        ${renderMiniCard(cardB, statB, defaultGenderB)}
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

        if (remainingMoves.length > 0) {
            processingHtml += `
                <div style="background:#e67e2220; border:1px solid #e67e22; padding:8px; border-radius:4px; margin-top:10px;">
                    <div style="font-size:11px; font-weight:bold; color:#e67e22;">⚠️ Pre-Breeding Required!</div>
                    <div style="font-size:10px; color:#ccc; margin-top:4px;">
                        The following moves are not present on any of your assigned SV parents: <b style="color:#fff;">${remainingMoves.join(', ')}</b>.<br>
                        You must breed these moves onto a 1SV base parent before they can be safely injected into this tree.
                    </div>
                </div>`;
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
    if (!window.breedingPlans) {
        window.breedingPlans = JSON.parse(localStorage.getItem('breeding_plans') || '[]');
    }
    window.breedingPlans = window.breedingPlans.filter(p => p.id !== id);
    localStorage.setItem('breeding_plans', JSON.stringify(window.breedingPlans));
    renderPlans();
}