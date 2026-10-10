export type LabAvatar = 'male' | 'female';
export type LabOutfit = 'explorer' | 'formal';
export type LabState = {
  avatar: LabAvatar;
  outfits: Record<LabAvatar, LabOutfit>;
  gifts: Record<LabAvatar, boolean>;
  taskDone: boolean;
};
export type LabAction =
  | {type: 'avatar'; avatar: LabAvatar}
  | {type: 'outfit'; outfit: LabOutfit}
  | {type: 'gift'; avatar: LabAvatar}
  | {type: 'task'}
  | {type: 'reset'};

// Intentionally separate from the real profile, inventory and reward system.
export function createLabState(): LabState {
  return {avatar: 'male', outfits: {male: 'explorer', female: 'explorer'}, gifts: {male: false, female: false}, taskDone: false};
}
export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'avatar': return {...state, avatar: action.avatar};
    case 'outfit':
      if (action.outfit === 'formal' && !state.gifts[state.avatar]) return state;
      return {...state, outfits: {...state.outfits, [state.avatar]: action.outfit}};
    case 'gift':
      if (state.gifts[action.avatar]) return state;
      return {...state, gifts: {...state.gifts, [action.avatar]: true}};
    case 'task': return state.taskDone ? state : {...state, taskDone: true};
    case 'reset': return createLabState();
  }
}
export function labExperience(state: LabState) { return 60 + (state.taskDone ? 20 : 0); }

