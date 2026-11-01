import {assetUrl} from '@/asset-urls';
import {canWear,type AvatarId} from './appearance';

// Only compatible clothing can reach a renderer, including unsaved previews.
const artwork = {
  male: {explorer: 'male-explorer', suit: 'male-formal', dress: 'male-explorer'},
  female: {explorer: 'female-explorer', suit: 'female-explorer', dress: 'female-formal'},
} as const;
export function characterArt(avatar: AvatarId, outfit = 'explorer', portrait = false) {
  const key = canWear(avatar,outfit)&&(outfit === 'suit' || outfit === 'dress') ? outfit : 'explorer';
  return assetUrl(`/character-lab/${artwork[avatar][key]}${portrait ? '-portrait' : ''}.webp`);
}
export function characterDescription(avatar: AvatarId, outfit = 'explorer') {
  if(!canWear(avatar,outfit))outfit='explorer';
  return `${avatar === 'male' ? '男生' : '女生'}探索者，身穿${outfit === 'suit' ? '星光西装' : outfit === 'dress' ? '星光礼裙' : '启程探索装'}`;
}
