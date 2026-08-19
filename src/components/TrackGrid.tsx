import type { Track } from "@/types/music";
import { TrackCard } from "@/components/TrackCard";

type TrackGridProps = {
  tracks: Track[];
  currentTrackId: string;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
};

export function TrackGrid({
  tracks,
  currentTrackId,
  isPlaying,
  onSelectTrack
}: TrackGridProps) {
  return (
    <div className="track-grid">
      {tracks.map((track, index) => (
        <TrackCard
          key={track.id}
          track={track}
          index={index}
          active={track.id === currentTrackId}
          isPlaying={isPlaying && track.id === currentTrackId}
          onSelectTrack={onSelectTrack}
        />
      ))}
    </div>
  );
}
