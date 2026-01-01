let isDarkMode = false;
const scenes = { scalar: null, vector: null };
const cameras = { scalar: null, vector: null };
const renderers = { scalar: null, vector: null };
const controls = { scalar: null, vector: null };
const groups = { scalar: new THREE.Group(), vector: new THREE.Group() };

const PALETTES = {
    Viridis: [[0, 0xfde725], [0.2, 0x5ec962], [0.5, 0x21918c], [0.8, 0x3b528b], [1, 0x440154]],
    Hot: [[0, 0xffffff], [0.3, 0xffaa00], [0.6, 0xe60000], [1, 0x000000]],
    Cool: [[0, 0xff00ff], [0.5, 0x0000ff], [1, 0x00ffff]],
    Jet: [[0, 0x800000], [0.1, 0xff0000], [0.35, 0xffff00], [0.65, 0x00ffff], [0.85, 0x0000ff], [1, 0x00008f]],
    Sunset: [[0, 0xffd200], [1, 0xf7971e]]
};

// --- Core Initialization ---

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

// --- Scalar Rendering ---

function renderScalar() {
    groups.scalar.clear();
    const expr = document.getElementById("scalar").value;
    const palette = document.getElementById("colorScale").value;
    const dotSize = parseFloat(document.getElementById("markerSize").value);
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
            const dens = 14; 
            const step = (range*2)/dens;
            const data = [];
            for(let x=-range; x<=range; x+=step)
                for(let y=-range; y<=range; y+=step)
                    for(let z=-range; z<=range; z+=step) {
                        let v = math.evaluate(expr, {x,y,z});
                        minV = Math.min(minV, v); maxV = Math.max(maxV, v);
                        data.push({x, y, z, v});
                    }
            const sphereGeo = new THREE.SphereGeometry(dotSize, 12, 12);
            const sphereMat = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.45, depthWrite: false, shininess: 120, specular: 0x555555 });
            const instancedMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, data.length);
            const matrix = new THREE.Matrix4();
            data.forEach((d, i) => {
                matrix.setPosition(d.x, d.y, d.z);
                instancedMesh.setMatrixAt(i, matrix);
                const color = getColor((d.v - minV) / (maxV - minV || 1), palette);
                instancedMesh.setColorAt(i, color);
            });
            groups.scalar.add(instancedMesh);
        }
    } catch(e) { console.error(e); }
    updateLegend('scalarLegend', minV, maxV, palette);
}

// --- Vector Rendering ---

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
                    vectors.push({x,y,z,u,v,w,mag});
                } catch(e){}
            }
        }
    }
    vectors.forEach(v => {
        if(v.mag === 0) return;
        const color = getColor(v.mag/(maxMag||1), palette);
        groups.vector.add(new THREE.ArrowHelper(new THREE.Vector3(v.u, v.w, v.v).normalize(), new THREE.Vector3(v.x, v.z, v.y), size, color.getHex(), size*0.2, size*0.2));
    });
    updateLegend('vectorLegend', 0, maxMag, palette);
}

// --- UI & Helpers ---

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
    if (type === 'scalar') {
        const expr = document.getElementById("scalar").value;
        const hasY = expr.includes('y'), hasZ = expr.includes('z');
        if (!hasY && !hasZ) yLabelText = "f(x)";
        else if (!hasZ) yLabelText = "f(x,y)";
    }
    const labels = [{ id: type + '-lx', pos: [5, 0, 0], txt: 'X', col: '#ef4444' }, { id: type + '-ly', pos: [0, 5, 0], txt: yLabelText, col: '#10b981' }, { id: type + '-lz', pos: [0, 0, 5], txt: 'Y', col: '#3b82f6' }];
    labels.forEach(l => {
        let el = document.getElementById(l.id);
        if (!el) { el = document.createElement('div'); el.id = l.id; el.className = 'absolute pointer-events-none axis-label z-50 transition-colors'; container.appendChild(el); }
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
    updateParticles(); // Particle animation hook
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    ['scalar', 'vector'].forEach(k => scenes[k].background.setHex(isDarkMode ? 0x0f172a : 0xffffff));
}

// --- Particle Flow Logic ---

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
    if (!isFlowing) return;
    const expr = document.getElementById("vector").value;
    const parts = expr.replace(/[\[\]\s]/g, "").split(",");
    const dof = parts.length;
    const speedMultiplier = parseFloat(document.getElementById('flowSpeed')?.value || 1.0) * 0.02;

    particles.forEach(p => {
        try {
            const lifeRatio = p.life / 100;
            let pColor = isDarkMode ? 
                new THREE.Color().lerpColors(new THREE.Color(0x475569), new THREE.Color(0xf8fafc), lifeRatio) : 
                new THREE.Color().lerpColors(new THREE.Color(0x1e293b), new THREE.Color(0x4f46e5), lifeRatio);
            p.material.color.copy(pColor);

            const scope = { x: p.position.x, y: p.position.z, z: p.position.y };
            let vx = math.evaluate(parts[0] || "0", scope);
            let vy = dof > 1 ? math.evaluate(parts[1], scope) : 0;
            let vz = dof > 2 ? math.evaluate(parts[2], scope) : 0;

            p.position.x += vx * speedMultiplier;
            if (dof > 1) p.position.z += vy * speedMultiplier;
            if (dof > 2) p.position.y += vz * speedMultiplier;

            if (dof === 1) { p.position.z = 0; p.position.y = 0; }
            if (dof === 2) { p.position.y = 0; }

            p.life--;
            p.material.opacity = lifeRatio * (isDarkMode ? 0.8 : 0.9);
            if (p.life <= 0 || Math.abs(p.position.x) > 5 || Math.abs(p.position.y) > 5 || Math.abs(p.position.z) > 5) resetParticle(p);
        } catch (e) { p.life = 0; }
    });
}

// --- Initialization & Event Listeners ---

window.onload = () => {
    initWorld('scalarPlot', 'scalar');
    initWorld('vectorPlot', 'vector');
    
    const inputs = ['density', 'arrowSize', 'markerSize', 'colorScale', 'scalar', 'vector'];
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
