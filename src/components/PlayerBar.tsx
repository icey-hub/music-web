import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { Track } from "@/types/music";

type Player = {
  currentTrack: Track;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (value: number) => void;
  setVolume: (value: number) => void;
};

type PlayerBarProps = {
  player: Player;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function PlayerBar({ player }: PlayerBarProps) {
  const progressMax = Math.max(1, player.duration);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/55 px-3 py-3 backdrop-blur-glass">
      <div className="mx-auto grid max-w-[1420px] items-center gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(240px,520px)_minmax(150px,1fr)]">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-semibold text-white">{player.currentTrack.title}</p>
          <p className="line-clamp-1 text-xs text-white/50">{player.currentTrack.artist}</p>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-center gap-2">
            <button
              type="button"
              className="control-button h-10 w-10"
              onClick={player.previous}
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="control-button h-12 w-12 border-lime-300/32 bg-lime-300/18 text-lime-100"
              onClick={player.togglePlay}
              aria-label={player.isPlaying ? "Pause" : "Play"}
            >
              {player.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button
              type="button"
              className="control-button h-10 w-10"
              onClick={player.next}
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-2 text-[11px] text-white/48">
            <span>{formatTime(player.progress)}</span>
            <input
              className="slider"
              type="range"
              min={0}
              max={progressMax}
              step={1}
              value={Math.min(player.progress, progressMax)}
              onChange={(event) => player.seek(Number(event.target.value))}
              aria-label="Playback progress"
            />
            <span className="text-right">{formatTime(player.duration)}</span>
          </div>
        </div>

        <div className="hidden items-center justify-end gap-2 sm:flex">
          <Volume2 className="h-4 w-4 text-white/54" />
          <input
            className="slider max-w-[130px]"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}
