import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm"
import * as CMAP from "https://esm.sh/colormap";
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

import indices from './data/trig_indices.json' with { type: "json" };
import positions from './data/base_vertices.json' with { type: "json" };
import guideds from './data/guided.json' with { type: "json" };
import propagatings from './data/propagating.json' with { type: "json" };
import evanescents from './data/evanescent.json' with { type: "json" };

import input_indices from './data/trig_indices_input.json' with { type: "json" };
import input_positions from './data/base_vertices_input.json' with { type: "json" };
import input_heights from './data/input_heights.json' with { type: "json" };

import f0s from './data/f0s.json' with { type: "json" };
import x0s from './data/x0s.json' with { type: "json" };
import y0s from './data/y0s.json' with { type: "json" };
import input_y0s from './data/in_y0s.json' with { type: "json" };
import Rhos from './data/Rhos.json' with { type: "json" };

const loader2 = new FontLoader();
const font = await loader2.loadAsync('https://esm.sh/three@0.183.0/examples/fonts/helvetiker_regular.typeface.json');

//#region StopWatch
////////////// StopWatch Class //////////////////

class StopWatch extends THREE.Timer {
    constructor(paused = false) {
        super();
        this.time = 0.0;
        this.startTime = 0.0;
        this.stopTime = 0.0;
        this.totalPause = 0.0;
        this.totalRun = 0.0;
        this.lastResetTime = 0.0;
        this.paused = paused;
    }

    reset() {
        this.lastResetTime = super.getElapsed();
        this.totalPause = 0.0;
        this.totalRun = 0.0;
        this.startTime = this.lastResetTime;
        this.stopTime = this.lastResetTime;
    }
    pause() {
        if (this.paused) {
            // already paused, start again
            this.startTime = super.getElapsed();
            this.totalPause += this.startTime - this.stopTime;
            this.paused = false;
        }
        else { // currently running, stop it
            this.stopTime = super.getElapsed();
            this.totalRun += this.stopTime - this.startTime;
            this.paused = true;
        }
    }
    run() {
        super.update();
        if (this.paused) {
            this.time = this.totalRun;
        }
        else {
            this.time = super.getElapsed() - this.totalPause - this.lastResetTime;
        }
    }
}
const stopwatch = new StopWatch();
//#endregion

//#region Import Data and Set Data Limits

//////////// Get Data from Model //////////////

let trig_bytes = new Uint32Array(indices);

let base_bytes = new Float32Array(positions);

let input_trig_bytes = new Uint32Array(input_indices);
let input_base_bytes = new Float32Array(input_positions);

////////// Get Data Limits /////////////////

const xmin = Math.min(...x0s);
const xmax = Math.max(...x0s);

const zmax = Math.max(...f0s);
const zmin = -Math.max(...f0s);

const ymin = Math.min(...y0s);
const ymax = Math.max(...y0s);

const input_ys_width = Math.max(...input_y0s) - Math.min(...input_y0s);

const ywidth = ymax - ymin;
const xwidth = xmax - xmin;
const ytranslation = ywidth / 2.0;
const Nbasepts = x0s.length * y0s.length;
const Nvals = 2 * Nbasepts;
const Nmesh = guideds.length;

//#endregion

//#region Get Colormaps and set LUT array

//////////// Get Colormaps //////////////////

let viridis = CMAP.default({
    colormap: 'viridis',
    nshades: 256,
    format: 'float',
    alpha: 1
})

let magma = CMAP.default({
    colormap: 'magma',
    nshades: 256,
    format: 'float',
    alpha: 1
})

let rainbow = CMAP.default({
    colormap: 'rainbow',
    nshades: 256,
    format: 'float',
    alpha: 1
})

let bone = CMAP.default({
    colormap: 'bone',
    nshades: 256,
    format: 'float',
    alpha: 1
})

let copper = CMAP.default({
    colormap: 'copper',
    nshades: 256,
    format: 'float',
    alpha: 1
})

var viridis_lut = [];
for (let n = 0; n < 256; n++) {
    viridis_lut.push(new THREE.Vector3(viridis[n][0], viridis[n][1], viridis[n][2]));
}

var magma_lut = [];
for (let n = 0; n < 256; n++) {
    magma_lut.push(new THREE.Vector3(magma[n][0], magma[n][1], magma[n][2]));
}

var rainbow_lut = [];
for (let n = 0; n < 256; n++) {
    rainbow_lut.push(new THREE.Vector3(rainbow[n][0], rainbow[n][1], rainbow[n][2]));
}

var bone_lut = [];
for (let n = 0; n < 256; n++) {
    bone_lut.push(new THREE.Vector3(bone[n][0], bone[n][1], bone[n][2]));
}

var copper_lut = [];
for (let n = 0; n < 256; n++) {
    copper_lut.push(new THREE.Vector3(copper[n][0], copper[n][1], copper[n][2]));
}

const luts = {
    'viridis': viridis_lut,
    'magma': magma_lut,
    'bone': bone_lut,
    'copper': copper_lut,
    'rainbow': rainbow_lut,
}

//#endregion

//#region General Setup: Divs, Scene, Camera, Renderer and Controls

///////////////  Create Containers ///////////////

let container = document.getElementById('container');
let subcontainer = document.createElement("div");

subcontainer.setAttribute(
    'style',
    'position: relative; resize:neither; overflow:auto;'
);
container.appendChild(subcontainer);

///////////  Scene, Camera, Renderer, Controls /////////

const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

let ratio = window.innerWidth / window.innerHeight

// Set fov and camera location for good initial view

let gamma, gamma_deg, fov, alpha, D;

const s = .9;  // fraction of window width filled by mesh at opening
const f = .28;  // fraction of window height at which mesh starts at opening

const check = s * xwidth * (1 / 2 - f) / (ratio * ytranslation)

// If check < 1, we can find angle and distance for camera for a good preset fov (45 deg)
if (check < .95) {
    gamma_deg = 22.5;
    gamma = gamma_deg * Math.PI / 180;
    fov = 2 * gamma_deg;

    alpha = Math.asin(xwidth * (1 / 2 - f) / (ratio * ytranslation * s));
    D = ytranslation * (Math.sin(alpha) / (2 * Math.tan(gamma) * (1 / 2 - f)) + Math.cos(alpha));
}
else {  // If not, we go with our first method to ensure mesh fits on screen (though with some fallbacks in case fov would get too large)
    alpha = Math.PI / 6;
    D = Math.max(2.5 * ytranslation, 5 * zmax);
    const b1 = Math.atan(ytranslation * Math.sin(alpha) / (D - ytranslation * Math.cos(alpha)));
    const b2 = Math.atan(xwidth / (2 * ratio * (D - ytranslation * Math.cos(alpha))));
    gamma = 1.3 * Math.max(Math.abs(b1), Math.abs(b2)) / (Math.PI / 180);
    fov = Math.max(Math.min(90, 2 * gamma), 50);
}
const camera = new THREE.PerspectiveCamera(fov, ratio, .01, 1000);
camera.up.set(0, 0, 1);
// camera.position.set(0, -D * Math.cos(alpha), D * Math.sin(alpha));

camera.position.set(
    .75*D * Math.cos(Math.PI / 16) * Math.cos(Math.PI / 16), 
    .75*D * Math.cos(Math.PI / 16) * Math.sin(Math.PI / 16) - ytranslation,
    .75*D * Math.sin(Math.PI / 16));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
subcontainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target = new THREE.Vector3(0,-.85*ytranslation,0);

//#endregion

//#region Axis Helper

//////////////  Add AxesHelper with Labels //////////////

const axes = new THREE.Group();

const axesLength = 1.25;
const axesHelper = new THREE.AxesHelper(axesLength);
axesHelper.translateX(xmin - .5);
axesHelper.translateY(-ytranslation - input_ys_width - .5);

axes.add(axesHelper)

const textMaterial = new THREE.MeshBasicMaterial({
    // color: new THREE.Color().setRGB(1, 0.6, 0),
    color: 'silver',
    // roughness: 1,
});

const fontsize = .25;
const fontdepth = .075;

const textGeometryX = new TextGeometry('X', {
    font: font,
    size: fontsize,
    depth: fontdepth,
});

const textGeometryY = new TextGeometry('Y', {
    font: font,
    size: fontsize,
    depth: fontdepth,
});
const textGeometryZ = new TextGeometry('Z', {
    font: font,
    size: fontsize,
    depth: fontdepth,
});

const textX = new THREE.Mesh(textGeometryX, textMaterial);
const textY = new THREE.Mesh(textGeometryY, textMaterial);
const textZ = new THREE.Mesh(textGeometryZ, textMaterial);

textX.rotateX(Math.PI / 2);

textX.position.x = axesHelper.position.x + 1.05 * axesLength;
textX.position.y = axesHelper.position.y + .5 * fontdepth;
textX.position.z = axesHelper.position.z - .5 * fontsize;
axes.add(textX);

textY.rotateX(Math.PI / 2);
textY.rotateY(Math.PI / 2);
textY.position.x = axesHelper.position.x - .5 * fontdepth;
textY.position.y = axesHelper.position.y + 1.05 * axesLength;
textY.position.z = axesHelper.position.z - .5 * fontsize;
axes.add(textY);

textZ.rotateX(Math.PI / 2);
textZ.position.x = axesHelper.position.x - .5 * fontsize;
textZ.position.y = axesHelper.position.y + .5 * fontdepth;
textZ.position.z = axesHelper.position.z + 1.05 * axesLength + .5 * fontsize;
axes.add(textZ);

scene.add(axes);

//#endregion

//#region Uniforms

const uniforms = {
    time: { value: stopwatch.time },
    speed: { value: 2.5 },
    scale: { value: 1.0 },
    guided_on: { value: true },
    evanescent_on: { value: true },
    propagating_on: { value: true },
    vLut: { value: luts['magma'] },
    vLutin: { value: luts['bone'] },
    colormax: { value: zmax },
    colormin: { value: zmin },
    colorscale: { value: 1.0 },
    gridlinescale: { value: .8 },
    shift: { value: 1.0 },
    mesh_number: { value: 0 },
}

//#endregion

//#region Vertex and Fragment Shaders
const vertShader = `
    attribute vec2 evanescent;
    attribute vec2 propagating;
    attribute vec2 guided;

    uniform bool evanescent_on;
    uniform bool propagating_on;
    uniform bool guided_on;
    
    uniform float speed;
    uniform float scale;
    uniform float gridlinescale;
    uniform float colormax;
    uniform float colormin;
    uniform float colorscale;
    uniform float time;
    uniform vec3 vLut[256];
    varying vec3 vColor;


    void main(){
        vec4 result;
        float Real;
        float Imag;
        if (guided_on == true){
          Real += guided.x;
          Imag += guided.y;
        }
        if (evanescent_on == true){
          Real += evanescent.x;
          Imag += evanescent.y;
        }
        if (propagating_on == true){
          Real += propagating.x;
          Imag += propagating.y;
        }
        
        float zpos = (cos(speed*time)*Real + sin(speed*time)*Imag);
        
        result = vec4( position.x, position.y, scale * zpos, 1.0 );
        int index = int(floor(clamp(255.0/colorscale*(zpos-colorscale*colormin)/(colormax - colormin), 0.0, 255.0)));
        vColor = vLut[index];
        gl_Position = projectionMatrix * modelViewMatrix * result;
    }`;

const inputVertShader = `
    attribute vec2 height;
    
    uniform float speed;
    uniform float scale;
    uniform float gridlinescale;
    uniform float colormax;
    uniform float colormin;
    uniform float colorscale;
    uniform float time;
    uniform vec3 vLutin[256];
    varying vec3 vColor;


    void main(){
        vec4 result;
        float zpos = (cos(speed*time)*height.x + sin(speed*time)*height.y);
        
        result = vec4( position.x, position.y, scale * zpos, 1.0 );
        int index = int(floor(clamp(255.0/colorscale*(zpos-colorscale*colormin)/(colormax - colormin), 0.0, 255.0)));
        vColor = vLutin[index];
        gl_Position = projectionMatrix * modelViewMatrix * result;
    }`;

const fragShader = `
varying vec3 vColor;
void main(){
  gl_FragColor = vec4(vColor,1.0);
}`;

//#endregion

//#region Main Mesh(es)

const material_shader = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertShader,
    fragmentShader: fragShader,
    side: THREE.DoubleSide,
    wireframe: false,
});

const meshes = [];
for (let i = 0; i < Nmesh; i++) {
    let geometry = new THREE.BufferGeometry();
    //   const geometry = new THREE.BufferGeometry();
    geometry.setIndex(new THREE.Uint32BufferAttribute(trig_bytes, 1));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(base_bytes, 3));
    geometry.setAttribute('guided', new THREE.Float32BufferAttribute(guideds[i], 2));
    geometry.setAttribute('propagating', new THREE.Float32BufferAttribute(propagatings[i], 2));
    geometry.setAttribute('evanescent', new THREE.Float32BufferAttribute(evanescents[i], 2));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material_shader);
    scene.add(mesh);
    mesh.visible = false;
    mesh.translateY(-ytranslation);
    meshes.push(mesh)
}
const start_idx = uniforms.mesh_number.value;

var mesh = meshes[start_idx];
mesh.visible = true;

//#endregion

//#region Input Mesh
const input_mesh_geometry = new THREE.BufferGeometry();
input_mesh_geometry.setIndex(new THREE.Uint32BufferAttribute(input_trig_bytes, 1));
input_mesh_geometry.setAttribute('position', new THREE.Float32BufferAttribute(input_base_bytes, 3));
input_mesh_geometry.setAttribute('height', new THREE.Float32BufferAttribute(input_heights, 2));
input_mesh_geometry.computeVertexNormals();


const input_material_shader = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: inputVertShader,
    fragmentShader: fragShader,
    side: THREE.DoubleSide,
    wireframe: false,
});

const input_mesh = new THREE.Mesh(input_mesh_geometry, input_material_shader);

scene.add(input_mesh);
input_mesh.translateY(-ytranslation);

//#endregion

//#region Gridlines

//#region Gridline Setup

let base_x0step = 2;
let base_y0step = 4;

// Function to set complex valued height attributes correctly for LineGeometry
function setHeights(array, geometry, name) {
    // converts [ z1r, z1i, z2r, z2i,... ] to pairs format [z1r, z1i, z2r, z2i, z2r, z2i, ...]
    // and sets as attributes name+Start and name+End
    const length = array.length - 2;
    const data = new Float32Array(2 * length);

    for (let i = 0; i < length; i += 2) {
        data[2 * i] = array[i];
        data[2 * i + 1] = array[i + 1];

        data[2 * i + 2] = array[i + 2];
        data[2 * i + 3] = array[i + 3];
    }
    const instanceBuffer = new THREE.InstancedInterleavedBuffer(data, 4, 1); // xyz, xyz
    geometry.setAttribute(name + 'Start', new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 0)); // xyz
    geometry.setAttribute(name + 'End', new THREE.InterleavedBufferAttribute(instanceBuffer, 2, 2)); // xyz
}

let gridline_material = new LineMaterial({
    linewidth: 0.3,
    vertexColors: true,
});

gridline_material.uniforms.time = uniforms.time;
gridline_material.uniforms.scale = uniforms.scale;
gridline_material.uniforms.speed = uniforms.speed;
gridline_material.uniforms.guided_on = uniforms.guided_on;
gridline_material.uniforms.propagating_on = uniforms.propagating_on;
gridline_material.uniforms.evanescent_on = uniforms.evanescent_on;
gridline_material.uniforms.vLut = uniforms.vLut;
gridline_material.uniforms.gridlinescale = uniforms.gridlinescale;
gridline_material.uniforms.colorscale = uniforms.colorscale;
gridline_material.uniforms.colormin = uniforms.colormin;
gridline_material.uniforms.colormax = uniforms.colormax;
gridline_material.uniforms.y0step = { value: base_y0step };
gridline_material.uniforms.x0step = { value: base_x0step };

gridline_material.onBeforeCompile = function (shader) {
    shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float scale;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float speed;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float colorscale;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float colormin;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float colormax;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float gridlinescale;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform bool guided_on;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform bool propagating_on;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform bool evanescent_on;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform vec3 vLut[256];\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 guidedStart;\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 guidedEnd;\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 propagatingStart;\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 propagatingEnd;\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 evanescentStart;\n' + shader.vertexShader;
    shader.vertexShader = 'attribute vec2 evanescentEnd;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(`		void main() {

			#ifdef USE_COLOR

				vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

			#endif`,
        `		void main() {
                        float RealStart;
                        float ImagStart;
                        float RealEnd;
                        float ImagEnd;
                        float resultStart;
                        float resultEnd;

                        if (guided_on == true){
                            RealStart += guidedStart.x;
                            ImagStart += guidedStart.y;
                            RealEnd += guidedEnd.x;
                            ImagEnd += guidedEnd.y;
                            }

                        if (propagating_on == true){
                            RealStart += propagatingStart.x;
                            ImagStart += propagatingStart.y;
                            RealEnd += propagatingEnd.x;
                            ImagEnd += propagatingEnd.y;
                            }

                        if (evanescent_on == true){
                            RealStart += evanescentStart.x;
                            ImagStart += evanescentStart.y;
                            RealEnd += evanescentEnd.x;
                            ImagEnd += evanescentEnd.y;
                            }

                        resultStart = cos(speed * time) * RealStart + sin(speed * time) * ImagStart;
                        resultEnd = cos(speed * time) * RealEnd + sin(speed * time) * ImagEnd;
        
                        #ifdef USE_COLOR
                        int indexStart = int(floor(clamp(255.0/colorscale*(resultStart-colorscale*colormin)/(colormax - colormin), 0.0, 255.0)));
                        int indexEnd = int(floor(clamp(255.0/colorscale*(resultEnd-colorscale*colormin)/(colormax - colormin), 0.0, 255.0)));

                        vColor.xyz = ( position.y < 0.5 ) ? gridlinescale * vLut[indexStart] : gridlinescale * vLut[indexEnd];
                        #endif
                    \n`
    );
    shader.vertexShader = shader.vertexShader.replace(
        'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
        'vec4 start = modelViewMatrix * vec4( vec3(instanceStart.x, instanceStart.y, scale * resultStart), 1.0 );'
    ).replace(
        'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
        'vec4 end = modelViewMatrix * vec4( vec3(instanceEnd.x, instanceEnd.y, scale * resultEnd), 1.0 );'
    );
    gridline_material.userData.shader = shader;
};

// Set base gridline positions, translate resultant line later by ybase/xbase
const TVGLBasePositions = new Float32Array(3 * x0s.length);
const LGLBasePositions = new Float32Array(3 * y0s.length);

for (let i = 0; i < x0s.length; i++) {
    TVGLBasePositions[3 * i] = x0s[i];
    TVGLBasePositions[3 * i + 1] = 0;
    TVGLBasePositions[3 * i + 2] = 0;
};

for (let i = 0; i < y0s.length; i++) {
    LGLBasePositions[3 * i] = 0;
    LGLBasePositions[3 * i + 1] = y0s[i];
    LGLBasePositions[3 * i + 2] = 0;
};

//#endregion

//#region Transverse Gridlines

function makeTransvereGridlines(y0step, idx, group) {
    let NTVgridlines = Math.floor((y0s.length - 1) / y0step) + 1;
    for (let i = 1; i < NTVgridlines; i++) {
        let ybase = y0s[i * y0step];

        let current_guided = guideds[idx].slice(y0step * i * 2 * x0s.length,
            (y0step * i + 1) * 2 * x0s.length);

        let current_prop = propagatings[idx].slice(y0step * i * 2 * x0s.length,
            (y0step * i + 1) * 2 * x0s.length);

        let current_ev = evanescents[idx].slice(y0step * i * 2 * x0s.length,
            (y0step * i + 1) * 2 * x0s.length);

        const temp_geometry = new LineGeometry();
        temp_geometry.setPositions(TVGLBasePositions);
        setHeights(current_guided, temp_geometry, 'guided');
        setHeights(current_prop, temp_geometry, 'propagating');
        setHeights(current_ev, temp_geometry, 'evanescent');

        let line = new Line2(temp_geometry, gridline_material);
        line.computeLineDistances();
        line.scale.set(1, 1, 1);
        line.translateY(ybase - ytranslation);
        group.add(line);
    }
    scene.add(group);
    return group
}

function setTVGLSvisiblity(y0step, group) {
    // group.visible = true;
    let NTVgridlines = Math.floor((y0s.length - 1) / y0step) + 1;
    for (let i = 0; i < NTVgridlines - 1; i++) {
        group.children[i * y0step].visible = true;
        for (let j = 1; j < y0step; j++) {
            group.children[i * y0step + j].visible = false;
        }
    }
}

const tvgls = [];
for (let i = 0; i < Nmesh; i++) {
    let group = makeTransvereGridlines(1, i, new THREE.Group());
    group.visible = false;
    setTVGLSvisiblity(base_y0step, group);
    tvgls.push(group);
}

var current_tvgls = tvgls[start_idx];
current_tvgls.visible = true;
//#endregion

//#region Longitudinal Gridlines

function makeLongitudinalGridlines(x0step, idx, group) {
    let NLgridlines = Math.floor((x0s.length - 1) / x0step) + 1;
    for (let i = 0; i < NLgridlines; i++) {
        let xbase = x0s[i * x0step];

        let temp_guided = [];
        let temp_prop = [];
        let temp_ev = [];
        let gbs = guideds[idx];
        let pbs = propagatings[idx];
        let evs = evanescents[idx];

        for (let j = 0; j < y0s.length; j++) {
            let cgs = gbs.slice(2 * (i * x0step + j * x0s.length),
                2 * (i * x0step + j * x0s.length + 1))
            temp_guided.push(cgs[0], cgs[1]);
            let cps = pbs.slice(2 * (i * x0step + j * x0s.length),
                2 * (i * x0step + j * x0s.length + 1))
            temp_prop.push(cps[0], cps[1]);
            let ces = evs.slice(2 * (i * x0step + j * x0s.length),
                2 * (i * x0step + j * x0s.length + 1))
            temp_ev.push(ces[0], ces[1]);
        }

        const temp_geometry = new LineGeometry();
        temp_geometry.setPositions(LGLBasePositions);
        setHeights(new Float32Array(temp_guided), temp_geometry, 'guided');
        setHeights(new Float32Array(temp_prop), temp_geometry, 'propagating');
        setHeights(new Float32Array(temp_ev), temp_geometry, 'evanescent');

        let line = new Line2(temp_geometry, gridline_material);
        line.computeLineDistances();
        line.scale.set(1, 1, 1);
        line.translateX(xbase);
        line.translateY(-ytranslation);
        group.add(line);
    }
    scene.add(group);
    return group
}

function setLGLSvisiblity(x0step, group) {
    let NLgridlines = Math.floor((x0s.length - 1) / x0step) + 1;
    for (let i = 0; i < NLgridlines - 1; i++) {
        group.children[i * x0step].visible = true;
        for (let j = 1; j < x0step; j++) {
            group.children[i * x0step + j].visible = false;
        }
    }
}

const lgls = [];
for (let i = 0; i < Nmesh; i++) {
    let group = makeLongitudinalGridlines(1, i, new THREE.Group());
    group.visible = false;
    setLGLSvisiblity(base_x0step, group);
    lgls.push(group);
}
var current_lgls = lgls[start_idx];
current_lgls.visible = true;
//#endregion

//#endregion

//#region Borders

const borders = new THREE.Group();
scene.add(borders);

const border_points_front = [];
border_points_front.push(xmin, -ytranslation, 0.0);
border_points_front.push(xmax, -ytranslation, 0.0);

const border_points_left = [];
border_points_left.push(xmin, -ytranslation, 0.0);
border_points_left.push(xmin, -ytranslation + (ymax - ymin), 0.0);

const border_line_front_geo = new LineGeometry();
border_line_front_geo.setPositions(border_points_front);

const border_line_left_geo = new LineGeometry();
border_line_left_geo.setPositions(border_points_left);

let border_line_material = new LineMaterial({
    color: 'silver',
    linewidth: 1.5, // in pixels
    dashed: false
});

const border_line_front = new Line2(border_line_front_geo, border_line_material);
border_line_front.computeLineDistances();
border_line_front.scale.set(1, 1, 1);
borders.add(border_line_front);

const border_line_back = border_line_front.clone();
border_line_back.computeLineDistances();
border_line_back.scale.set(1, 1, 1);
border_line_back.translateY(ymax - ymin);
borders.add(border_line_back);

const border_line_left = new Line2(border_line_left_geo, border_line_material);
border_line_left.computeLineDistances();
border_line_left.scale.set(1, 1, 1);
borders.add(border_line_left);

const border_line_right = border_line_left.clone();
border_line_right.computeLineDistances();
border_line_right.scale.set(1, 1, 1);
border_line_right.translateX(xmax - xmin);
borders.add(border_line_right);

//#endregion

//#region Interface Lines 
const interface_lines = new THREE.Group();
scene.add(interface_lines);

const interface_points = [];
interface_points.push(Rhos[1], -ytranslation, 0.0);
interface_points.push(Rhos[1], ywidth - ytranslation, 0.0);

const interface_line_geo = new LineGeometry();
interface_line_geo.setPositions(interface_points);

let interface_line_material = new LineMaterial({

    color: new THREE.Color('silver'),
    linewidth: 1.25, // in pixels
    dashed: true,
    dashSize: .1,
    gapSize: .1,
});

for (let i = 1; i < Rhos.length - 1; i++) {
    const interface_line = new Line2(
        interface_line_geo,
        interface_line_material
    );
    interface_line.computeLineDistances();
    interface_line.scale.set(1, 1, 1);
    interface_line.translateX(Rhos[i] - Rhos[1]);
    interface_lines.add(interface_line);
}

//#endregion

//#region Input Planes

const plane_color = new THREE.Color().setRGB(0.51, 0.5, 0.6)
const ns = [1.4, 1.5, 1.4];
const maxns = Math.max(...ns);
const plane_height = 13;

const planes = new THREE.Group();

for (let i = 0; i < Rhos.length - 1; i++) {
    let plane_geometry = new THREE.PlaneGeometry(Rhos[i + 1] - Rhos[i], plane_height);
    let plane_material = new THREE.MeshBasicMaterial({
        color: plane_color, side: THREE.DoubleSide,
        transparent: true, opacity: (ns[i] / maxns) ** 4 * .7
    });
    let plane = new THREE.Mesh(plane_geometry, plane_material);
    plane.translateY(-ytranslation);
    plane.translateX((Rhos[i + 1] + Rhos[i]) / 2);
    plane.rotateX(Math.PI / 2);
    planes.add(plane);
}
scene.add(planes);

//#endregion

//#region Input Field Line

const f0_points = [];

for (let i = 0; i < f0s.length; i++) {
    const x = x0s[i];
    const y = -ytranslation;
    const z = f0s[i];
    f0_points.push(x, y, z);

}

const inputline_geometry = new LineGeometry();
inputline_geometry.setPositions(f0_points);

let inputline_material = new LineMaterial({
    // color: new THREE.Color().setRGB (0.20784313725490197, 0.5176470588235295, 0.8941176470588236),
    linewidth: 1.15,
    // dashed: false
});

inputline_material.uniforms.scale = uniforms.scale;
inputline_material.uniforms.time = uniforms.time;
inputline_material.uniforms.speed = uniforms.speed;

inputline_material.onBeforeCompile = function (shader) {

    shader.vertexShader = 'uniform float scale;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
    shader.vertexShader = 'uniform float speed;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
        'vec4 start = modelViewMatrix * vec4( vec3(instanceStart.x,instanceStart.y, scale*cos(speed*time)*instanceStart.z), 1.0 );'
    ).replace(
        'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
        'vec4 end = modelViewMatrix * vec4( vec3(instanceEnd.x,instanceEnd.y, scale*cos(speed*time)*instanceEnd.z), 1.0 );'
    );

    inputline_material.userData.shader = shader;

};

const inputline = new Line2(inputline_geometry, inputline_material);
inputline.computeLineDistances();
inputline.scale.set(1, 1, 1);
scene.add(inputline);

//#endregion

//#region GUI

//#region GUI: Set Up

const gui_container = document.createElement('div');
gui_container.id = 'gui_container';
gui_container.setAttribute(
    'style',
    'position: absolute; z-index: 2; display:block; right: 15px; top: 0px'
);

subcontainer.appendChild(gui_container);

const gui = new GUI({ container: gui_container });

const guiBaseParams = {
    reset: function () {
        gui.reset();
        controls.reset();
        controls.target = new THREE.Vector3(0,-.85*ytranslation,0);
    },
    full_screen: function () {
        const fullscreenElement =
            document.fullscreenElement || document.webkitFullscreenElement;
        if (!fullscreenElement) {
            if (window.document.documentElement.requestFullscreen) {
                container.requestFullscreen();
            } else if (canvas.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            }
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    },
};
gui.add(guiBaseParams, 'full_screen').name('Full Screen')
gui.add(guiBaseParams, 'reset').name('Reset')

//#endregion

//#region GUI: Components

const fieldFolder = gui.addFolder('Fields');
fieldFolder.open();

const componentsParams = {
    guided_on: true,
    propagating_on: true,
    evanescent_on: true,
};

if (Nmesh > 1) {
    fieldFolder
        .add(uniforms.mesh_number, 'value', 0, Nmesh - 1, 1)
        .name('mesh index')
        .listen()
        .onChange((value) => {
            if (meshParams.meshVisible) {
                mesh.visible = false;
            };
            uniforms.mesh_number.value = value;
            // uniforms.frequency.value = value;
            // const index = argTarget(frequencies, value);
            mesh = meshes[value];
            if (meshParams.meshVisible) {
                mesh.visible = true;
            }
            if (viewParams.gridlines_visible.value) {
                current_lgls.visible = false;
                current_tvgls.visible = false;
                current_lgls = lgls[value];
                current_tvgls = tvgls[value];
                current_lgls.visible = true;
                current_tvgls.visible = true;
            }
            else {
                current_lgls = lgls[value];
                current_tvgls = tvgls[value];
                current_lgls.visible = false;
                current_tvgls.visible = false;
            }
        });
}

const componentsFolder = fieldFolder.addFolder("Components")
componentsFolder
    .add(componentsParams, 'guided_on')
    .name('Guided')
    .onChange((value) => {
        mesh.material.uniforms.guided_on.value = value;
    });

componentsFolder
    .add(componentsParams, 'propagating_on')
    .name('Propagating')
    .onChange((value) => {
        mesh.material.uniforms.propagating_on.value = value;
    });

componentsFolder
    .add(componentsParams, 'evanescent_on')
    .name('Evanescent')
    .onChange((value) => {
        mesh.material.uniforms.evanescent_on.value = value;
    });

// componentsFolder.close();
//#endregion

//#region GUI: Viewpoints 

const viewFolder = gui.addFolder('Viewpoints');
viewFolder.open();

const viewParams = {
    front_view: function () { camera.position.set(0, -D * Math.cos(alpha), D * Math.sin(alpha));
                controls.target = new THREE.Vector3(0,0,0);
     },
    side_view: function () { camera.position.set(D * Math.cos(Math.PI / 8), 0, D * Math.sin(Math.PI / 8));
                controls.target = new THREE.Vector3(0,0,0);
     },
    overhead_view: function () {
        camera.position.set(0, 0, D);
        controls.target = new THREE.Vector3(0,0,0);
        controls.rotateLeft(-Math.PI / 2);
    },
    back_view: function () { camera.position.set(0, D * Math.cos(alpha), D * Math.sin(alpha));
                controls.target = new THREE.Vector3(0,0,0);
     },
    three_quarters: function () { 
        camera.position.set(
            D * Math.cos(Math.PI / 8) * Math.cos(Math.PI / 8), 
            D * Math.cos(Math.PI / 8) * Math.sin(Math.PI / 8),
            D * Math.sin(Math.PI / 8));
        controls.target = new THREE.Vector3(0,0,0);
    },
    gridlines_visible: { value: true },
};

viewFolder.add(viewParams, 'front_view').name('Front')
viewFolder.add(viewParams, 'side_view').name('Side')
viewFolder.add(viewParams, 'overhead_view').name('Overhead')
viewFolder.add(viewParams, 'back_view').name('Back')
viewFolder.add(viewParams, 'three_quarters').name('3/4')
viewFolder.close();

//#endregion

//#region GUI: Animation

const animationFolder = gui.addFolder('Animation');
animationFolder.open();

const animationParams = {
    reset_time: function () {
        stopwatch.reset()
    },
    play_pause: function () {
        stopwatch.pause()
    }
}

animationFolder
    .add(animationParams, 'play_pause')
    .listen()
    .name('Play / Pause')


animationFolder
    .add(animationParams, 'reset_time')
    .listen()
    .name('Restart')

animationFolder.add(mesh.material.uniforms.speed, 'value', 0.0, 10.0).name('Speed');

animationFolder.close();
//#endregion

//#region GUI: Style

const styleFolder = gui.addFolder('Style');

//#region SUB GUI: SUB Appearence: Mesh

const meshAppearenceFolder = styleFolder.addFolder('Meshes');

meshAppearenceFolder.open();

meshAppearenceFolder.add(mesh, 'visible');

const colormapList = {
    'copper': 'copper',
    'viridis': 'viridis',
    'magma': 'magma',
    'bone': 'bone',
    'rainbow': 'rainbow',
}

const appearenceParams = {
    colormaps: colormapList['magma'],
};

meshAppearenceFolder.add(mesh.material.uniforms.scale, 'value', 0.0, 2.0).name('scale');

meshAppearenceFolder
    .add(appearenceParams, 'colormaps', colormapList)
    .name('colormap')
    .onChange((value) => {
        mesh.material.uniforms.vLut.value = luts[value];
    });

meshAppearenceFolder.add(mesh.material.uniforms.colorscale, 'value', 0.04, 2.0).name('colorscale');

meshAppearenceFolder.close();

//#endregion

//#region SUB GUI: SUB Appearence: Planes
const planeAppearenceFolder = styleFolder.addFolder('Planes');

planeAppearenceFolder.add(planes, 'visible');

planeAppearenceFolder.close();
//#endregion

//#region SUB GUI: SUB Appearence: Lines
const lineAppearenceFolder = styleFolder.addFolder('Lines');

//#region SUB GUI: SUB Appearence: SUB Lines: Axes

const axesAppearenceFolder = lineAppearenceFolder.addFolder('Axes');
axesAppearenceFolder.open();

axesAppearenceFolder.add(axes, 'visible');
axesAppearenceFolder.close();

//#endregion

//#region SUB GUI: SUB Appearence: SUB Lines: Border

const borderAppearenceFolder = lineAppearenceFolder.addFolder('Border');
borderAppearenceFolder.open();

borderAppearenceFolder.add(borders, 'visible').name('visible');

const silver = new THREE.Color('silver');

const border_params = {
    width: .7,
    color: [silver.r, silver.g, silver.b],
};
borderAppearenceFolder.add(border_params, 'width', .01, 5)
    .onChange(function (val) {
        border_line_material.linewidth = val;
    });

borderAppearenceFolder
    .addColor(border_params, 'color')
    .name('color')
    .onChange(function (value) {
        const color = new THREE.Color().setRGB(value[0], value[1], value[2]);
        border_line_material.color = color;
    });

borderAppearenceFolder.close();

//#endregion

//#region SUB GUI: SUB Appearence: SUB Lines: Grid

const gridAppearenceFolder = lineAppearenceFolder.addFolder('Grid');
gridAppearenceFolder.open();

gridAppearenceFolder.add(viewParams.gridlines_visible, 'value')
    .name('visible')
    .onChange((value) => {
        current_lgls.visible = value;
        current_tvgls.visible = value;
    });

const grid_params = {
    'line width': .3,
    'x step': base_x0step,
    'y step': base_y0step,
};
gridAppearenceFolder.add(grid_params, 'line width', .01, 10)
    .onChange(function (val) {
        gridline_material.linewidth = val;
    });
gridAppearenceFolder.add(gridline_material.uniforms.gridlinescale, 'value', .01, 1).name('shade')

gridAppearenceFolder.add(grid_params, 'x step', 1, 20)
    .step(1)
    .onChange((val) => {
        // longitudinal_gridlines.clear();
        // makeLongitudinalGridlines(val, uniforms.mesh_number.value );
        gridline_material.uniforms.x0step.value = val;
        for (let i = 0; i < lgls.length; i++) {
            let group = lgls[i];
            setLGLSvisiblity(val, group);
        }
    });

gridAppearenceFolder.add(grid_params, 'y step', 1, 20)
    .step(1)
    .onChange((val) => {
        // transverse_gridlines.clear();
        // makeTransvereGridlines(val, uniforms.mesh_number.value );
        gridline_material.uniforms.y0step.value = val;
        for (let i = 0; i < tvgls.length; i++) {
            let group = tvgls[i];
            setTVGLSvisiblity(val, group);
        }
    });

gridAppearenceFolder.close();

//#endregion

//#region SUB GUI: SUB Appearence: SUB Lines: Input

const inputFieldFolder = lineAppearenceFolder.addFolder('Input');
inputFieldFolder.open();

inputFieldFolder.add(inputline, 'visible').name('visible');

const inputFieldParams = {
    width: 1.15,
    color: [silver.r, silver.g, silver.b],
};

inputFieldFolder
    .add(inputFieldParams, 'width', 0, 5)
    .name('width')
    .onChange(function (value) {

        inputline_material.linewidth = value;

    });

inputFieldFolder
    .addColor(inputFieldParams, 'color')
    .name('color')
    .onChange(function (value) {
        const color = new THREE.Color().setRGB(value[0], value[1], value[2]);
        inputline_material.color = color;
    });

inputFieldFolder.close();

//#endregion

//#region SUB GUI: SUB Appearence: SUB Lines: Interfaces

const interfaceAppearenceFolder = lineAppearenceFolder.addFolder('Interfaces');
interfaceAppearenceFolder.open();

interfaceAppearenceFolder.add(interface_lines, 'visible').name('visible');

const interface_params = {
    width: .7,
    color: [silver.r, silver.g, silver.b],
};
interfaceAppearenceFolder.add(interface_params, 'width', .1, 4)
    .onChange(function (val) {
        interface_line_material.linewidth = val;
    });

interfaceAppearenceFolder
    .addColor(interface_params, 'color')
    .name('color')
    .onChange(function (value) {
        const color = new THREE.Color().setRGB(value[0], value[1], value[2]);
        interface_line_material.color = color;
    });

interfaceAppearenceFolder.add(interface_line_material, 'dashed');
interfaceAppearenceFolder.add(interface_line_material, 'dashSize', .05, 1.5);
interfaceAppearenceFolder.add(interface_line_material, 'gapSize', .05, 1.5);

interfaceAppearenceFolder.close();

//#endregion

lineAppearenceFolder.close();

//#endregion

styleFolder.close();

//#endregion

// gui.close();

//#endregion

//#region Events
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('click', onMouseClick);
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mouseup', onMouseUp);

var mousedown = false;
var mouseup = true;
var dragging = false;

function onMouseClick() {
    if (!dragging) {
        stopwatch.pause();
    }
}

function onMouseMove() {
    if (mousedown) { dragging = true }
    else { dragging = false }
}

function onMouseDown() {
    mousedown = true;
    mouseup = false;
}

function onMouseUp() {
    mousedown = false;
    mouseup = true;
}

//#endregion

// #region Animate/Render

var requestID;

function animate() {
    controls.update();
    stopwatch.run();
    uniforms.time.value = stopwatch.time;

    // Mod stopwatch time to decrease computational load
    if (stopwatch.paused != true) {
        if (stopwatch.time > 2 * Math.PI / uniforms.speed.value) {
            stopwatch.reset();
        }
    }
    uniforms.update;
    renderer.render(scene, camera);
    requestID = requestAnimationFrame(animate);
}

animate();
//#endregion
