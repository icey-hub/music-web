import Image from "next/image";
import { Activity, Radio } from "lucide-react";
import type { PlayerStatus, Track } from "@/types/music";

type NowPlayingPanelProps = {
  track: Track;
  status: PlayerStatus;
  isPlaying: boolean;
  currentIndex: number;
  totalTracks: number;
};

const statusText: Record<PlayerStatus, string> = {
  idle: "Ready",
  loading: "Loading",
  playing: "Playing",
  paused: "Paused",
  fallback: "Unavailable"
};

export function NowPlayingPanel({
  track,
  status,
  isPlaying,
  currentIndex,
  totalTracks
}: NowPlayingPanelProps) {
  return (
    <section
      className="glass-panel-dark accent-ring overflow-hidden p-4"
      style={{
        backgroundImage: `linear-gradient(180deg, hsla(${track.hue}, 88%, 55%, .18), rgba(0,0,0,.58) 46%, rgba(0,0,0,.72))`
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase text-lime-100/80">
          <Radio className="h-4 w-4" />
          Now Playing
        </div>
        <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs text-white/62">
          {currentIndex + 1}/{totalTracks}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/45">
        <Image
          src={track.cover}
          alt={`${track.title} cover`}
          width={640}
          height={640}
          className="aspect-square w-full object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 items-center gap-1 rounded-full border border-lime-300/24 bg-black/36 px-3 text-xs text-lime-100 backdrop-blur">
              <Activity className="h-3.5 w-3.5" />
              {statusText[status]}
            </span>
            {isPlaying ? (
              <span className="flex h-8 items-end gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <span className="h-2 w-1 animate-[pulse_0.8s_ease-in-out_infinite] rounded-full bg-lime-300" />
                <span className="h-4 w-1 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-lime-200" />
                <span className="h-3 w-1 animate-[pulse_0.9s_ease-in-out_infinite] rounded-full bg-lime-400" />
              </span>
            ) : null}
          </div>
          <h2 className="line-clamp-2 text-2xl font-semibold leading-tight text-white">
            {track.title}
          </h2>
          <p className="mt-2 line-clamp-1 text-sm text-white/62">{track.artist}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-3">
          <p className="text-[11px] text-white/42">Hue</p>
          <p className="mt-1 text-sm font-semibold text-lime-100">{track.hue}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-3">
          <p className="text-[11px] text-white/42">Ratio</p>
          <p className="mt-1 text-sm font-semibold text-lime-100">{track.ratio.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.06] px-3 py-3">
          <p className="text-[11px] text-white/42">Span</p>
          <p className="mt-1 text-sm font-semibold text-lime-100">{track.span}</p>
        </div>
      </div>
    </section>
  );
}
