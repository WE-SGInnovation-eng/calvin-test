export interface Frame {
  id: number;
  action: string;
  audio: string;
  textOverlay: string;
  camera: string;
  imagePrompt: string;
  imageUrl?: string; // Base64 string
  isGeneratingImage?: boolean;
}

export interface AssetList {
  music: string;
  props: string[];
  talent: string[];
}

export interface Strategy {
  title: string;
  hook: string;
  style: string;
}

export interface StoryboardData {
  strategy: Strategy;
  frames: Frame[];
  assets: AssetList;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  VISUALIZING = 'VISUALIZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}