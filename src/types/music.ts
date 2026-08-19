export type Track = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  audio: string;
  hue: number;
  ratio: number;
  span: number;
};

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "fallback";
