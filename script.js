let isDarkMode = false;

// Zoom bounds
let scalar1DBounds = { x: [-10, 10] };
let vector1DBounds = { x: [-10, 10] };

/* ------------------- INVERTED COLOR MAPS ------------------- */
const REVERSED_SCALES = {
    Viridis: [
        [0,"#fde725"],[0.1,"#b5de2b"],[0.2,"#6ece58"],[0.3,"#35b779"],
        [0.4,"#1f9e89"],[0.5,"#26828e"],[0.6,"#31688e"],
        [0.7,"#3e4989"],[0.8,"#482878"],[0.9,"#440154"],[1,"#440154"]
    ],
    Jet: [
        [0,"#ff0000"],[0.2,"#ff7f00"],[0.4,"#ffff00"],
        [0.6,"#7fff7f"],[0.8,"#007fff"],[1,"#00007f"]
    ],
    Hot: [
        [0,"#ffffff"],[0.3,"#ffff00"],[0.6,"#ff0000"],[1,"#000000"]
    ],
   Blues: [
        [0,"#f7fbff"],
        [0.3,"#6baed6"],
        [0.6,"#2171b5"],
        [1,"#08306b"]
    ],
    Electric: [
        [0,"#ffffff"],[0.25,"#00ffff"],[0.5,"#0000ff"],[0.75,"#ff00ff"],[1,"#000000"]
    ],
    Portland: [
        [0,"#8e0152"],[0.25,"#c51b7d"],[0.5,"#f7f7f7"],[0.75,"#4d9221"],[1,"#276419"]
    ]
};
/* ----------------------------------------------------------- */

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('themeBtn').innerText = isDarkMode ? '☀️' : '🌙';
    plot();
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.opacity = show ? '1' : '0';
}

function toggleFS(id) {
    document.getElementById(id).classList.toggle('fullscreen-active');
    setTimeout(() => { 
        Plotly.Plots.resize('scalarPlot'); 
        Plotly.Plots.resize('vectorPlot'); 
    }, 100);
}

function linspace(a, b, n) {
    let arr = [], s = (b - a) / (n - 1);
    for (let i = 0; i < n; i++) arr.push(a + i * s);
    return arr;
}

function getVars(expr) {
    let vars = new Set();
    let s = expr.toLowerCase();
    if (s.includes("x")) vars.add("x");
    if (s.includes("y")) vars.add("y");
    if (s.includes("z")) vars.add("z");
    return vars;
}

function plot() {
    showLoader(true);
    setTimeout(() => {
        try {
            let f = document.getElementById("scalar").value.trim();
            let v = document.getElementById("vector").value.trim();
            let bg = isDarkMode ? "#0f172a" : "#ffffff";
            let txt = isDarkMode ? "#f8fafc" : "#1e293b";

            let scaleName = document.getElementById("colorScale").value;
            let colorScale = REVERSED_SCALES[scaleName] || REVERSED_SCALES.Viridis;

            plotScalar(f, bg, txt, colorScale);
            plotVector(v, bg, txt, colorScale);
        } catch (e) {
            console.error(e);
        }
        showLoader(false);
    }, 50);
}

function plotScalar(expr, bg, txt, colorScale) {
    const vars = getVars(expr);
    let layout = {
        autosize:true, paper_bgcolor:bg, plot_bgcolor:bg, font:{color:txt},
        margin:{t:20,b:20,l:20,r:20}, uirevision:'true'
    };

    if (vars.size <= 1) {
        let x = linspace(scalar1DBounds.x[0], scalar1DBounds.x[1], 500);
        let y = x.map(v=>{try{return math.evaluate(expr,{x:v})}catch(e){return 0}});
        Plotly.react("scalarPlot",[{x,y,type:'scatter',mode:'lines',line:{color:'#6366f1',width:3}}],
        {...layout,xaxis:{range:scalar1DBounds.x,autorange:false,color:txt},yaxis:{color:txt}});
        attach1DListener("scalarPlot","scalar");

    } else if (vars.has("z")) {
        let X=[],Y=[],Z=[],C=[];
        let r=linspace(-5,5,12);
        r.forEach(x=>r.forEach(y=>r.forEach(z=>{
            try{let v=math.evaluate(expr,{x,y,z});X.push(x);Y.push(y);Z.push(z);C.push(v);}catch(e){}
        })));
        Plotly.react("scalarPlot",[{
            type:'scatter3d',x:X,y:Y,z:Z,mode:'markers',
            marker:{size:3,color:C,colorscale:colorScale,showscale:true,opacity:0.8}
        }],{...layout,scene:{aspectmode:'cube',xaxis:{color:txt},yaxis:{color:txt},zaxis:{color:txt}}});

    } else {
        let x=linspace(-5,5,40),y=linspace(-5,5,40),Z=[];
        for(let i=0;i<y.length;i++){
            let row=[];
            for(let j=0;j<x.length;j++){
                try{row.push(math.evaluate(expr,{x:x[j],y:y[i]}));}catch(e){row.push(0);}
            }
            Z.push(row);
        }
        Plotly.react("scalarPlot",[{
            type:"surface",x,y,z:Z,colorscale:colorScale,showscale:true
        }],{...layout,scene:{aspectmode:'cube',xaxis:{color:txt},yaxis:{color:txt},zaxis:{color:txt}}});
    }
}

function plotVector(expr, bg, txt, colorScale) {
    let parts = expr.replace(/[\[\]\s]/g,"").split(",");
    let density = parseInt(document.getElementById("density").value);

    let layout = {autosize:true,paper_bgcolor:bg,plot_bgcolor:bg,font:{color:txt},
        margin:{t:20,b:20,l:20,r:20},uirevision:'true'};

    if (parts.length===1) {
        let x=linspace(vector1DBounds.x[0],vector1DBounds.x[1],density*3);
        let u=x.map(v=>{try{return math.evaluate(parts[0],{x:v})}catch(e){return 0}});
        Plotly.react("vectorPlot",[{
            type:'scatter',x,y:x.map(()=>0),mode:'markers',
            marker:{symbol:'arrow-bar-up',angle:u.map(v=>v>=0?90:270),size:15,color:u.map(Math.abs),colorscale:colorScale,showscale:true}
        }],{...layout,xaxis:{range:vector1DBounds.x,autorange:false,color:txt},yaxis:{visible:false}});
        attach1DListener("vectorPlot","vector");

    } else {
        let is3D=parts.length===3;
        let n=is3D?Math.floor(density/1.2):density*2;
        let gx=linspace(-5,5,n),gy=linspace(-5,5,n),gz=is3D?linspace(-5,5,n):[0];
        let X=[],Y=[],Z=[],U=[],V=[],W=[],M=[];
        for(let x of gx)for(let y of gy)for(let z of gz){
            try{
                let s=is3D?{x,y,z}:{x,y};
                let u=math.evaluate(parts[0],s),v=math.evaluate(parts[1],s),w=is3D?math.evaluate(parts[2],s):0;
                X.push(x);Y.push(y);Z.push(z);U.push(u);V.push(v);W.push(w);M.push(Math.sqrt(u*u+v*v+w*w));
            }catch(e){}
        }
        Plotly.react("vectorPlot",[{
            type:"cone",x:X,y:Y,z:Z,u:U,v:V,w:W,intensity:M,
            colorscale:colorScale,sizemode:"scaled",sizeref:0.5,showscale:true
        }],{...layout,scene:{aspectmode:'cube',xaxis:{color:txt},yaxis:{color:txt},zaxis:{color:txt}}});
    }
}

function attach1DListener(id,type){
    const el=document.getElementById(id);
    el.removeAllListeners('plotly_relayout');
    el.on('plotly_relayout',ed=>{
        if(ed['xaxis.range[0]']!==undefined){
            if(type==="scalar") scalar1DBounds.x=[ed['xaxis.range[0]'],ed['xaxis.range[1]']];
            else vector1DBounds.x=[ed['xaxis.range[0]'],ed['xaxis.range[1]']];
            plot();
        }
    });
}

window.onload = plot;
window.onresize = ()=>{Plotly.Plots.resize("scalarPlot");Plotly.Plots.resize("vectorPlot");};

