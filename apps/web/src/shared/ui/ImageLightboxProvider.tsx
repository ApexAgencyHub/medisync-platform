"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const LazyImageLightboxModal = dynamic(
  () =>
    import("./ImageLightboxModal").then((m) => m.ImageLightboxModal),
  { ssr: false },
);

export interface LightboxSpecItem {
  label: string;
  value: string;
}

export interface LightboxImage {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondarySrc?: string;
  secondaryAlt?: string;
  secondaryLabel?: string;
  initialView?: "primary" | "secondary";
  mimeType?: string;
  downloadUrl?: string;
  badge?: string;
  specs?: readonly LightboxSpecItem[];
  actionHref?: string;
  actionLabel?: string;
}

interface ImageLightboxContextValue {
  openImage: (image: LightboxImage) => void;
  closeImage: () => void;
}

const ImageLightboxContext = createContext<ImageLightboxContextValue>({
  openImage: () => undefined,
  closeImage: () => undefined,
});

export function useImageLightbox(): ImageLightboxContextValue {
  return useContext(ImageLightboxContext);
}

/** Provides a zero-overhead memoized global lightbox context; modal UI is dynamically loaded on first open. */
export function ImageLightboxProvider({ children }: { children: ReactNode }) {
  const [activeImage, setActiveImage] = useState<LightboxImage | null>(null);

  const openImage = useCallback((image: LightboxImage) => {
    setActiveImage(image);
  }, []);

  const closeImage = useCallback(() => {
    setActiveImage(null);
  }, []);

  const contextValue = useMemo(
    () => ({ openImage, closeImage }),
    [openImage, closeImage],
  );

  return (
    <ImageLightboxContext.Provider value={contextValue}>
      {children}
      {activeImage ? (
        <LazyImageLightboxModal
          activeImage={activeImage}
          onClose={closeImage}
        />
      ) : null}
    </ImageLightboxContext.Provider>
  );
}
