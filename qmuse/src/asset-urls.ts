// Literal Vite asset references support QMuse publication subpaths.
const asset0=new URL("./assets/art-lab/approved-faces.jpg",import.meta.url).href;
const asset1=new URL("./assets/art-lab/explorer-modeling-reference.jpg",import.meta.url).href;
const asset2=new URL("./assets/art-lab/focus-timer-v1.glb",import.meta.url).href;
const asset3=new URL("./assets/character-lab/female-explorer-portrait.webp",import.meta.url).href;
const asset4=new URL("./assets/character-lab/female-explorer.webp",import.meta.url).href;
const asset5=new URL("./assets/character-lab/female-formal-portrait.webp",import.meta.url).href;
const asset6=new URL("./assets/character-lab/female-formal.webp",import.meta.url).href;
const asset7=new URL("./assets/character-lab/male-explorer-portrait.webp",import.meta.url).href;
const asset8=new URL("./assets/character-lab/male-explorer.webp",import.meta.url).href;
const asset9=new URL("./assets/character-lab/male-formal-portrait.webp",import.meta.url).href;
const asset10=new URL("./assets/character-lab/male-formal.webp",import.meta.url).href;
const asset11=new URL("./assets/explorer.png",import.meta.url).href;
const asset12=new URL("./assets/explorer.webp",import.meta.url).href;
const asset13=new URL("./assets/favicon.svg",import.meta.url).href;
const asset14=new URL("./assets/file.svg",import.meta.url).href;
const asset15=new URL("./assets/globe.svg",import.meta.url).href;
const asset16=new URL("./assets/outfit-dress.png",import.meta.url).href;
const asset17=new URL("./assets/outfit-suit.png",import.meta.url).href;
const asset18=new URL("./assets/window.svg",import.meta.url).href;
const asset19=new URL("./assets/world.jpg",import.meta.url).href;
const asset20=new URL("./assets/world.png",import.meta.url).href;
const asset21=new URL("./assets/world.webp",import.meta.url).href;
const assets:Record<string,string>={"/art-lab/approved-faces.jpg":asset0,"/art-lab/explorer-modeling-reference.jpg":asset1,"/art-lab/focus-timer-v1.glb":asset2,"/character-lab/female-explorer-portrait.webp":asset3,"/character-lab/female-explorer.webp":asset4,"/character-lab/female-formal-portrait.webp":asset5,"/character-lab/female-formal.webp":asset6,"/character-lab/male-explorer-portrait.webp":asset7,"/character-lab/male-explorer.webp":asset8,"/character-lab/male-formal-portrait.webp":asset9,"/character-lab/male-formal.webp":asset10,"/explorer.png":asset11,"/explorer.webp":asset12,"/favicon.svg":asset13,"/file.svg":asset14,"/globe.svg":asset15,"/outfit-dress.png":asset16,"/outfit-suit.png":asset17,"/window.svg":asset18,"/world.jpg":asset19,"/world.png":asset20,"/world.webp":asset21};
export function assetUrl(name:string){return assets[name]||name;}
