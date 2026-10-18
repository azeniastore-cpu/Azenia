document.addEventListener("DOMContentLoaded", () => {
    const savedUser = sessionStorage.getItem("azenia_logged_user");
    if (savedUser) {
        document.getElementById("adminLoginScreen").style.display = "none";
        yetkileriUygula(savedUser);
    }
});

function firebaseLogin() {
    const userInput = document.getElementById("loginUser").value.trim().toLowerCase();
    const passInput = document.getElementById("loginPass").value;
    const errorEl = document.getElementById("loginError");

    if (!userInput || !passInput) {
        errorEl.innerText = "Lütfen alanları doldurun!";
        errorEl.style.display = "block";
        return;
    }

    const fakeEmail = userInput + "@azeniastore.com";

    firebase.auth().signInWithEmailAndPassword(fakeEmail, passInput)
        .then((userCredential) => {
            sessionStorage.setItem("azenia_logged_user", userInput);
            document.getElementById("adminLoginScreen").style.display = "none";
            yetkileriUygula(userInput);
        })
        .catch((error) => {
            errorEl.innerText = "Hatalı kullanıcı adı veya şifre!";
            errorEl.style.display = "block";
            setTimeout(() => { errorEl.style.display = "none"; }, 3000);
        });
}

function yetkileriUygula(username) {
    if (!username.includes("admin")) {
        const ayarlarSekmesi = document.querySelector('[data-tab="tabAyarlar"]');
        if (ayarlarSekmesi) ayarlarSekmesi.style.display = "none";
    } else {
        const linkInput = document.getElementById("adminLinkInputGroup");
        const linkBtn = document.getElementById("adminLinkToggleBtn");
        if (linkInput) linkInput.classList.remove("hidden");
        if (linkBtn) linkBtn.classList.remove("hidden");
    }
}

document.getElementById("loginPass").addEventListener("keypress", function(event) {
    if (event.key === "Enter") { firebaseLogin(); }
});

const firebaseConfig = {
    apiKey: "AIzaSyCqNlKNZAqp2R7EFYin95UY67xp3WikVvA",
    authDomain: "azenia-stok-d5896.firebaseapp.com",
    projectId: "azenia-stok-d5896",
    storageBucket: "azenia-stok-d5896.firebasestorage.app",
    messagingSenderId: "200511374655",
    appId: "1:200511374655:web:947f20ca18e9aef4003f8a"
};

const IMGBB_API_KEY = "794223bd269bc70ed757a5af6b695c94";
let currentImgbbUrl = "";

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let catalog = [];
let orders = [];
let materials = [];
let customers = [];
let settings = { hourlyRate: 5 };
let tempReqMaterials = [];
let isLinksVisible = false;

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    const colorClass = type === "error" ? "bg-rose-600 border-rose-400" : type === "warning" ? "bg-amber-500 border-amber-300 text-slate-900" : "bg-indigo-600 border-indigo-400";
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl text-white text-xs font-bold flex items-center gap-2 transition ${colorClass}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3400);
}

function toggleModelLinks() {
    isLinksVisible = !isLinksVisible;
    renderVitrin();
}

async function deleteCatalogProduct(id) {
    if(!confirm("Bu ürünü katalogdan TAMAMEN silmek istediğinize emin misiniz?")) return;
    try { await db.collection('guven3d_urunler').doc(id).delete(); showToast("Ürün silindi!", "warning"); } catch(e) { showToast("Hata!", "error"); }
}
async function deleteOrder(id) {
    if(!confirm("Bu siparişi silmek istediğinize emin misiniz?")) return;
    try { await db.collection('guven3d_siparisler').doc(id).delete(); showToast("Sipariş silindi!", "warning"); } catch(e) { showToast("Hata!", "error"); }
}
async function deleteMaterial(id) {
    if(!confirm("Bu filamenti tamamen silmek istediğinize emin misiniz?")) return;
    try { await db.collection('guven3d_filamentler').doc(id).delete(); showToast("Filament silindi!", "warning"); } catch(e) { showToast("Hata!", "error"); }
}
async function deleteCustomer(id) {
    if(!confirm("Bu müşteriyi rehberden silmek istediğinize emin misiniz?")) return;
    try { await db.collection('guven3d_musteriler').doc(id).delete(); showToast("Müşteri silindi!", "warning"); } catch(e) { showToast("Hata!", "error"); }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const preview = document.getElementById('imgPreview');
    if (preview) preview.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-2xl text-indigo-500"></i>';
    const formData = new FormData();
    formData.append("image", file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const data = await response.json();
        if (data && data.success) {
            currentImgbbUrl = data.data.url;
            if (preview) preview.innerHTML = `<img src="${currentImgbbUrl}" class="w-full h-full object-cover">`;
            showToast("Görsel yüklendi!");
        } else {
            showToast("Görsel yüklenemedi", "error");
            if (preview) preview.innerHTML = '<i class="fa-solid fa-camera text-2xl text-slate-400"></i>';
        }
    } catch (error) {
        showToast("ImgBB bağlantı hatası", "error");
        if (preview) preview.innerHTML = '<i class="fa-solid fa-camera text-2xl text-slate-400"></i>';
    }
}

function initApp() {
    db.collection('guven3d_urunler').onSnapshot((snapshot) => {
        catalog = [];
        snapshot.forEach(doc => catalog.push({ id: doc.id, ...doc.data() }));
        renderVitrin(); updateDashboardStats();
    });
    db.collection('guven3d_siparisler').orderBy('date', 'desc').onSnapshot((snapshot) => {
        orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
        renderOrders(); updateDashboardStats();
    });
    db.collection('guven3d_filamentler').onSnapshot((snapshot) => {
        materials = [];
        snapshot.forEach(doc => materials.push({ id: doc.id, ...doc.data() }));
        if(tempReqMaterials.length === 0 && materials.length > 0) tempReqMaterials = [{ id: materials[0].id, weight: 25, name: materials[0].name }];
        renderMaterials(); renderReqMaterialRows(); updateDashboardStats();
    });
    db.collection('guven3d_musteriler').onSnapshot((snapshot) => {
        customers = [];
        snapshot.forEach(doc => customers.push({ id: doc.id, ...doc.data() }));
        renderCustomers(); populateOrderFormSelects();
    });

    const dot = document.getElementById("cloudStatusDot");
    const txt = document.getElementById("cloudStatusText");
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 inline-block";
    if (txt) txt.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span><span class="text-emerald-400">Sistem %100 Buluta Bağlı</span>';
}

function navSwitch(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) { btn.classList.add('active'); btn.classList.remove('text-slate-300'); } 
        else { btn.classList.remove('active'); btn.classList.add('text-slate-300'); }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveCatalogProduct() {
    const pName = document.getElementById('prodName').value.trim();
    const pDesc = document.getElementById('prodDesc').value.trim();
    const pTags = document.getElementById('prodTags').value.trim();
    const pCat = document.getElementById('prodCategory').value;
    const pFinalPrice = document.getElementById('prodFinalPrice').value;
    const pStockCount = parseInt(document.getElementById('prodStockCount').value, 10) || 0;
    
    const hours = parseFloat(document.getElementById('prodPrintTime').value) || 0;
    const mins = parseFloat(document.getElementById('prodPrintTimeMin').value) || 0;
    const pPrintTime = hours + (mins / 60);
    const pModelLink = document.getElementById('prodModelLink') ? document.getElementById('prodModelLink').value.trim() : "";

    if (!pName || !pFinalPrice) { showToast("Ürün Adı ve Fiyat zorunlu!", "error"); return; }

    const cleanReqMats = tempReqMaterials.filter(item => item.id && Number(item.weight) > 0);
    const computedCost = calculateCurrentRecipeCost();

    const newProduct = {
        name: pName, description: pDesc, tags: pTags, category: pCat, image: currentImgbbUrl, 
        sellPrice: parseFloat(pFinalPrice), stockCount: pStockCount, time: pPrintTime, 
        reqMaterials: cleanReqMats, costProfile: computedCost, modelLink: pModelLink, dateAdded: new Date().toISOString()
    };

    try {
        await db.collection('guven3d_urunler').add(newProduct);
        showToast("Ürün buluta kaydedildi!");
        document.getElementById('prodName').value = ''; document.getElementById('prodDesc').value = '';
        document.getElementById('prodTags').value = ''; document.getElementById('prodFinalPrice').value = '';
        document.getElementById('prodPrintTime').value = '1'; document.getElementById('prodPrintTimeMin').value = '0';
        if(document.getElementById('prodModelLink')) document.getElementById('prodModelLink').value = '';
        currentImgbbUrl = ""; document.getElementById('imgPreview').innerHTML = '<i class="fa-solid fa-camera text-2xl text-slate-400"></i>';
        navSwitch('tabVitrin');
    } catch (error) { showToast("Hata oluştu!", "error"); }
}

function renderVitrin() {
    const grid = document.getElementById('vitrinGrid');
    if (!grid) return;
    if (document.getElementById('badgeCatalogCount')) document.getElementById('badgeCatalogCount').textContent = catalog.length;
    
    const searchVal = (document.getElementById('vitrinSearchInput')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('vitrinCategoryFilter')?.value || 'Tümü';

    const filtered = catalog.filter(item => {
        const matchesCat = catVal === 'Tümü' || item.category === catVal;
        const matchesSearch = !searchVal || item.name.toLowerCase().includes(searchVal) || (item.tags && item.tags.toLowerCase().includes(searchVal));
        return matchesCat && matchesSearch;
    });

    populateOrderFormSelects();

    if (filtered.length === 0) { grid.innerHTML = `<div class="col-span-full text-center p-10 text-slate-400">Ürün bulunamadı.</div>`; return; }

    const currentUser = sessionStorage.getItem("azenia_logged_user") || "";
    const isAdmin = currentUser.includes("admin");

    grid.innerHTML = filtered.map((prod) => {
        const unitCost = Number(prod.costProfile || 0);
        const sellPrice = Number(prod.sellPrice || 0);
        const netProfit = sellPrice - unitCost;
        const imgHtml = prod.image ? `<img src="${prod.image}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600"><i class="fa-solid fa-cube text-4xl"></i></div>`;
        
        const totalMins = Math.round((prod.time || 0) * 60);
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const timeStr = h > 0 ? `${h}s ${m}dk` : `${m}dk`;

        let adminControls = "";
        if (isAdmin) {
            const linkHtml = (prod.modelLink && isLinksVisible) ? `<a href="${prod.modelLink}" target="_blank" class="text-xs text-sky-400 hover:text-sky-300 underline font-bold"><i class="fa-solid fa-link"></i> Kaynak Linki</a>` : `<span class="text-[11px] text-slate-600 italic"><i class="fa-solid fa-eye-slash"></i> Link Gizli</span>`;
            adminControls = `
                <div class="flex items-center justify-between border-t border-slate-700/50 pt-2 mt-2">
                    ${prod.modelLink ? linkHtml : '<span class="text-[10px] text-slate-500">-</span>'}
                    <button onclick="deleteCatalogProduct('${prod.id}')" class="text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-2.5 py-1 rounded-md text-[11px] transition"><i class="fa-solid fa-trash"></i> Sil</button>
                </div>`;
        }

        return `
            <div class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between">
                <div>
                    <div class="relative h-48 bg-slate-950 overflow-hidden">
                        ${imgHtml}
                        <span class="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${Number(prod.stockCount) > 0 ? 'bg-emerald-500/90 text-slate-950' : 'bg-rose-600/90 text-white'}">Stok: ${Number(prod.stockCount || 0)}</span>
                    </div>
                    <div class="p-4 space-y-3">
                        <div class="flex justify-between">
                            <div><h3 class="text-base font-extrabold text-white">${prod.name}</h3><p class="text-[10px] text-indigo-300 mt-0.5"><i class="fa-regular fa-clock"></i> ${timeStr}</p></div>
                            <div class="text-lg font-extrabold text-emerald-400">₺${sellPrice.toFixed(0)}</div>
                        </div>
                        <div class="flex flex-wrap gap-1.5">${(prod.reqMaterials || []).map(rm => `<span class="text-[11px] bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-md text-slate-300">${rm.name}: <strong class="text-amber-300">${rm.weight}g</strong></span>`).join('')}</div>
                        <div class="bg-slate-900/90 rounded-xl p-2 flex justify-between text-xs"><span class="text-slate-400">Birim Kâr:</span><span class="font-extrabold text-sky-400">+₺${netProfit.toFixed(2)}</span></div>
                        ${adminControls}
                    </div>
                </div>
                <div class="p-3 bg-slate-900/60 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                    <button onclick="produceProductUnit('${prod.id}')" class="bg-indigo-600/20 text-indigo-300 font-bold text-xs py-2 rounded-xl transition flex justify-center gap-1.5"><i class="fa-solid fa-industry"></i> +1 Üret</button>
                    <button onclick="quickSellProduct('${prod.id}')" class="bg-emerald-600/20 text-emerald-300 font-bold text-xs py-2 rounded-xl transition flex justify-center gap-1.5"><i class="fa-solid fa-bolt"></i> Hızlı Sat</button>
                </div>
            </div>`;
    }).join('');
}

function renderReqMaterialRows() {
    const container = document.getElementById('reqMaterialsList');
    if (!container) return;
    container.innerHTML = tempReqMaterials.map((row, idx) => `
        <div class="flex items-center gap-2">
            <select class="req-mat-select flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" data-idx="${idx}">
                ${materials.map(m => `<option value="${m.id}" ${m.id === row.id ? 'selected' : ''}>${m.name} (Stok:${m.stock}g)</option>`).join('')}
            </select>
            <div class="w-20 relative">
                <input type="number" class="req-mat-weight w-full bg-slate-950 border border-slate-700 rounded-xl pl-2 pr-5 py-2 text-xs text-white" data-idx="${idx}" value="${row.weight}">
                <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">g</span>
            </div>
            <button type="button" onclick="removeReqMaterialRow(${idx})" class="bg-rose-600/20 text-rose-300 px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');

    container.querySelectorAll('.req-mat-select').forEach(sel => sel.addEventListener('change', (e) => {
        const chosen = materials.find(m => m.id === e.target.value);
        if(chosen) { tempReqMaterials[e.target.dataset.idx].id = chosen.id; tempReqMaterials[e.target.dataset.idx].name = chosen.name; }
        calculateCurrentRecipeCost();
    }));
    container.querySelectorAll('.req-mat-weight').forEach(inp => inp.addEventListener('input', (e) => {
        tempReqMaterials[e.target.dataset.idx].weight = parseFloat(e.target.value) || 0; calculateCurrentRecipeCost();
    }));
    calculateCurrentRecipeCost();
}
function removeReqMaterialRow(idx) { if (tempReqMaterials.length > 1) { tempReqMaterials.splice(idx, 1); renderReqMaterialRows(); } }

function calculateCurrentRecipeCost() {
    let filamentCost = 0;
    tempReqMaterials.forEach(item => { const mat = materials.find(m => m.id === item.id); if(mat) filamentCost += (Number(item.weight)||0) * (mat.price/1000); });
    const hours = parseFloat(document.getElementById('prodPrintTime')?.value || 0);
    const mins = parseFloat(document.getElementById('prodPrintTimeMin')?.value || 0);
    const machineCost = (hours + (mins / 60)) * settings.hourlyRate;
    const totalCost = filamentCost + machineCost;
    if (document.getElementById('calculatedCostDisplay')) document.getElementById('calculatedCostDisplay').textContent = `₺${totalCost.toFixed(2)}`;
    return Number(totalCost.toFixed(4));
}

async function produceProductUnit(prodId) {
    const prod = catalog.find(p => p.id === prodId);
    if (!prod) return;
    for (const req of (prod.reqMaterials || [])) {
        const mat = materials.find(m => m.id === req.id);
        if (mat && mat.stock < req.weight) { showToast(`${mat.name} stoğu yetersiz!`, "error"); return; }
    }
    try {
        for (const req of (prod.reqMaterials || [])) {
            const mat = materials.find(m => m.id === req.id);
            if (mat) await db.collection('guven3d_filamentler').doc(mat.id).update({ stock: mat.stock - req.weight });
        }
        await db.collection('guven3d_urunler').doc(prod.id).update({ stockCount: (prod.stockCount || 0) + 1 });
        showToast("Üretildi ve stoklar güncellendi!");
    } catch(e) { showToast("Üretim hatası", "error"); }
}

async function quickSellProduct(prodId) {
    const prod = catalog.find(p => p.id === prodId);
    if (!prod) return;
    try {
        if (prod.stockCount > 0) await db.collection('guven3d_urunler').doc(prod.id).update({ stockCount: prod.stockCount - 1 });
        const now = new Date();
        await db.collection('guven3d_siparisler').add({
            date: now.toISOString(), dateDisplay: `${now.getDate()} ${now.toLocaleString('tr-TR', { month: 'short' })}`,
            productName: prod.name, image: prod.image || "", customerId: "", platform: "Tekel / Elden",
            cost: Number(prod.costProfile || 0), sellPrice: Number(prod.sellPrice || 0), status: "Ödendi"
        });
        showToast("Satıldı, sipariş eklendi!");
    } catch(e) { showToast("Satış hatası", "error"); }
}

function populateOrderFormSelects() {
    const prodSel = document.getElementById('newOrderProductSelect');
    if (prodSel) prodSel.innerHTML = catalog.map(p => `<option value="${p.id}">${p.name} (₺${p.sellPrice})</option>`).join('');
    const firstProd = catalog[0];
    const priceInp = document.getElementById('newOrderPriceInput');
    if (firstProd && priceInp && !priceInp.value) priceInp.value = firstProd.sellPrice;
    const custSel = document.getElementById('newOrderCustomerSelect');
    if (custSel) custSel.innerHTML = `<option value="">Elden / Kayıtsız</option>` + customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function renderOrders() {
    const container = document.getElementById('ordersListContainer');
    if(document.getElementById('badgeOrderCount')) document.getElementById('badgeOrderCount').textContent = orders.length;
    if (!container) return;
    if (orders.length === 0) { container.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">Sipariş bulunamadı.</div>`; return; }

    container.innerHTML = orders.map(ord => {
        const profit = Number(ord.sellPrice || 0) - Number(ord.cost || 0);
        return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-slate-950 overflow-hidden border border-slate-800 hidden sm:block">
                        ${ord.image ? `<img src="${ord.image}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-600"><i class="fa-solid fa-cube"></i></div>`}
                    </div>
                    <div>
                        <div class="font-extrabold text-white text-sm">${ord.productName} <span class="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 rounded">${ord.platform}</span></div>
                        <div class="text-[11px] text-slate-400">${ord.dateDisplay}</div>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="text-right">
                        <div class="text-sm font-extrabold text-emerald-400">₺${Number(ord.sellPrice).toFixed(0)}</div>
                        <div class="text-[10px] text-sky-400">Kâr: +₺${profit.toFixed(2)}</div>
                    </div>
                    <button onclick="deleteOrder('${ord.id}')" class="text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-2 rounded-lg transition"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    }).join('');
}

function renderMaterials() {
    const container = document.getElementById('materialsGridContainer');
    if (!container) return;
    if (materials.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 text-xs text-slate-400">Kayıtlı filament bulunamadı.</div>`;
        return;
    }
    container.innerHTML = materials.map(mat => {
        const pct = Math.min(100, Math.max(0, Math.round((Number(mat.stock) / 1000) * 100)));
        const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-rose-500';
        return `
            <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 relative group">
                <button onclick="deleteMaterial('${mat.id}')" class="absolute top-2 right-2 text-rose-500/50 hover:text-rose-400 text-xs hidden group-hover:block"><i class="fa-solid fa-trash"></i></button>
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-sm font-bold text-white pr-4">${mat.name}</h4>
                        <p class="text-[11px] text-slate-400">Kg: ₺${mat.price}</p>
                    </div>
                    <span class="text-xs font-extrabold px-2 py-1 rounded-lg bg-slate-950 text-amber-400 border border-slate-800">${mat.stock}g</span>
                </div>
                <div class="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div class="${barColor} h-full transition-all" style="width: ${pct}%"></div>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <span class="text-[10px] text-slate-400">%${pct}</span>
                    <div class="flex gap-1">
                        <button onclick="updateMatStock('${mat.id}', -50)" class="bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-300">-50g</button>
                        <button onclick="updateMatStock('${mat.id}', 100)" class="bg-slate-800 px-2 py-1 rounded text-[10px] text-emerald-300">+100g</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}
async function updateMatStock(id, delta) {
    const mat = materials.find(m => m.id === id);
    if(mat) await db.collection('guven3d_filamentler').doc(id).update({ stock: Math.max(0, mat.stock + delta) });
}

function renderCustomers() {
    const container = document.getElementById('customersGridContainer');
    if (!container) return;
    if (customers.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 text-xs text-slate-400">Kayıtlı müşteri bulunamadı.</div>`;
        return;
    }
    container.innerHTML = customers.map(cust => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center group">
            <div>
                <span class="font-bold text-white text-sm">${cust.name}</span> <span class="text-[11px] text-sky-400 bg-sky-500/10 px-1.5 rounded">@${cust.nick}</span>
                <div class="text-[11px] text-slate-400 mt-1"><i class="fa-solid fa-phone text-[9px]"></i> ${cust.phone} • ${cust.platform}</div>
            </div>
            <button onclick="deleteCustomer('${cust.id}')" class="text-rose-500/50 hover:text-rose-400 px-2 py-1 rounded transition hidden group-hover:block"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

function updateDashboardStats() {
    document.getElementById('statTotalProducts').textContent = catalog.length;
    document.getElementById('statTotalStockUnits').textContent = catalog.reduce((acc, p) => acc + (p.stockCount||0), 0);
    const totalRev = orders.reduce((acc, o) => acc + (o.sellPrice||0), 0);
    const totalCost = orders.reduce((acc, o) => acc + (o.cost||0), 0);
    document.getElementById('statTotalRevenue').textContent = `₺${totalRev.toFixed(0)}`;
    document.getElementById('statTotalProfit').textContent = `₺${(totalRev - totalCost).toFixed(0)}`;
    document.getElementById('statOrderCountSub').textContent = `${orders.length} sipariş`;
    document.getElementById('statTotalFilamentGrams').textContent = `${materials.reduce((acc, m) => acc + (m.stock||0), 0)}g`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => navSwitch(btn.getAttribute('data-tab'))));
    document.getElementById('prodImageInput')?.addEventListener('change', handleImageUpload);
    document.getElementById('saveCatalogProductBtn')?.addEventListener('click', saveCatalogProduct);
    
    document.getElementById('calcPrice2xBtn')?.addEventListener('click', () => document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost()*2));
    document.getElementById('calcPrice3xBtn')?.addEventListener('click', () => document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost()*3));
    document.getElementById('calcPrice4xBtn')?.addEventListener('click', () => document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost()*4));
    
    document.getElementById('addReqMaterialRowBtn')?.addEventListener('click', () => {
        if(materials.length > 0) { tempReqMaterials.push({ id: materials[0].id, weight: 20, name: materials[0].name }); renderReqMaterialRows(); }
    });
    document.getElementById('prodPrintTime')?.addEventListener('input', calculateCurrentRecipeCost);
    document.getElementById('prodPrintTimeMin')?.addEventListener('input', calculateCurrentRecipeCost);

    document.getElementById('createOrderBtn')?.addEventListener('click', async () => {
        const prod = catalog.find(p => p.id === document.getElementById('newOrderProductSelect').value);
        if(!prod) return;
        await db.collection('guven3d_siparisler').add({
            date: new Date().toISOString(), dateDisplay: `${new Date().getDate()} ${new Date().toLocaleString('tr-TR', { month: 'short' })}`,
            productName: prod.name, image: prod.image || "", customerId: document.getElementById('newOrderCustomerSelect').value,
            platform: document.getElementById('newOrderPlatformSelect').value, cost: prod.costProfile||0, sellPrice: parseFloat(document.getElementById('newOrderPriceInput').value)||prod.sellPrice
        });
        showToast("Sipariş eklendi!"); document.getElementById('newOrderPriceInput').value = '';
    });

    document.getElementById('addMaterialBtn')?.addEventListener('click', async () => {
        await db.collection('guven3d_filamentler').add({
            name: document.getElementById('newMatName').value, stock: parseFloat(document.getElementById('newMatStock').value)||1000,
            price: parseFloat(document.getElementById('newMatPrice').value)||650
        });
        showToast("Filament eklendi!"); document.getElementById('newMatName').value = '';
    });

    document.getElementById('addCustomerBtn')?.addEventListener('click', async () => {
        await db.collection('guven3d_musteriler').add({
            name: document.getElementById('newCustName').value, nick: document.getElementById('newCustNick').value,
            phone: document.getElementById('newCustPhone').value, platform: document.getElementById('newCustPlatform').value
        });
        showToast("Müşteri eklendi!"); document.getElementById('newCustName').value=''; document.getElementById('newCustNick').value=''; document.getElementById('newCustPhone').value='';
    });

    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        settings.hourlyRate = parseFloat(document.getElementById('settingHourlyRate').value) || 5;
        calculateCurrentRecipeCost(); showToast("Ayarlar kaydedildi!");
    });

    document.getElementById('importJsonInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showToast("JSON verileri okunuyor, lütfen bekleyin...", "warning");
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if(parsed.orders) { parsed.orders.forEach(item => { const {id, ...rest} = item; db.collection('guven3d_siparisler').add(rest); }); }
                if(parsed.materials) { parsed.materials.forEach(item => { const {id, ...rest} = item; db.collection('guven3d_filamentler').add(rest); }); }
                if(parsed.customers) { parsed.customers.forEach(item => { const {id, ...rest} = item; db.collection('guven3d_musteriler').add(rest); }); }
                showToast("Eski veriler başarıyla BULUTA aktarıldı!");
            } catch (err) {
                showToast("Geçersiz JSON dosyası!", "error");
            }
        };
        reader.readAsText(file);
    });

    initApp();
});
