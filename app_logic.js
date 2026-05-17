// --- APPLICATION PERSISTENCE & HANDLERS (app_logic.js) ---

let ftData = JSON.parse(localStorage.getItem('ft_data') || '[]');
let ftActiveIdx = parseInt(localStorage.getItem('ft_active_idx') || '0');
let ftStartTime = localStorage.getItem('ft_start_time') ? parseInt(localStorage.getItem('ft_start_time')) : null;
let ftClockInterval = null;

let breedingStock = JSON.parse(localStorage.getItem('breeding_stock') || '[]');
let editingStockId = null; 

let breedingPlans = JSON.parse(localStorage.getItem('breeding_plans') || '[]');
let miscTasks = JSON.parse(localStorage.getItem('misc_tasks') || '[]');
let isBreedingFiltered = false;

function initPersistence() {
    populateDatalist();
    renderDex();
    document.querySelectorAll('.save-state, .save-state-perm').forEach(cb => {
        cb.checked = localStorage.getItem(cb.id) === 'true';
        cb.onchange = () => localStorage.setItem(cb.id, cb.checked);
    });
    renderMisc();
    renderBreedingStock();
    renderPlans();

    if (ftData && ftData.length > 0) {
        document.getElementById('ft-status').innerText = "Status: Restored";
        document.getElementById('ft-setup').style.display = 'none';
        document.getElementById('ft-main').style.display = 'block';
        startClock(); 
        renderFTTabs();
        updateFTUI();
    }
}

function populateDatalist() {
    const list = document.getElementById('temList');
    if(!list) return;
    Object.keys(TEM_DATABASE).forEach(name => {
        let opt = document.createElement('option');
        opt.value = name;
        list.appendChild(opt);
    });
}

function getTypeIcons(typeArray) {
    if (!typeArray) return "";
    return typeArray.map(t => `<img src="icons/${t.toLowerCase()}.png" class="type-icon" title="${t}" alt="${t}">`).join('');
}

function startFreeTem() {
    const names = document.querySelectorAll('.tem-name');
    const goals = document.querySelectorAll('.tem-goal');
    ftData = [];
    names.forEach((n, i) => {
        if(n.value.trim() !== "" && goals[i].value > 0) {
            ftData.push({ 
                name: n.value, goal: parseInt(goals[i].value), count: 0, 
                startCount: 0, firstCatchAmt: 0, times: [], lastSpan: "--:--" 
            });
        }
    });
    if(ftData.length === 0) return alert("Enter species and goal.");
    saveFTState();
    document.getElementById('ft-setup').style.display = 'none';
    document.getElementById('ft-main').style.display = 'block';
    renderFTTabs();
    updateFTUI();
}

function startClock() {
    if (!ftClockInterval) {
        ftClockInterval = setInterval(() => {
            if(!ftStartTime) return;
            const elapsed = Math.floor((Date.now() - ftStartTime) / 1000);
            const clock = document.getElementById('live-clock');
            if(clock) clock.innerText = `${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}`;
        }, 1000);
    }
}

function logFT(amt) {
    const now = Date.now();
    let cur = ftData[ftActiveIdx];
    if(cur.count >= cur.goal) return;

    if (ftStartTime && (now - ftStartTime > 3600000)) {
        cur.times = []; cur.startCount = cur.count; cur.lastSpan = "--:--"; cur.firstCatchAmt = 0;
    }

    if (cur.times.length === 0) {
        cur.startCount = cur.count; cur.firstCatchAmt = amt; startClock();
    } else {
        const diff = Math.floor((now - ftStartTime) / 1000);
        cur.lastSpan = `${Math.floor(diff/60).toString().padStart(2,'0')}:${(diff%60).toString().padStart(2,'0')}`;
    }

    cur.count += amt;
    if(cur.count > cur.goal) cur.count = cur.goal;
    cur.times.push(now);
    ftStartTime = now;
    saveFTState();
    updateFTUI();
}

function saveFTState() {
    localStorage.setItem('ft_data', JSON.stringify(ftData));
    localStorage.setItem('ft_active_idx', ftActiveIdx);
    if (ftStartTime) localStorage.setItem('ft_start_time', ftStartTime.toString());
}

function resetFreeTemTracker() {
    if(confirm("Clear current session?")) {
        localStorage.removeItem('ft_data'); localStorage.removeItem('ft_active_idx'); localStorage.removeItem('ft_start_time');
        location.reload();
    }
}

function updateFTUI() {
    let cur = ftData[ftActiveIdx];
    if (!cur) return;
    const perc = (cur.count / cur.goal) * 100;
    document.getElementById('cur-tem').innerText = cur.name;
    document.getElementById('ft-count').innerText = `${cur.count} / ${cur.goal} (${perc.toFixed(1)}%)`;
    document.getElementById('ft-progress').style.width = perc + '%';
    document.getElementById('last-span').innerText = cur.lastSpan;
    if(cur.times.length >= 2) {
        const totalSec = (cur.times[cur.times.length-1] - cur.times[0]) / 1000;
        const caught = cur.count - (cur.startCount + cur.firstCatchAmt);
        const avg = totalSec / (caught || 1);
        const m = Math.floor(avg / 60), s = Math.floor(avg % 60);
        document.getElementById('ft-avg').innerText = m > 0 ? `${m}m ${s}s` : `${s}s`;
        const rem = cur.goal - cur.count;
        const finish = new Date(Date.now() + (avg * rem * 1000));
        document.getElementById('ft-finish').innerText = finish.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

function renderFTTabs() {
    const container = document.getElementById('tab-container');
    if(!container) return;
    container.innerHTML = '';
    ftData.forEach((d, i) => {
        const t = document.createElement('div');
        t.className = `tab ${i === ftActiveIdx ? 'active' : ''}`;
        t.innerText = d.name;
        t.onclick = () => { ftActiveIdx = i; saveFTState(); renderFTTabs(); updateFTUI(); };
        container.appendChild(t);
    });
}

function populateModalMoves(name) {
    const eggContainer = document.getElementById('modal-egg-moves');
    eggContainer.innerHTML = '';
    const familyName = TEM_DATABASE[name] ? TEM_DATABASE[name].family : name;
    let eggMoves = typeof FAMILY_DATA !== 'undefined' ? (FAMILY_DATA[familyName] || []) : [];
    
    if (eggMoves.length === 0) {
        eggContainer.innerHTML = '<span style="font-size:11px; color:#888; grid-column: span 2;">None available</span>';
    } else {
        eggMoves = [...eggMoves].sort((a, b) => a.localeCompare(b));
        eggMoves.forEach(move => {
            eggContainer.innerHTML += `<label><input type="checkbox" class="egg-move-check" value="${move}"> <span style="font-size:11px;">${move}</span></label>`;
        });
    }

    const parentContainer = document.getElementById('modal-parent-moves');
    parentContainer.innerHTML = '';
    let parentMoves = TEM_DATABASE[name] ? TEM_DATABASE[name].parent_moves || [] : [];
    if (parentMoves.length === 0) {
        parentContainer.innerHTML = '<span style="font-size:11px; color:#888; grid-column: span 2;">None available</span>';
    } else {
        parentMoves = [...parentMoves].sort((a, b) => a.localeCompare(b));
        parentMoves.forEach(move => {
            parentContainer.innerHTML += `<label><input type="checkbox" class="parent-move-check" value="${move}"> <span style="font-size:11px;">${move}</span></label>`;
        });
    }
}

function updateAutoFertility() {
    const checkedCount = document.querySelectorAll('.sv-check:checked').length;
    let calculatedFert = 8 - Math.floor(checkedCount / 2);
    if (checkedCount === 1) {
        calculatedFert = 7;
    } else if (checkedCount > 1) {
        calculatedFert = 8 - Math.floor((checkedCount + 1) / 2);
    }
    document.getElementById('breed-fert').value = Math.max(0, Math.min(8, calculatedFert));
}

function renderLumaCheckbox(isChecked) {
    const container = document.getElementById('modal-luma-container');
    if (!container) return;
    container.innerHTML = `
        <div style="margin: 5px 0 15px 0; background: #252525; padding: 10px; border-radius: 6px; border: 1px solid #333;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #fff; font-weight: bold; font-size: 13px; margin: 0; text-transform: none;">
                <input type="checkbox" id="breed-luma" ${isChecked ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer; margin: 0;"> 
                 ✨ Luma Variant
            </label>
        </div>
    `;
}

function openBreedingModal() {
    editingStockId = null; 
    const name = document.getElementById('master-breed-search').value.trim();
    if (!TEM_DATABASE[name]) return alert("Select a valid species.");
    
    document.getElementById('modalTemName').innerText = name;
    document.getElementById('breed-gender').value = 'Male';
    document.getElementById('breed-fert').value = 8;
    
    renderLumaCheckbox(false);
    populateModalMoves(name);
    document.querySelectorAll('.sv-check, .egg-move-check, .parent-move-check').forEach(cb => cb.checked = false);
    
    document.querySelectorAll('.sv-check').forEach(cb => {
        cb.onchange = updateAutoFertility;
    });
    document.getElementById('breedingModal').style.display = "block";
}

function editStock(id) {
    const stock = breedingStock.find(s => s.id === id);
    if (!stock) return;
    editingStockId = id; 
    
    document.getElementById('modalTemName').innerText = stock.name;
    document.getElementById('breed-gender').value = stock.gender;
    document.getElementById('breed-fert').value = stock.fert;
    
    renderLumaCheckbox(stock.isLuma || false);
    populateModalMoves(stock.name);
    
    document.querySelectorAll('.sv-check').forEach(cb => { cb.checked = stock.svs.includes(cb.value); });
    document.querySelectorAll('.egg-move-check').forEach(cb => { cb.checked = (stock.eggMoves || []).includes(cb.value); });
    document.querySelectorAll('.parent-move-check').forEach(cb => { cb.checked = (stock.parentMoves || []).includes(cb.value); });
    
    document.querySelectorAll('.sv-check').forEach(cb => {
        cb.onchange = updateAutoFertility;
    });
    document.getElementById('breedingModal').style.display = "block";
}

function closeModal() {
    editingStockId = null;
    document.getElementById('breedingModal').style.display = "none";
}

function saveBreedingStock() {
    const name = document.getElementById('modalTemName').innerText;
    const svs = Array.from(document.querySelectorAll('.sv-check:checked')).map(cb => cb.value);
    const eggMoves = Array.from(document.querySelectorAll('.egg-move-check:checked')).map(cb => cb.value);
    const parentMoves = Array.from(document.querySelectorAll('.parent-move-check:checked')).map(cb => cb.value);
    const gender = document.getElementById('breed-gender').value;
    const fert = parseInt(document.getElementById('breed-fert').value) || 0;
    
    const lumaCheckbox = document.getElementById('breed-luma');
    const isLuma = lumaCheckbox ? lumaCheckbox.checked : false;

    if (editingStockId) {
        const index = breedingStock.findIndex(s => s.id === editingStockId);
        if (index > -1) {
            breedingStock[index] = { ...breedingStock[index], gender, fert, eggMoves, parentMoves, svs, isLuma };
        }
        editingStockId = null; 
    } else {
        breedingStock.push({ id: Date.now(), name, gender, fert, eggMoves, parentMoves, svs, isLuma });
    }

    localStorage.setItem('breeding_stock', JSON.stringify(breedingStock));
    renderBreedingStock(); 
    closeModal();
    
    if (isBreedingFiltered) toggleBreedingFilter();
}

function deleteStock(id) {
    breedingStock = breedingStock.filter(s => s.id !== id);
    localStorage.setItem('breeding_stock', JSON.stringify(breedingStock));
    renderBreedingStock();
}

function renderBreedingStock() {
    const list = document.getElementById('breeding-stock-list');
    list.innerHTML = '';
    breedingStock.forEach(s => {
        const item = document.createElement('div');
        item.className = 'stock-item';
        
        const eMoves = s.eggMoves || [];
        const pMoves = s.parentMoves || [];
        const types = TEM_DATABASE[s.name] ? TEM_DATABASE[s.name].type : [];
        
        let lumaIconHtml = s.isLuma ? '<img src="icons/luma.png" class="type-icon" title="Luma" alt="Luma" style="margin-right: 6px;">' : '';
        const typeHtml = '<span class="type-container">' + lumaIconHtml + getTypeIcons(types) + '</span>';

        const eMovesHtml = eMoves.length > 0 ? eMoves.map(m => `<span class="sv-tag" style="background:#3498db; margin-top: 2px;">${m}</span>`).join(' ') : '<span style="font-size:10px; color:#666;">None</span>';
        const pMovesHtml = pMoves.length > 0 ? pMoves.map(m => `<span class="sv-tag" style="background:#3498db; margin-top: 2px;">${m}</span>`).join(' ') : '<span style="font-size:10px; color:#666;">None</span>';

        item.innerHTML = [
            '<button class="delete-btn" onclick="editStock(' + s.id + ')" style="position:absolute; right:75px; top:15px; color:#3498db; font-weight:bold;">Edit</button>',
            '<button class="delete-btn" onclick="deleteStock(' + s.id + ')" style="position:absolute; right:15px; top:15px;">Remove</button>',
            '<h4 style="margin: 0 0 10px 0; font-size: 16px;" class="stock-title">' + s.name + ' (' + (s.gender === 'Male' ? '♂' : '♀') + ')' + typeHtml + '</h4>',
            '<div class="stock-details">',
                '<div style="font-size: 13px; color: #aaa; margin-bottom: 8px;">Fertility: ' + s.fert + '/8</div>',
                '<div style="margin: 5px 0 12px 0;">' + s.svs.map(sv => '<span class="sv-tag" style="background: #444; font-weight: bold;">' + sv + '</span>').join('') + '</div>',
                '<div style="margin-top:10px; border-top:1px solid #333; padding-top:8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">',
                    '<div>',
                        '<div style="font-size:10px; color:var(--primary); font-weight:bold; margin-bottom: 4px; letter-spacing: 0.5px;">EGG MOVES</div>',
                        '<div style="display: flex; flex-wrap: wrap; gap: 4px;">' + eMovesHtml + '</div>',
                    '</div>',
                    '<div>',
                        '<div style="font-size:10px; color:var(--primary); font-weight:bold; margin-bottom: 4px; letter-spacing: 0.5px;">PARENT MOVES</div>',
                        '<div style="display: flex; flex-wrap: wrap; gap: 4px;">' + pMovesHtml + '</div>',
                    '</div>',
                '</div>',
            '</div>'
        ].join('');

        list.appendChild(item);
    });
}

function toggleBreedingFilter() {
    const query = document.getElementById('master-breed-search').value.trim().toLowerCase();
    const cards = document.querySelectorAll('#breeding-stock-list .stock-item');
    const filterBtn = document.getElementById('breedFilterBtn');

    if (!query && !isBreedingFiltered) {
        alert("Please type a species name into the field to filter your active cards.");
        return;
    }

    if (!isBreedingFiltered) {
        cards.forEach(card => {
            const titleText = card.querySelector('.stock-title').innerText.toLowerCase();
            if (titleText.includes(query)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        filterBtn.innerText = "Show All";
        filterBtn.style.backgroundColor = "#e67e22"; 
        isBreedingFiltered = true;
    } else {
        cards.forEach(card => card.style.display = '');
        filterBtn.innerText = "Filter View";
        filterBtn.style.backgroundColor = "#2ecc71"; 
        isBreedingFiltered = false;
    }
}

function renderDex() {
    const tbody = document.getElementById('dex-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let displayIndex = 0;
    let lastBaseName = '';

    Object.keys(TEM_DATABASE).forEach((name) => {
        const baseName = name.split(' (')[0];
        if (baseName !== lastBaseName) {
            displayIndex++;
            lastBaseName = baseName;
        }
        const num = displayIndex.toString().padStart(3, '0');
        const id = name.toLowerCase().replace(/\s/g, '').replace(/[()]/g, ''); 
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${num} ${name}</td>
            <td><input type="checkbox" class="save-state-perm" id="c_${id}"></td>
            <td><input type="checkbox" class="save-state-perm" id="l_${id}"></td>
            <td><input type="checkbox" class="save-state-perm" id="u_${id}"></td>
            <td><input type="checkbox" class="save-state-perm" id="p_${id}"></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterDex() {
    const query = document.getElementById('dex-search').value.toLowerCase();
    document.querySelectorAll('#dex-body tr').forEach(row => {
        row.style.display = row.cells[0].innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function addMiscTask() {
    const input = document.getElementById('misc-input');
    if (!input.value.trim()) return;
    miscTasks.push({ id: 'm_' + Date.now(), text: input.value, checked: false });
    localStorage.setItem('misc_tasks', JSON.stringify(miscTasks));
    input.value = '';
    renderMisc();
}

function toggleMisc(id) {
    const task = miscTasks.find(t => t.id === id);
    if (task) { task.checked = !task.checked; localStorage.setItem('misc_tasks', JSON.stringify(miscTasks)); }
}

function deleteMisc(id) {
    miscTasks = miscTasks.filter(t => t.id !== id);
    localStorage.setItem('misc_tasks', JSON.stringify(miscTasks));
    renderMisc();
}

function renderMisc() {
    const list = document.getElementById('misc-list');
    if (!list) return;
    list.innerHTML = '';
    miscTasks.forEach(t => {
        const item = document.createElement('div');
        item.className = 'check-item';
        item.innerHTML = `
            <input type="checkbox" ${t.checked ? 'checked' : ''} onchange="toggleMisc('${t.id}')">
            <span>${t.text}</span>
            <button class="delete-btn" onclick="deleteMisc('${t.id}')">Remove</button>
        `;
        list.appendChild(item);
    });
}

function showView(viewId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    el.classList.add('active');
}

function checkWeeklyReset() {
    const now = new Date();
    const lastReset = localStorage.getItem('lastResetDate');
    const day = now.getDay(); 
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    if (!lastReset || new Date(lastReset) < startOfWeek) {
        document.querySelectorAll('.save-state').forEach(cb => {
            cb.checked = false;
            localStorage.setItem(cb.id, false);
        });
        localStorage.setItem('lastResetDate', startOfWeek.toISOString());
    }
}