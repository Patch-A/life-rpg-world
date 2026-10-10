import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Standalone modeled prop. All surfaces are geometry; no reference image is projected onto it. */
export function createFocusTimerModel() {
  const root = new THREE.Group();
  root.name = 'GrowthPlanet_FocusTimer_v1';
  const staticParts = new THREE.Group();
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  const material = (name: string, color: string, metalness: number, roughness: number) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.name = name; resources.add(m); return m;
  };
  const gold = material('Brushed_champagne_gold', '#bda079', .78, .3);
  const edge = material('Polished_gold_edges', '#f0d5a0', .8, .22);
  const shadowGold = material('Gold_facet_shadow', '#806441', .7, .4);
  const body = material('Midnight_enamel', '#172e38', .36, .3);
  const dial = material('Deep_teal_dial', '#173b48', .25, .42);
  const dialAlternate = material('Teal_dial_facets', '#214c55', .28, .4);
  const lavender = material('Lavender_enamel', '#9076b5', .35, .29);
  const dark = material('Rubber_and_recesses', '#101725', .05, .72);
  const ivory = material('Ivory_markings', '#efe5cf', .2, .5);
  const haloMaterial = material('Focus_light', '#baa3ee', .12, .4);
  haloMaterial.emissive.set('#8968cf'); haloMaterial.emissiveIntensity = .32;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: number[] = [0, 0, 0], parent: THREE.Object3D = staticParts) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(p[0], p[1], p[2]); parent.add(mesh); return mesh;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, p: number[]) => add(new THREE.BoxGeometry(w,h,d),mat,p);
  const cylinder = (r: number, depth: number, mat: THREE.Material, p: number[], segments = 80) => {
    const m=add(new THREE.CylinderGeometry(r,r,depth,segments),mat,p); m.rotation.x=Math.PI/2; return m;
  };
  const ring = (r: number, thickness: number, mat: THREE.Material, p: number[], parent: THREE.Object3D = staticParts) => add(new THREE.TorusGeometry(r,thickness,10,80),mat,p,parent);
  const prism = (points: number[][], depth: number, mat: THREE.Material, p: number[], bevel = .008) => {
    const shape=new THREE.Shape(); points.forEach(([x,y],i)=> i?shape.lineTo(x,y):shape.moveTo(x,y)); shape.closePath();
    return add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1}),mat,p);
  };
  const gem = (radius: number, mat: THREE.Material, p: number[], parent: THREE.Object3D=staticParts) => add(new THREE.OctahedronGeometry(radius),mat,p,parent);
  const cy=1.53;
  // A stable, tapered stand, with a separate enamel inset and gold perimeter.
  prism([[-.79,0],[.79,0],[.51,.67],[-.51,.67]],.5,gold,[0,.11,-.3],.035);
  prism([[-.69,.065],[.69,.065],[.45,.59],[-.45,.59]],.028,body,[0,.11,.234],.018);
  box(1.60,.10,.72,edge,[0,.105,-.015]);
  for(const side of [-1,1]) box(.25,.055,.5,dark,[side*.56,.028,0]);
  // Case thickness remains visible at every angle, including the engraved back cover.
  cylinder(1.0,.33,gold,[0,cy,0]);
  cylinder(.963,.35,body,[0,cy,0]);
  ring(.973,.033,edge,[0,cy,.16]);
  ring(.959,.023,edge,[0,cy,-.188]);
  cylinder(.888,.032,lavender,[0,cy,.185]);
  cylinder(.802,.032,dial,[0,cy,.212]);
  ring(.806,.018,gold,[0,cy,.24]);
  ring(.748,.008,edge,[0,cy,.243]);
  ring(.873,.009,edge,[0,cy,.223]);
  const halo=ring(.901,.013,haloMaterial,[0,cy,.231],root); halo.name='FocusHalo'; resources.add(halo.geometry);
  // Twelve alternate dial sectors produce a subtle sunburst effect without a large texture.
  for(let n=0;n<12;n++){
    const a=n*Math.PI/6;
    const geo=new THREE.CircleGeometry(.739,10,a,Math.PI/12);
    add(geo,dialAlternate,[0,cy,.234]);
  }
  // Minute and hour markings are merged by material before export.
  for(let n=0;n<60;n++){
    const a=n*Math.PI/30; const major=n%5===0;
    const tick=box(major?.021:.008,major?.10:.033,.007,major?edge:ivory,[Math.sin(a)*.706,cy+Math.cos(a)*.706,.249]);
    tick.rotation.z=-a;
  }
  for(let n=0;n<8;n++){
    const a=n*Math.PI/4; const p=[Math.sin(a)*.844,cy+Math.cos(a)*.844,.251];
    gem(n%2===0?.025:.018,edge,p);
  }
  // Faceted eight-point compass rose: two faces per ray catch different lighting.
  const rose = (parent: THREE.Object3D, radius: number, z: number, y: number) => {
    for(let n=0;n<8;n++){
      const a=n*Math.PI/4, r=n%2===0?radius:radius*.67;
      const tip=[Math.sin(a)*r,Math.cos(a)*r,0];
      const left=[Math.sin(a-.65)*radius*.34,Math.cos(a-.65)*radius*.34,0];
      const right=[Math.sin(a+.65)*radius*.34,Math.cos(a+.65)*radius*.34,0];
      const ridge=[Math.sin(a)*radius*.14,Math.cos(a)*radius*.14,.045];
      for(const [outer,m] of [[left,edge],[right,shadowGold]] as const){
        const vertices=[0,0,.022,...outer,...tip,0,0,.022,...tip,...ridge];
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
        // Reverse side is included as real triangles rather than double-sided material.
        const reverse=new THREE.BufferGeometry(); const a2:number[]=[];
        for(let i=0;i<vertices.length;i+=9) a2.push(...vertices.slice(i,i+3),...vertices.slice(i+6,i+9),...vertices.slice(i+3,i+6));
        reverse.setAttribute('position',new THREE.Float32BufferAttribute(a2,3));reverse.computeVertexNormals();
        add(geo,m,[0,y,z],parent);add(reverse,m,[0,y,z],parent);
      }
    }
  };
  rose(staticParts,.57,.279,cy);
  cylinder(.075,.042,edge,[0,cy,.31],32);
  gem(.047,lavender,[0,cy,.357]);
  ring(.50,.005,gold,[0,cy,.264]);
  // Back plate and a smaller compass emblem remain inspectable in a full rotation.
  cylinder(.875,.02,dial,[0,cy,-.19]);
  ring(.72,.009,gold,[0,cy,-.207]);
  const backEmblem = new THREE.Group();rose(backEmblem,.43,0,0);backEmblem.position.set(0,cy,-.217);backEmblem.rotation.y=Math.PI;staticParts.add(backEmblem);
  for(let n=0;n<6;n++){
    const a=n*Math.PI/3; cylinder(.024,.013,edge,[Math.sin(a)*.81,cy+Math.cos(a)*.81,-.213],12);
  }
  // Carry loop, saddle, and winding crown with actual radial knurling.
  box(.28,.13,.27,gold,[0,cy+1.007,0]);
  ring(.18,.041,gold,[0,cy+1.2,0]);
  ring(.18,.009,edge,[0,cy+1.2,.041]);
  const crown=cylinder(.115,.18,gold,[1.043,cy+.07,0],32);crown.rotation.set(0,0,Math.PI/2);
  for(let n=0;n<18;n++){
    const a=n*Math.PI/9;
    box(.13,.011,.011,edge,[1.063,cy+.07+Math.sin(a)*.114,Math.cos(a)*.114]);
  }
  const button=new THREE.Group();button.name='StartButton';button.position.set(.65,cy+.8,0);button.rotation.z=-.58;root.add(button);
  const buttonStem=add(new THREE.CylinderGeometry(.085,.085,.11,24),shadowGold,[0,0,0],button);
  const buttonHead=add(new THREE.CylinderGeometry(.11,.11,.065,24),gold,[0,.08,0],button);
  resources.add(buttonStem.geometry);resources.add(buttonHead.geometry);
  for(const side of [-1,1]){
    cylinder(.073,.08,gold,[side*.82,.96,.07],24);
    cylinder(.038,.09,edge,[side*.82,.96,.105],16);
  }
  const baseStar=new THREE.Group();rose(baseStar,.10,0,0);baseStar.position.set(0,.34,.275);staticParts.add(baseStar);
  // An independent hand visualizes elapsed focus time and can animate without rebuilding geometry.
  const hand=new THREE.Group();hand.name='ElapsedHand';hand.position.set(0,cy,.40);root.add(hand);
  const handShape=new THREE.Shape();handShape.moveTo(0,.647);handShape.lineTo(-.024,.53);handShape.lineTo(-.012,-.13);handShape.lineTo(.012,-.13);handShape.lineTo(.024,.53);handShape.closePath();
  const handMesh=add(new THREE.ExtrudeGeometry(handShape,{depth:.012,bevelEnabled:true,bevelThickness:.003,bevelSize:.003,bevelSegments:1}),ivory,[0,0,0],hand);resources.add(handMesh.geometry);
  const pin=add(new THREE.SphereGeometry(.03,16,10),edge,[0,0,.025],hand);resources.add(pin.geometry);

  // Collapse static parts by material. This avoids one draw call per tick, rivet, or facet.
  staticParts.updateMatrixWorld(true);
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  staticParts.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    let geo=object.geometry.clone();geo.applyMatrix4(object.matrixWorld);
    if(geo.index){const non=geo.toNonIndexed();geo.dispose();geo=non;}
    geo.deleteAttribute('uv');
    const m=object.material as THREE.Material;
    if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geo);
    object.geometry.dispose();
  });
  for(const [m,list] of batches){
    const merged=mergeGeometries(list,false)!;list.forEach(g=>g.dispose());
    const geo=mergeVertices(merged,1e-5);merged.dispose();resources.add(geo);
    const mesh=new THREE.Mesh(geo,m);mesh.name=m.name;root.add(mesh);
  }
  let triangles=0,meshes=0;
  root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
  root.userData={assetVersion:1,kind:'focus-timer',triangles,meshes,units:'meters',reference:'Approved prop concept, 2026-10-10',characterAsset:false};
  return {root,hand,button,haloMaterial,stats:{triangles,meshes},dispose(){resources.forEach(r=>r.dispose());root.clear();}};
}
