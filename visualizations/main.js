import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'dat.gui'

import positions from './data/base_vertices_new.json';
import guideds from './data/guided_heights.json'
import propagatings from './data/propagating_heights.json'
import evanescents from './data/evanescent_heights.json'
import indices from './data/trig_indices_new.json';
import f0s from './data/f0s.json';
import x0s from './data/x0s.json';

////////////////////////  Setup ///////////////////////

let container;
let camera, scene, renderer;

container = document.getElementById( 'container' );

const ztranslation = -4.0;
var requestID;

////////////////////////  Camera ///////////////////////

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set( 0, 8,-6);


////////////////////////  Scene ///////////////////////

scene = new THREE.Scene();


////////////////////////  Clock ///////////////////////


const clock = new THREE.Clock();


////////////////////////  Lights  ///////////////////////

const light = new THREE.DirectionalLight(0xffffff,3)
light.position.set(0,5,-30)
camera.add(light)

const light2 = new THREE.DirectionalLight(0xffffff,3)
light2.position.set(20,5,30)
scene.add(light2)

const light3 = new THREE.DirectionalLight(0xffffff,3)
light3.position.set(0,0,30)
light3.lookAt(0,0,0)
scene.add(light3)

camera.add(new THREE.AmbientLight(0xffffff,2.5))


//////////////////// Colormaps /////////////////////////////

import viridis from './colormaps/viridis.json'
import inferno from './colormaps/inferno.json'
import magma from './colormaps/magma.json'
import plasma from './colormaps/plasma.json'
import twilight from './colormaps/twilight_shifted.json'
import turbo from './colormaps/turbo.json'
import jet from './colormaps/jet.json'

var viridis_lut = [];
for (let n=0;n<256;n++) {
viridis_lut.push(new THREE.Vector3(viridis[n][0], viridis[n][1], viridis[n][2]));
} 

var inferno_lut = [];
for (let n=0;n<256;n++) {
inferno_lut.push(new THREE.Vector3(inferno[n][0], inferno[n][1], inferno[n][2]));
}

var magma_lut = [];
for (let n=0;n<256;n++) {
magma_lut.push(new THREE.Vector3(magma[n][0], magma[n][1], magma[n][2]));
}

var plasma_lut = [];
for (let n=0;n<256;n++) {
plasma_lut.push(new THREE.Vector3(plasma[n][0], plasma[n][1], plasma[n][2]));
}

var twilight_lut = [];
for (let n=0;n<256;n++) {
twilight_lut.push(new THREE.Vector3(twilight[n][0], twilight[n][1], twilight[n][2]));
}

var turbo_lut = [];
for (let n=0;n<256;n++) {
turbo_lut.push(new THREE.Vector3(turbo[n][0], turbo[n][1], turbo[n][2]));
}

var jet_lut = [];
for (let n=0;n<256;n++) {
jet_lut.push(new THREE.Vector3(jet[n][0], jet[n][1], jet[n][2]));
}

const luts = {
  'viridis': viridis_lut,
  'magma': magma_lut,
  'inferno': inferno_lut,
  'plasma': plasma_lut,
  'twilight': twilight_lut,
  'turbo': turbo_lut,
  'jet': jet_lut,
}

const colormaxscale = .6 * Math.max(...f0s);

////////////////////  Uniforms  /////////////////////////////

const uniforms = {	
  time: {type: 'f', value: clock.getElapsedTime()},
  speed: {value: 2.0},
  scale: {value: 10.0},
  guided_on: {value:true},
  evanescent_on: {value:true},
  propagating_on: {value:true},
  vLut: {type: "v3v", value: luts['viridis']},
  colormax: {type: 'f', value:colormaxscale}
}

////////////////////////  Line (input function) ///////////////////////

const line_geo = new THREE.BufferGeometry();
// const line_material = new THREE.LineBasicMaterial( { color: 0x0000ff } );

const line_material = new THREE.ShaderMaterial( {
  wireframeLinewidth:10.0,
    uniforms: uniforms,
    vertexShader: `
        uniform float speed;
        uniform float scale;
        uniform float time;

        void main(){
            vec4 result;

            result = vec4( position.x, scale*position.y*cos(speed*time), position.z, 1.0 );
            gl_Position = projectionMatrix * modelViewMatrix * result;

        }`,
    fragmentShader: `
        void main() {
          gl_FragColor =  vec4(0,1,0,1);
        }`,
    side: THREE.DoubleSide,
    wireframe:false,
} );

const f0_points = [];

for ( let i = 0; i < f0s.length; i ++ ) {

  const x = x0s[i];
  const y = f0s[i];
  const z = ztranslation;

  f0_points.push( x, y, z );

}

line_geo.setAttribute( 'position', new THREE.Float32BufferAttribute( f0_points, 3 ) );

const line = new THREE.Line( line_geo, line_material );
line.material.linewidth =30.0;
scene.add( line );


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
            int index = int(256.0*(ypos+colormax)/(2.0*colormax));
            vColor = vLut[index];
            gl_Position = projectionMatrix * modelViewMatrix * result;

        }`,
    fragmentShader: `
    varying vec3 vColor;
    void main(){
      gl_FragColor = vec4(vColor,1.0);
    }`,
    side: THREE.DoubleSide,
    wireframe:false,
} );

const mesh = new THREE.Mesh( geometry, material_shader );
scene.add( mesh );
mesh.translateZ(ztranslation);



////////////////////////  GUI ///////////////////////


const gui = new GUI();

const componentsFolder = gui.addFolder('Fields');
componentsFolder.open();
const componentsParams = {
  guided_on: true,
  propagating_on: true,
  evanescent_on: true,
};

componentsFolder
  .add(componentsParams, 'guided_on')
  .name('guided')
  .onChange((value) =>{mesh.material.uniforms.guided_on.value = value;
  });

componentsFolder
  .add(componentsParams, 'propagating_on')
  .name('propagating')
  .onChange((value) =>{mesh.material.uniforms.propagating_on.value = value;
  });

componentsFolder
  .add(componentsParams, 'evanescent_on')
  .name('evanescent')
  .onChange((value) =>{mesh.material.uniforms.evanescent_on.value = value;
  });

const colormapList = {
  'viridis': 'viridis',
  'magma': 'magma',
  'inferno': 'inferno',
  'plasma':'plasma',
  'twilight':'twilight',
  'turbo':'turbo',
  'jet':'jet',
}

const appearenceParams = {
  colormaps: colormapList['viridis'],
};
  
const appearenceFolder = gui.addFolder('Appearence');
appearenceFolder.open();
appearenceFolder.add(mesh.material, 'wireframe');
appearenceFolder.add(mesh.material.uniforms.scale, 'value', 0.0, 40.0).name('scale');

appearenceFolder
  .add(appearenceParams, 'colormaps', colormapList)
  .name('colormap')
  .onChange((value) =>{mesh.material.uniforms.vLut.value = luts[value];
  });

var previous;
previous = 0.0;

const animationFolder = gui.addFolder('Animation');
animationFolder.open();
animationFolder.add(mesh.material.uniforms.speed, 'value', 0.0, 10.0).name('speed');

const animationParams = {
  start_pause: false,
};

animationFolder
  .add(animationParams, 'start_pause')
  .name('start/pause')
  .onChange((value) => {
    if (value === true) {
      clock.start();
      clock.elapsedTime = previous;
      animate();
    }
    else{
    previous = clock.getElapsedTime();
    clock.running=false;
    cancelAnimationFrame(requestID);
  }
  });


////////////////////////  Render ///////////////////////

renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
container.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();

window.addEventListener( 'resize', onWindowResize );


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function stopAnimation() {

  cancelAnimationFrame( requestID );

}

animate()

function animate() {
    requestID = requestAnimationFrame( animate );
    if(animationParams.start_pause == true){
    uniforms.time.value = clock.getElapsedTime();}
    uniforms.update;
    renderer.render( scene, camera );
    // stats.update();
}

function set_colormap(){}
