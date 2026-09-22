import { createContext, useContext, type ReactNode } from "react";

const MediaPlaybackKeyContext = createContext<string | null>(null);

export function MediaPlaybackProvider({
  playbackKey,
  children,
}: {
  playbackKey: string;
  children: ReactNode;
}) {
  return (
    <MediaPlaybackKeyContext.Provider value={playbackKey}>
      {children}
    </MediaPlaybackKeyContext.Provider>
  );
}

export function useMediaPlaybackKey(): string | null {
  return useContext(MediaPlaybackKeyContext);
}
