let isDarkMode = false;
const scenes = { scalar: null, vector: null };
const cameras = { scalar: null, vector: null };
const renderers = { scalar: null, vector: null };
const controls = { scalar: null, vector: null };
const groups = { scalar: new THREE.Group(), vector: new THREE.Group() };

let manualParticles = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Streamlines for manual particles (lines showing traced paths)
let streamlines = [];




const pointTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
})();

const PALETTES = {
    Viridis: [[0, 0xfde725], [0.2, 0x5ec962], [0.5, 0x21918c], [0.8, 0x3b528b], [1, 0x440154]],
    Hot: [[0, 0xffffff], [0.3, 0xffaa00], [0.6, 0xe60000], [1, 0x000000]],
    Cool: [[0, 0xff00ff], [0.5, 0x0000ff], [1, 0x00ffff]],
    Jet: [[0, 0x800000], [0.1, 0xff0000], [0.35, 0xffff00], [0.65, 0x00ffff], [0.85, 0x0000ff], [1, 0x00008f]],
    Sunset: [[0, 0xffd200], [1, 0xf7971e]]
};

// Core setup: scenes, cameras, renderers, controls

function getColor(t, scaleName) {
    const palette = PALETTES[scaleName] || PALETTES.Viridis;
    const rt = Math.max(0, Math.min(1, t));
    for(let i=0; i<palette.length-1; i++){
        if(rt >= palette[i][0] && rt <= palette[i+1][0]){
            const f = (rt - palette[i][0]) / (palette[i+1][0] - palette[i][0]);
            return new THREE.Color(palette[i][1]).lerp(new THREE.Color(palette[i+1][1]), f);
        }
    }
    return new THREE.Color(palette[palette.length-1][1]);
}

function initWorld(containerId, type) {
    const container = document.getElementById(containerId);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    const orbit = new THREE.OrbitControls(camera, renderer.domElement);
    scene.add(new THREE.AxesHelper(5));
    scene.add(new THREE.GridHelper(10, 10, 0xcccccc, 0xeeeeee));
    scene.add(new THREE.AmbientLight(0xffffff, 0.7)); 
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);
    scene.add(groups[type]);
    scenes[type] = scene; cameras[type] = camera; renderers[type] = renderer; controls[type] = orbit;
}

// Scalar field rendering (1D line, 2D surface, or 3D scatter)

function renderScalar() {
    groups.scalar.clear();
    const expr = document.getElementById("scalar").value;
    const palette = document.getElementById("colorScale").value;
    const dotSize = parseFloat(document.getElementById("markerSize").value);
    
    // Marker density for 3D scatter
    const mDensInput = document.getElementById("markerDensity");
    const scatterDens = mDensInput ? parseInt(mDensInput.value) : 25;

    const range = 4;
    const hasY = expr.includes('y'), hasZ = expr.includes('z');
    let minV = Infinity, maxV = -Infinity;

    try {
        if (!hasY && !hasZ) {
            const pts = [];
            for(let x=-range; x<=range; x+=0.1) {
                let v = math.evaluate(expr, {x, y:0, z:0});
                pts.push(new THREE.Vector3(x, v, 0));
                minV = Math.min(minV, v); maxV = Math.max(maxV, v);
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const cols = [];
            pts.forEach(p => {
                const c = getColor((p.y-minV)/(maxV-minV||1), palette);
                cols.push(c.r, c.g, c.b);
            });
            geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
            groups.scalar.add(new THREE.Line(geo, new THREE.LineBasicMaterial({vertexColors: true, linewidth: 3})));
        } else if (!hasZ) {
            const dens = 50;
            const geo = new THREE.PlaneGeometry(range*2, range*2, dens, dens);
            geo.rotateX(-Math.PI/2);
            const pos = geo.attributes.position.array;
            const vals = [];
            for(let i=0; i<pos.length; i+=3) {
                let v = math.evaluate(expr, {x:pos[i], y:pos[i+2], z:0});
                pos[i+1] = v; vals.push(v);
                minV = Math.min(minV, v); maxV = Math.max(maxV, v);
            }
            const cols = new Float32Array(pos.length);
            for(let i=0; i<vals.length; i++) {
                const c = getColor((vals[i]-minV)/(maxV-minV||1), palette);
                cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            geo.computeVertexNormals();
            groups.scalar.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({vertexColors:true, side:THREE.DoubleSide})));
        } else {
            // 3D scatter plot using marker density slider
            const step = (range * 2) / scatterDens; 
            const positions = [];
            const rawValues = [];

            for (let x = -range; x <= range; x += step) {
                for (let y = -range; y <= range; y += step) {
                    for (let z = -range; z <= range; z += step) {
                        let v = math.evaluate(expr, { x, y, z });
                        minV = Math.min(minV, v);
                        maxV = Math.max(maxV, v);
                        
                                    // Map math coordinates to Three.js: (x, z, -y)
                        positions.push(x, z, -y);
                        rawValues.push(v);
                    }
                }
            }

            const colors = [];
            for (let i = 0; i < rawValues.length; i++) {
                const color = getColor((rawValues[i] - minV) / (maxV - minV || 1), palette);
                colors.push(color.r, color.g, color.b);
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            // Points material: textured sprites with per-point colors
            const pointsMat = new THREE.PointsMaterial({
                size: dotSize,
                map: pointTexture,
                vertexColors: true,
                transparent: true,
                alphaTest: 0.5,
                sizeAttenuation: true
            });

            groups.scalar.add(new THREE.Points(geo, pointsMat));
        }
    } catch(e) { console.error(e); }
    updateLegend('scalarLegend', minV, maxV, palette);
}

// Vector field rendering: arrows on a grid
function renderVector() {
    groups.vector.clear();
    const expr = document.getElementById("vector").value;
    const palette = document.getElementById("colorScale").value;
    const dens = parseInt(document.getElementById("density").value);
    const size = parseFloat(document.getElementById("arrowSize").value);
    const parts = expr.replace(/[\[\]\s]/g, "").split(",");
    const range = 4, step = (range*2)/dens;
    let maxMag = 0; const vectors = [];
    for(let x=-range; x<=range; x+=step) {
        for(let y=(parts.length > 1 ? -range : 0); y<=(parts.length > 1 ? range : 0); y+=step) {
            for(let z=(parts.length > 2 ? -range : 0); z<=(parts.length > 2 ? range : 0); z+=step) {
                try {
                    const u = math.evaluate(parts[0] || "0", {x,y,z});
                    const v = parts.length > 1 ? math.evaluate(parts[1], {x,y,z}) : 0;
                    const w = parts.length > 2 ? math.evaluate(parts[2], {x,y,z}) : 0;
                    const mag = Math.sqrt(u*u + v*v + w*w);
                    maxMag = Math.max(maxMag, mag);
                    // Keep math -> Three.js axis mapping consistent with scalar renderer
                    // (stored so plotting and particle advection align)
                    vectors.push({x, y: z, z: y, u, v: w, w: v, mag});
                } catch(e){}
            }
        }
    }
    vectors.forEach(v => {
        if(v.mag === 0) return;
        const color = getColor(v.mag/(maxMag||1), palette);
        groups.vector.add(new THREE.ArrowHelper(new THREE.Vector3(v.u, v.v, v.w).normalize(), new THREE.Vector3(v.x, v.y, v.z), size, color.getHex(), size*0.2, size*0.2));
    });
    updateLegend('vectorLegend', 0, maxMag, palette);
}




// UI helpers and DOM bindings

function updateLegend(id, min, max, paletteName) {
    const el = document.getElementById(id);
    const palette = [...PALETTES[paletteName]];
    const grad = palette.map((p, i) => `#${new THREE.Color(p[1]).getHexString()} ${(i/(palette.length-1))*100}%`).join(',');
    el.className = "absolute top-4 right-4 z-20 adaptive-legend p-2 rounded-xl flex items-center gap-3 shadow-lg transition-colors";
    el.innerHTML = `<span class="text-[11px] font-black">${min === Infinity ? 0 : min.toFixed(1)}</span><div class="w-20 h-2.5 rounded-full border border-black/10" style="background:linear-gradient(to right, ${grad})"></div><span class="text-[11px] font-black">${max === -Infinity ? 0 : max.toFixed(1)}</span>`;
}
function updateLabels(type) {
    const container = document.getElementById(type + 'Cont');
    const camera = cameras[type];
    if (!container || !camera) return;

    let yLabelText = "Z"; 
    let is3DScalar = false;

    // Determine if we are in 3D Scalar mode
    if (type === 'scalar') {
        const expr = document.getElementById("scalar").value;
        const hasY = expr.includes('y'), hasZ = expr.includes('z');
        
        if (!hasY && !hasZ) {
            yLabelText = "f(x)";
        } else if (!hasZ) {
            yLabelText = "f(x,y)";
        } else {
            // It contains 'z', so it is the 3D point cloud
            is3DScalar = true;
        }
    }

    // Set Y label position: use -5 for 3D scalar, otherwise use 5
    const depthPos = (type === 'scalar' && is3DScalar) ? -5 : 5;

    const labels = [
        { id: type + '-lx', pos: [5, 0, 0], txt: 'X', col: '#ef4444' }, 
        { id: type + '-ly', pos: [0, 5, 0], txt: yLabelText, col: '#10b981' }, 
        { id: type + '-lz', pos: [0, 0, depthPos], txt: 'Y', col: '#3b82f6' }
    ];

    labels.forEach(l => {
        let el = document.getElementById(l.id);
        if (!el) { 
            el = document.createElement('div'); 
            el.id = l.id; 
            el.className = 'absolute pointer-events-none axis-label z-50 transition-colors'; 
            container.appendChild(el); 
        }
        const vec = new THREE.Vector3(...l.pos).project(camera);
        if (vec.z > 1) { el.style.display = 'none'; return; }
        el.style.display = 'block';
        el.style.left = `${(vec.x + 1) * container.clientWidth / 2}px`;
        el.style.top = `${-(vec.y - 1) * container.clientHeight / 2}px`;
        el.style.color = l.col;
        el.style.borderColor = l.col;
        el.style.backgroundColor = isDarkMode ? '#1e293b' : '#ffffff';
        el.innerText = l.txt;
    });
}
function toggleFullScreen(id) {
    const el = document.getElementById(id);
    el.classList.toggle('fullscreen-mode');
    setTimeout(() => {
        const k = id.includes('scalar') ? 'scalar' : 'vector';
        const plot = document.getElementById(k + 'Plot');
        cameras[k].aspect = plot.clientWidth / plot.clientHeight;
        cameras[k].updateProjectionMatrix();
        renderers[k].setSize(plot.clientWidth, plot.clientHeight);
    }, 200);
}

function updatePlot() {
    document.getElementById('densityVal').innerText = document.getElementById('density').value;
    document.getElementById('arrowSizeVal').innerText = document.getElementById('arrowSize').value;
    document.getElementById('markerSizeVal').innerText = document.getElementById('markerSize').value;
    
    // Update marker density display
    const mDens = document.getElementById('markerDensity');
    if(mDens) document.getElementById('markerDensityVal').innerText = mDens.value;

    if(document.getElementById('flowSpeedVal')) {
        document.getElementById('flowSpeedVal').innerText = document.getElementById('flowSpeed').value;
    }
    renderScalar(); renderVector();
}

function animate() {
    requestAnimationFrame(animate);
    ['scalar', 'vector'].forEach(k => {
        if(controls[k]) controls[k].update();
        if(renderers[k]) renderers[k].render(scenes[k], cameras[k]);
        updateLabels(k);
    });
    updateParticles(); // Animate particles and update any traces
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    
    // Update the button icon
    const themeBtn = document.getElementById('themeBtn');
    themeBtn.innerText = isDarkMode ? "☀️" : "🌙";

    // Update the scene background colors
    ['scalar', 'vector'].forEach(k => {
        if (scenes[k]) {
            scenes[k].background.setHex(isDarkMode ? 0x0f172a : 0xffffff);
        }
    });
}
// Particle flow: automated particle clouds + user-dropped particles

let isFlowing = false;
let particleGroup = new THREE.Group();
const MAX_PARTICLES = 400;
const particles = [];

function initParticles() {
    if (particles.length > 0) return;
    scenes.vector.add(particleGroup);
    const pGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.8 });
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const mesh = new THREE.Mesh(pGeo, pMat.clone());
        resetParticle(mesh);
        particleGroup.add(mesh);
        particles.push(mesh);
    }
}

function resetParticle(p) {
    const range = 4;
    p.position.set((Math.random() - 0.5) * range * 2, (Math.random() - 0.5) * range * 2, (Math.random() - 0.5) * range * 2);
    p.life = Math.random() * 60 + 40;
}

function updateParticles() {
    if (!isFlowing && manualParticles.length === 0) return;

    const expr = document.getElementById("vector").value;
    const parts = expr.replace(/[\[\]\s]/g, "").split(",");
    const dof = parts.length;
    const h = parseFloat(document.getElementById('flowSpeed')?.value || 1.0) * 0.02; // Time step

    // Update automated flow particles (if bulk flow is enabled)
    if (isFlowing) {
        particles.forEach(p => {
            try {
                const lifeRatio = p.life / 100;
                let pColor = isDarkMode ? 
                    new THREE.Color().lerpColors(new THREE.Color(0x475569), new THREE.Color(0xf8fafc), lifeRatio) : 
                    new THREE.Color().lerpColors(new THREE.Color(0x1e293b), new THREE.Color(0x4f46e5), lifeRatio);
                p.material.color.copy(pColor);

                // Midpoint (RK2) integration for smoother advection
                let scope1 = { x: p.position.x, y: p.position.z, z: p.position.y };
                let vx1 = math.evaluate(parts[0] || "0", scope1);
                let vy1 = dof > 1 ? math.evaluate(parts[1], scope1) : 0;
                let vz1 = dof > 2 ? math.evaluate(parts[2], scope1) : 0;

                let midX = p.position.x + vx1 * (h / 2);
                let midY = p.position.z + vy1 * (h / 2);
                let midZ = p.position.y + vz1 * (h / 2);

                let scope2 = { x: midX, y: midY, z: midZ };
                let vx2 = math.evaluate(parts[0] || "0", scope2);
                let vy2 = dof > 1 ? math.evaluate(parts[1], scope2) : 0;
                let vz2 = dof > 2 ? math.evaluate(parts[2], scope2) : 0;

                p.position.x += vx2 * h;
                if (dof > 1) p.position.z += vy2 * h;
                if (dof > 2) p.position.y += vz2 * h;

                if (dof === 1) { p.position.z = 0; p.position.y = 0; }
                if (dof === 2) { p.position.y = 0; }

                p.life--;
                p.material.opacity = lifeRatio * (isDarkMode ? 0.8 : 0.9);

                if (p.life <= 0 || Math.abs(p.position.x) > 5 || Math.abs(p.position.y) > 5 || Math.abs(p.position.z) > 5) {
                    resetParticle(p);
                }
            } catch (e) { p.life = 0; }
        });
    }

    // Update manual particles (also using midpoint integration)
    manualParticles.forEach((p) => {
        try {
            let scope1 = { x: p.position.x, y: p.position.z, z: p.position.y };
            let vx1 = math.evaluate(parts[0] || "0", scope1);
            let vy1 = parts.length > 1 ? math.evaluate(parts[1], scope1) : 0;
            let vz1 = parts.length > 2 ? math.evaluate(parts[2], scope1) : 0;

            let midX = p.position.x + vx1 * (h / 2);
            let midY = p.position.z + vy1 * (h / 2);
            let midZ = p.position.y + vz1 * (h / 2);

            let scope2 = { x: midX, y: midY, z: midZ };
            let vx2 = math.evaluate(parts[0] || "0", scope2);
            let vy2 = parts.length > 1 ? math.evaluate(parts[1], scope2) : 0;
            let vz2 = parts.length > 2 ? math.evaluate(parts[2], scope2) : 0;

            p.position.x += vx2 * h;
            if (parts.length > 1) p.position.z += vy2 * h;
            if (parts.length > 2) p.position.y += vz2 * h;

         if (p.streamline && p.pathPoints.length < 500) {
             // Append new point to the particle's trace and update the line geometry
             p.pathPoints.push(p.position.clone());
             p.streamline.geometry.setFromPoints(p.pathPoints);
         }


           
        } catch (e) { }
    });
}

function spawnManualParticle(x, y, z) {
    const isTraceEnabled = document.getElementById('enableTrace').checked;
    
    // Create the particle mesh at the requested coordinates
    const pGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const pMat = new THREE.MeshPhongMaterial({ 
        color: isTraceEnabled ? 0x6366f1 : 0xff3366, 
        emissive: isTraceEnabled ? 0x6366f1 : 0xff0000, 
        emissiveIntensity: 0.5 
    });
    const mesh = new THREE.Mesh(pGeo, pMat);
    // Note: coordinate mapping aligns with visualization convention (x, z, y)
    mesh.position.set(x, z, y);
    
    // Initialize a streamline (trace) if tracing is enabled
    if (isTraceEnabled) {
        const lineMat = new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.6 });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([mesh.position.clone()]);
        const line = new THREE.Line(lineGeo, lineMat);
        
        mesh.streamline = line; // Attach line reference to the particle
        mesh.pathPoints = [mesh.position.clone()]; // Store history of positions
        scenes.vector.add(line);
        streamlines.push(line);
    }

    scenes.vector.add(mesh);
    manualParticles.push(mesh);
}



function handleVectorClick(event) {
    const container = document.getElementById('vectorCont');
    const rect = container.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, cameras.vector);
    
    // Find the intersection with the grid helper or a hidden plane
    // For simplicity, we'll assume placement on the X-Y plane (Z=0 in Three.js)
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersectPoint);
    
    if (intersectPoint) {
        // Update UI inputs to reflect click position
        document.getElementById('manualX').value = intersectPoint.x.toFixed(1);
        document.getElementById('manualY').value = intersectPoint.z.toFixed(1);
        document.getElementById('manualZ').value = intersectPoint.y.toFixed(1);
        
        spawnManualParticle(intersectPoint.x, intersectPoint.z, intersectPoint.y);
    }
}



function toggleModal() {
    const modal = document.getElementById('infoModal');
    modal.classList.toggle('hidden');
}

// Close modal if user clicks outside the box
window.onclick = function(event) {
    const modal = document.getElementById('infoModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
    }
}



function getSimulationState() {
    return {
        scalarField: document.getElementById("scalar")?.value,
        vectorField: document.getElementById("vector")?.value,
        density: document.getElementById("density")?.value,
        arrowSize: document.getElementById("arrowSize")?.value,
        flowSpeed: document.getElementById("flowSpeed")?.value,
        traceEnabled: document.getElementById("enableTrace")?.checked,
        manualParticles: manualParticles.map(p => ({
            x: p.position.x.toFixed(2),
            y: p.position.z.toFixed(2),
            z: p.position.y.toFixed(2)
        }))
    };
}

window.puterReady = false;
window.puterConnecting = false;

function connectPuterAI() {
    if (window.puterReady || window.puterConnecting) return;

    window.puterConnecting = true;

    puter.auth.signIn()
        .then(() => {
        window.puterReady = true;

        // Save login permanently
        localStorage.setItem("puter_signed_in", "true");

        console.log("Puter AI connected");
        })  
    .catch(() => {
            console.warn("User did not sign in");
            localStorage.removeItem("puter_signed_in");
        })
        .finally(() => {
            window.puterConnecting = false;
        });
}


// =======================
// LOCAL SAVE SYSTEM
// =======================

// Encode state to URL-safe string
function encodeState(obj) {
    return btoa(encodeURIComponent(JSON.stringify(obj)));
}

// Decode from URL
function decodeState(str) {
    return JSON.parse(decodeURIComponent(atob(str)));
}

// Save locally
function saveSimulation(name) {
    if (!name) return alert("Enter a name");
    const state = getSimulationState();
    localStorage.setItem("dozer_" + name, JSON.stringify(state));
    alert("Saved locally!");
}

// Load locally
function loadSimulation(name) {
    const txt = localStorage.getItem("dozer_" + name);
    if (!txt) return alert("Not found");

    const s = JSON.parse(txt);
    applySimulation(s);
}

// Share by link
function shareSimulation() {
    const state = getSimulationState();
    const encoded = encodeState(state);
    const url = `${location.origin}${location.pathname}?s=${encoded}`;
    prompt("Share this link:", url);
}

// Apply simulation to UI
function applySimulation(s) {
    document.getElementById("scalar").value = s.scalarField;
    document.getElementById("vector").value = s.vectorField;
    document.getElementById("density").value = s.density;
    document.getElementById("arrowSize").value = s.arrowSize;
    document.getElementById("flowSpeed").value = s.flowSpeed;
    document.getElementById("enableTrace").checked = s.traceEnabled;

    updatePlot();
}

function refreshLoadMenu() {
  const menu = document.getElementById("loadMenu");
  menu.innerHTML = "";

  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith("dozer_"))
    .sort();

  if (keys.length === 0) {
    menu.innerHTML = `<div class="px-4 py-3 text-slate-400 text-sm">No saved simulations</div>`;
    return;
  }

  keys.forEach(k => {
    const name = k.replace("dozer_", "");

    const row = document.createElement("div");
    row.className = "save-row";

    const left = document.createElement("div");
    left.className = "save-name";
    left.innerText = name;
    left.onclick = () => {
      loadSimulation(name);
      menu.classList.add("hidden");
    };

    const del = document.createElement("button");
    del.className = "save-del";
    del.innerHTML = "✕";
    del.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${name}"?`)) {
        localStorage.removeItem("dozer_" + name);
        refreshLoadMenu();
      }
    };

    row.appendChild(left);
    row.appendChild(del);
    menu.appendChild(row);
  });
}






// --- Initialization & Event Listeners ---

window.onload = async () => {

    if (localStorage.getItem("puter_signed_in") === "true") {
        window.puterReady = true;
        connectPuterAI();
    } else {
        window.puterReady = false;
    }

   

    initWorld('scalarPlot', 'scalar');
    initWorld('vectorPlot', 'vector');

    

const gMsg = document.getElementById("gMessages");
const gIn = document.getElementById("gInput");
const gSend = document.getElementById("gSend");
gIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();     // prevent new line
        gSend.click();          // trigger send
    }
});



const chatBox = document.getElementById("geminiChat");
const toggleBtn = document.getElementById("chatToggle");

toggleBtn.onclick = (e) => {
  e.stopPropagation();

  const wasMinimized = chatBox.classList.contains("minimized");
  chatBox.classList.toggle("minimized");

  // If user is opening the chat for first time → connect AI
  if (wasMinimized && !window.puterReady) {
      connectPuterAI();
  }
};

chatBox.onclick = () => {
  if (chatBox.classList.contains("minimized")) {
    chatBox.classList.remove("minimized");
    if (!window.puterReady) {
        connectPuterAI();
    }
  }
};



function add(text, cls){
  const d = document.createElement("div");
  d.className = cls;
  d.innerText = text;
  gMsg.appendChild(d);
  gMsg.scrollTop = gMsg.scrollHeight;
}

gSend.onclick = async () => {
    const userText = gIn.value.trim();
    if (!userText) return;
    gIn.value = "";

    // 1. Add your message
    add(userText, "g-user");


    // 2. Add the "Thinking..." bubble and keep a reference to it
        const thinking = document.createElement("div");
        thinking.className = "g-ai";
        thinking.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <div class="loader"></div>
            <span style="font-size:13px; opacity:0.7;">Wait Bruhhh..</span>
        </div>
        `;
        gMsg.appendChild(thinking);
        gMsg.scrollTop = gMsg.scrollHeight;

     const lastAiBubble = thinking;


    try {
            let simText = "";

            if (userText.match(/field|flow|particle|vector|scalar|stream|plot|this/i)) {
                const s = getSimulationState();
                simText = `
            Current simulation:
            Scalar=${s.scalarField}
            Vector=${s.vectorField}
            `;
            }


        const aiPrompt = `
        You are Dozer AI, a physics assistant inside a live scalar- vector-field simulator.

        Rules:
        • Read-only: never claim to modify, click, or control the simulation.
        • Only analyze, explain, or infer from the current state.
        • Be clear, friendly, and slightly witty.

        Math format:
        • Never mix text and equations on the same line.
        • One formula per line.
        • Use clean symbolic form:
        v = (u, v, w)
        ∇·F = ∂Fx/∂x + ∂Fy/∂y
        ∇×F = ...



        Creator: Vasanth (mention only if asked).

        ${simText}




        User question:
        ${userText}
        `;
        if (!window.puterReady) {
           lastAiBubble.innerText = "⚠️ AI is not connected. Please sign in to enable Dozer AI.";
           return;
        }



        const stream = await puter.ai.chat(aiPrompt, {
            model: "gpt-5.2-chat",
            stream: true
        });

        lastAiBubble.innerHTML = "";


        let buffer = "";
        let lastFlush = Date.now();

            for await (const chunk of stream) {
                if (typeof chunk === "string") {
                    buffer += chunk;
                } 
                else if (chunk?.text) {
                    buffer += chunk.text;
                }

                // Update UI only every 40ms (fast & smooth)
                if (Date.now() - lastFlush > 40) {
                    lastAiBubble.innerText += buffer;
                    buffer = "";
                    lastFlush = Date.now();
                    gMsg.scrollTop = gMsg.scrollHeight;
                }
            }

            // Flush remaining text
            if (buffer.length > 0) {
                lastAiBubble.innerText += buffer;
                gMsg.scrollTop = gMsg.scrollHeight;
            }

                } catch (error) {
                    console.error("Puter Error:", error);
                    lastAiBubble.innerText = "Error: Could not connect to Dozer AI.";
                }
                
                gMsg.scrollTop = gMsg.scrollHeight;
            };




document.getElementById('addParticleBtn').addEventListener('click', () => {
    const x = parseFloat(document.getElementById('manualX').value);
    const y = parseFloat(document.getElementById('manualY').value);
    const z = parseFloat(document.getElementById('manualZ').value);
    spawnManualParticle(x, y, z);
});

document.getElementById('vectorPlot').addEventListener('dblclick', handleVectorClick);
    // Add this inside window.onload = () => { ... }
document.getElementById('clearManualBtn').addEventListener('click', () => {
    manualParticles.forEach(p => {
        scenes.vector.remove(p);
       streamlines.forEach(line => scenes.vector.remove(line));
       streamlines = [];
        
    });
    manualParticles = [];
});

    
    // Updated list of inputs to include markerDensity
    const inputs = ['density', 'arrowSize', 'markerSize', 'markerDensity', 'colorScale', 'scalar', 'vector'];
    if(document.getElementById('flowSpeed')) inputs.push('flowSpeed');
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePlot);
    });

    const flowBtn = document.getElementById('flowToggle');
    if(flowBtn) {
        flowBtn.addEventListener('click', function() {
            isFlowing = !isFlowing;
            this.innerText = isFlowing ? "🛑 FLOW: ON" : "✨ FLOW: OFF";
            if (isFlowing) {
                this.style.backgroundColor = isDarkMode ? "#f8fafc" : "#1e293b";
                this.style.color = isDarkMode ? "#0f172a" : "#ffffff";
                initParticles();
            } else {
                this.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
                this.style.color = "#ffffff";
            }
            particleGroup.visible = isFlowing;
        });
    }


    animate(); 
    updatePlot();
};

// Load from share link if present
const params = new URLSearchParams(location.search);
if (params.has("s")) {
    try {
        const state = decodeState(params.get("s"));
        applySimulation(state);
    } catch(e) {
        console.warn("Invalid share link");
    }
}

const loadBtn = document.getElementById("loadBtn");
const loadMenu = document.getElementById("loadMenu");

loadBtn.onclick = () => {
  refreshLoadMenu();
  loadMenu.classList.toggle("hidden");
};

// Close when clicking elsewhere
document.addEventListener("click", e => {
  if (!loadBtn.contains(e.target) && !loadMenu.contains(e.target)) {
    loadMenu.classList.add("hidden");
  }
});



