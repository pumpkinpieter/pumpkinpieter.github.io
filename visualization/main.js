import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

import positions from './data/base_vertices.json' with { type: "json" };
import guideds from './data/guided_heights.json' with { type: "json" };
import propagatings from './data/propagating_heights.json' with { 
    type: "json" };
import evanescents from './data/evanescent_heights.json' with { 
    type: "json" };
import indices from './data/trig_indices.json' with { type: "json" };
import f0s from './data/f0s.json' with { type: "json" };
import x0s from './data/x0s.json' with { type: "json" };

////////////////////////  Setup ///////////////////////

let container, gui_container;
let camera, scene, renderer;

container = document.getElementById( 'container' );
gui_container = document.getElementById( 'gui' );

const ztranslation = -4.0;

////////////////////////  Camera ///////////////////////

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set( -0.0466, 4.2029, -8.4371);
////////////////////////  Scene ///////////////////////

scene = new THREE.Scene();


////////////////////////  Clock ///////////////////////


class StopWatch extends THREE.Timer {
    constructor(paused = false){
        super();
        this.time = 0.0;
        this.startTime = 0.0;
        this.stopTime = 0.0;
        this.totalPause = 0.0;
        this.totalRun = 0.0;
        this.lastResetTime = 0.0;
        this.paused = paused;
    }
    
    reset(){
        this.lastResetTime = super.getElapsed();
        this.totalPause = 0.0;
        this.totalRun = 0.0;
        this.startTime = this.lastResetTime;
        this.stopTime = this.lastResetTime;
    }
    pause(){
        if(this.paused){
            // already paused, start again
            this.startTime = super.getElapsed();
            this.totalPause += this.startTime - this.stopTime;
            this.paused = false;
        }
        else{ // currently running, stop it
            this.stopTime = super.getElapsed();
            this.totalRun += this.stopTime - this.startTime;
            this.paused = true;
        }
    }
    run(){
        super.update();
        if(this.paused){
            this.time = this.totalRun;
        }
        else{
            this.time = super.getElapsed() - this.totalPause - this.lastResetTime;
        }
    }
}

const stopwatch = new StopWatch();


//////////////////// Colormaps /////////////////////////////

import viridis from './colormaps/viridis.json' with { type: "json" };
import magma from './colormaps/magma.json' with { type: "json" };
import twilight from './colormaps/twilight_shifted.json' with { type: 
"json" };
import jet from './colormaps/jet.json' with { type: "json" };

var viridis_lut = [];
for (let n=0;n<256;n++) {
viridis_lut.push(new THREE.Vector3(viridis[n][0], viridis[n][1], viridis[n][2]));
} 

var magma_lut = [];
for (let n=0;n<256;n++) {
magma_lut.push(new THREE.Vector3(magma[n][0], magma[n][1], magma[n][2]));
}

var twilight_lut = [];
for (let n=0;n<256;n++) {
twilight_lut.push(new THREE.Vector3(twilight[n][0], twilight[n][1], twilight[n][2]));
}

var jet_lut = [];
for (let n=0;n<256;n++) {
jet_lut.push(new THREE.Vector3(jet[n][0], jet[n][1], jet[n][2]));
}

const luts = {
  'viridis': viridis_lut,
  'magma': magma_lut,
  'twilight': twilight_lut,
  'jet': jet_lut,
}

const colormaxscale = Math.max(...f0s);
const colorminscale = -Math.max(...f0s);

////////////////////  Uniforms  /////////////////////////////

const uniforms = {	
  time: {type: 'f', value: stopwatch.time},
  speed: {value: 2.5},
  scale: {value: 5.0},
  guided_on: {value:true},
  evanescent_on: {value:true},
  propagating_on: {value:true},
  vLut: {type: "v3v", value: luts['viridis']},
  colormax: {type: 'f', value:colormaxscale},
  colormin: {type: 'f', value:colorminscale}
}

////////////////////////  Line (Input Field) ///////////////////////

const f0_points = [];

for ( let i = 0; i < f0s.length; i ++ ) {

  const x = x0s[i];
  const y = f0s[i];
  const z = ztranslation;

  f0_points.push( x, y, z );

}

const geometry2 = new LineGeometry();
geometry2.setPositions( f0_points );

let matLine = new LineMaterial( {

  color: new THREE.Color().setRGB (0.20784313725490197, 0.5176470588235295, 0.8941176470588236),
  linewidth: 3, // in pixels
  dashed: false

} );

matLine.uniforms.scale = uniforms.scale;
matLine.uniforms.time = uniforms.time;
matLine.uniforms.speed = uniforms.speed;

matLine.onBeforeCompile = function ( shader ) {

  shader.vertexShader = 'uniform float scale;\n' + shader.vertexShader;
  shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
  shader.vertexShader = 'uniform float speed;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
    'vec4 start = modelViewMatrix * vec4( vec3(instanceStart.x,scale*cos(speed*time)*instanceStart.y,instanceStart.z), 1.0 );'
  ).replace(
    'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
    'vec4 end = modelViewMatrix * vec4( vec3(instanceEnd.x,scale*cos(speed*time)*instanceEnd.y,instanceEnd.z), 1.0 );'
  );

matLine.userData.shader = shader;

};

const line2 = new Line2( geometry2, matLine );
line2.computeLineDistances();
line2.scale.set( 1, 1, 1 );
scene.add( line2 );

//////////////// Planes (Ref Idx Profile) ////////////
// const lut = new Lut( 'rainbow', 512 );
// const color = lut.getColor( 0.5 );

// const geometry2 = new THREE.PlaneGeometry( 2, 24, 10, 10 );
// const wireframe2 = new THREE.WireframeGeometry(geometry2);
// const line2 = new THREE.LineSegments(wireframe2);
// line2.material.depthWrite = false;
// line2.material.opacity = 1;
// line2.material.transparent = false;
// line2.rotateX(Math.PI/2)
// line2.translateY(12);
// line2.translateZ(0);

// const material2 = new THREE.MeshPhongMaterial( { color: 0x156289, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true } );
// const plane = new THREE.Mesh( geometry2, material2);
// plane.rotateX(Math.PI/2)
// plane.translateY(12);
// plane.translateZ(0);
// scene.add( plane );

////////////////////////  Mesh ///////////////////////

const geometry = new THREE.BufferGeometry();
geometry.setIndex( indices );
geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
geometry.setAttribute( 'guided', new THREE.Float32BufferAttribute( guideds, 2 ) );
geometry.setAttribute( 'evanescent', new THREE.Float32BufferAttribute( evanescents, 2 ) );
geometry.setAttribute( 'propagating', new THREE.Float32BufferAttribute( propagatings, 2 ) );

geometry.computeVertexNormals();

const material_shader = new THREE.ShaderMaterial( {
    uniforms: uniforms,
    vertexShader: `
        attribute vec2 evanescent;
        attribute vec2 propagating;
        attribute vec2 guided;

        uniform bool evanescent_on;
        uniform bool propagating_on;
        uniform bool guided_on;
        
        uniform float speed;
        uniform float scale;
        uniform float colormax;
        uniform float colormin;
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
            float ypos = (cos(speed*time)*Real + sin(speed*time)*Imag);
            result = vec4( position.x, scale*ypos, position.z, 1.0 );
            int index = int(256.0*(ypos-colormin)/(colormax - colormin));
            vColor = vLut[index];
            gl_Position = projectionMatrix * modelViewMatrix * result;

        }`,
    fragmentShader: `
    varying vec3 vColor;
    void main(){
      gl_FragColor = vec4(vColor,1.0);
    }`,
    side: THREE.DoubleSide,
    wireframe: false,
} );

const mesh = new THREE.Mesh( geometry, material_shader );
mesh.material.transparent = true;
scene.add( mesh );
mesh.translateZ(ztranslation);


////////////////////////  GUI ///////////////////////


const gui = new GUI();
container.appendChild(gui.domElement);

const viewFolder = gui.addFolder('Camera');
viewFolder.open();

const viewParams = {
  reset_controls: function(){controls.reset()},
  full_screen: function (){
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
}};

viewFolder.add(viewParams, 'full_screen').name('Full Screen')
viewFolder.add(viewParams, 'reset_controls').name('Reset View')

const animationFolder = gui.addFolder('Animation');
animationFolder.open();

const animationParams = {
  reset_time: function(){
    stopwatch.reset()
  },
  play_pause: function(){
    stopwatch.pause()
  }
  // pause: stopwatch.paused,
}

animationFolder
  .add(animationParams, 'play_pause')
  .listen()
  .name('Play / Pause')

// animationFolder
//   .add(animationParams, 'pause')
//   .listen()
//   .name('pause')
//   .onChange(function(){
//     stopwatch.pause();
//     console.log(stopwatch.paused);
//   })

animationFolder
  .add(animationParams, 'reset_time')
  .listen()
  .name('Restart')

animationFolder.add(mesh.material.uniforms.speed, 'value', 0.0, 10.0).name('Speed');
// animationFolder.close();

const componentsFolder = gui.addFolder('Field Components');
componentsFolder.open();
const componentsParams = {
  guided_on: true,
  propagating_on: true,
  evanescent_on: true,
};

componentsFolder
  .add(componentsParams, 'guided_on')
  .name('Guided')
  .onChange((value) =>{mesh.material.uniforms.guided_on.value = value;
  });

componentsFolder
  .add(componentsParams, 'propagating_on')
  .name('Propagating')
  .onChange((value) =>{mesh.material.uniforms.propagating_on.value = value;
  });

componentsFolder
  .add(componentsParams, 'evanescent_on')
  .name('Evanescent')
  .onChange((value) =>{mesh.material.uniforms.evanescent_on.value = value;
  });

componentsFolder.close();

const colormapList = {
  'viridis': 'viridis',
  'magma': 'magma',
  'twilight':'twilight',
  'jet':'jet',
}

const appearenceParams = {
  colormaps: colormapList['viridis'],
};
  
const appearenceFolder = gui.addFolder('Appearence');
appearenceFolder.open();

const meshAppearenceFolder = appearenceFolder.addFolder('Induced Field');
meshAppearenceFolder.open();
meshAppearenceFolder.add(mesh.material.uniforms.scale, 'value', 0.0, 20.0).name('scale');

meshAppearenceFolder
  .add(appearenceParams, 'colormaps', colormapList)
  .name('colormap')
  .onChange((value) =>{mesh.material.uniforms.vLut.value = luts[value];
  });

meshAppearenceFolder.add(mesh.material, 'wireframe');

appearenceFolder.close();

const inputFieldFolder = appearenceFolder.addFolder('Input Field');
inputFieldFolder.open();

const inputFieldParams = {
  width: 3,
  color: [0.20784313725490197, 0.5176470588235295, 0.8941176470588236],
};

inputFieldFolder
  .add( inputFieldParams, 'width', 0, 5 )
  .name('line width')
  .onChange( function ( value ) {

  matLine.linewidth = value;

} );

inputFieldFolder
  .addColor( inputFieldParams, 'color')
  .name('line color')
  .onChange(function (value) {
    const color = new THREE.Color().setRGB(value[0], value[1], value[2]);
    line2.material.color = color;
});

////////////////////////  Render ///////////////////////

renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize(window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();
// controls.addEventListener( 'change', function(){console.log(camera.position)} );


//////////////////// Event Listeners //////////////////

window.addEventListener( 'resize', onWindowResize );

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

renderer.domElement.addEventListener( 'click', onMouseClick);
renderer.domElement.addEventListener( 'mousemove', onMouseMove);
renderer.domElement.addEventListener( 'mousedown', onMouseDown);
renderer.domElement.addEventListener( 'mouseup', onMouseUp);

var mousedown = false;
var mouseup = true;
var dragging = false;

function onMouseClick(){
  if(!dragging){
    stopwatch.pause();
  }
}

function onMouseMove(){
  if(mousedown){dragging=true}
  else{dragging=false}
}

function onMouseDown(){
  mousedown = true;
  mouseup = false;
}

function onMouseUp(){
  mousedown = false;
  mouseup = true;
}

var requestID;

animate()

function animate() {
  requestID = requestAnimationFrame( animate );
  stopwatch.run();
  uniforms.time.value = stopwatch.time;
  uniforms.update;
  renderer.render( scene, camera );
}

