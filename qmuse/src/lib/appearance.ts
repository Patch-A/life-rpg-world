export type Gender='male'|'female';
export type AvatarId='male'|'female';
export function validGender(value:unknown):Gender{
 if(value!=='male'&&value!=='female')throw Error('请选择性别');
 return value;
}
export function validAvatar(value:unknown,fallback:Gender):AvatarId{
 if(value===undefined)return fallback;
 if(value!=='male'&&value!=='female')throw Error('请选择角色形象');
 if(value!==fallback)throw Error('角色形象需要与选择的性别一致');
 return value;
}
export function characterGender(profile:{gender?:Gender;avatarId?:AvatarId}|null){return profile?.gender||profile?.avatarId||'male';}
export const clothingGender={explorer:'all',suit:'male',dress:'female'} as const;
export function canWear(gender:Gender,outfit:string){
 const target=clothingGender[outfit as keyof typeof clothingGender];
 return target==='all'||target===gender;
}
export function adultOutfit(gender:Gender){return gender==='male'?'suit':'dress';}
export function adultOutfitName(gender:Gender){return gender==='male'?'星光西装':'月光礼裙';}
export function resolveEquipped(gender:Gender,outfit:string,claims:readonly string[]){
 if(outfit==='explorer')return outfit;
 if(!claims.includes('adult'))return 'explorer';
 if(outfit==='suit'||outfit==='dress')return canWear(gender,outfit)?outfit:adultOutfit(gender);
 return 'explorer';
}
