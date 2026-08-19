import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/music";

type TrackCardProps = {
  track: Track;
  index: number;
  active: boolean;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
};

export function TrackCard({
  track,
  index,
  active,
  isPlaying,
  onSelectTrack
}: TrackCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelectTrack(track.id)}
      className={cn(
        "group relative min-h-[228px] overflow-hidden rounded-2xl border p-3 text-left shadow-glass transition duration-300",
        track.span === 2 && "sm:row-span-2 sm:min-h-[326px]",
        active
          ? "border-lime-300/60 bg-lime-300/12 shadow-lime-glow"
          : "border-white/10 bg-white/[.075] hover:border-lime-300/34 hover:bg-white/[.11]"
      )}
      style={{
        backgroundImage: active
          ? `linear-gradient(180deg, hsla(${track.hue}, 84%, 54%, .28), rgba(0,0,0,.54))`
          : undefined
      }}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div
          className="h-full w-full"
          style={{
            background: `linear-gradient(160deg, hsla(${track.hue}, 80%, 58%, .22), transparent 58%)`
          }}
        />
      </div>

      <div className="relative flex h-full min-h-[204px] flex-col justify-between">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/35">
          <Image
            src={track.cover}
            alt={`${track.title} cover`}
            fill
            sizes="(max-width: 560px) 48vw, (max-width: 1024px) 25vw, 190px"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/46 via-transparent to-transparent" />
          <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[11px] text-white/72 backdrop-blur">
            {(index + 1).toString().padStart(2, "0")}
          </span>
          <span className="control-button absolute bottom-2 right-2 h-9 w-9">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </span>
        </div>

        <div className="relative pt-3">
          <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-white">
            {track.title}
          </h2>
          <p className="mt-1 line-clamp-1 text-xs text-white/52">{track.artist}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full bg-lime-300 transition-all duration-500",
                active ? "w-full opacity-90" : "w-1/4 opacity-30 group-hover:w-1/2"
              )}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
