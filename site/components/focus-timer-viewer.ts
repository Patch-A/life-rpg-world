import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type TimerViewer = {
  view: (view:'front'|'side'|'back'|'free')=>void;
  progress: (value:number,active:boolean)=>void;
  visible: (value:boolean)=>void;
  dispose: ()=>void;
};

export async function createTimerViewer(canvas: HTMLCanvasElement, signal:AbortSignal, onError:()=>void):Promise<TimerViewer> {
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,.05,40);
  const target=new THREE.Vector3(0,1.43,0);
  camera.position.set(3.1,2.7,6.1);camera.lookAt(target);
  const controls=new OrbitControls(camera,canvas);controls.target.copy(target);
  controls.enablePan=false;controls.minDistance=3.3;controls.maxDistance=9;
  controls.minPolarAngle=.30;controls.maxPolarAngle=Math.PI*.66;
  controls.enableDamping=false;
  const environment=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environmentMap=pmrem.fromScene(environment,.04);scene.environment=environmentMap.texture;
  environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff1dc','#343447',1.25));
  for(const [color,intensity,position] of [['#fff2d5',3.3,[-3,5,5]],['#b9a3ff',2,[4,3,-3]],['#bcdfdf',1.2,[4,2,4]]] as const){
    const light=new THREE.DirectionalLight(color,intensity);light.position.set(position[0],position[1],position[2]);scene.add(light);
  }
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(64,64,8,64,64,63);gradient.addColorStop(0,'rgba(0,0,0,.6)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.2),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.001;scene.add(shadow);
  let disposed=false,isVisible=true,frame=0;
  let hand:THREE.Object3D|undefined,button:THREE.Object3D|undefined,halo:THREE.Mesh|undefined;
  const schedule=()=>{
    if(disposed||!isVisible||document.hidden||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;if(!disposed&&isVisible&&!document.hidden)renderer.render(scene,camera);});
  };
  const resize=()=>{
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5,1100/Math.max(width,height)));
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();schedule();
  };
  const ro=new ResizeObserver(resize);ro.observe(canvas);
  const visibility=()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();};
  const lost=(event:Event)=>{event.preventDefault();onError();};
  document.addEventListener('visibilitychange',visibility);canvas.addEventListener('webglcontextlost',lost);
  controls.addEventListener('change',schedule);
  const dispose=()=>{
    if(disposed)return;disposed=true;
    if(frame)cancelAnimationFrame(frame);
    ro.disconnect();controls.dispose();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);signal.removeEventListener('abort',dispose);
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());shadowTexture.dispose();environmentMap.dispose();scene.clear();renderer.dispose();renderer.forceContextLoss();
  };
  signal.addEventListener('abort',dispose,{once:true});
  try{
    const response=await fetch('/art-lab/focus-timer-v1.glb',{signal});
    if(!response.ok)throw new Error('模型加载失败');
    const data=await response.arrayBuffer();
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const gltf=await new GLTFLoader().parseAsync(data,'/art-lab/');
    if(signal.aborted){gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});throw new DOMException('Aborted','AbortError');}
    scene.add(gltf.scene);hand=gltf.scene.getObjectByName('ElapsedHand');button=gltf.scene.getObjectByName('StartButton');halo=gltf.scene.getObjectByName('FocusHalo') as THREE.Mesh|undefined;
    resize();
    return {
      view(view){const radius=Math.max(6.1,3.1/camera.aspect);const positions={front:[0,1.5,radius],side:[radius,1.65,.001],back:[0,1.7,-radius],free:[radius*.44,2.7,radius*.87]};camera.position.set(...positions[view] as [number,number,number]);controls.target.copy(target);controls.update();schedule();},
      progress(value,active){if(hand)hand.rotation.z=-Math.PI*2*Math.max(0,Math.min(1,value));if(button)button.scale.y=active?.88:1;if(halo)(halo.material as THREE.MeshStandardMaterial).emissiveIntensity=active?1.7:.32;schedule();},
      visible(value){isVisible=value;if(!value&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();},
      dispose,
    };
  }catch(error){dispose();throw error;}
}
