"use client";

import { useEffect, useState } from "react";
import type { PharmacyProductCategory } from "@medisync/contracts";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-xs",
  lg: "h-12 w-12 text-sm",
};

const PRODUCT_CATEGORY_IMAGES: Record<PharmacyProductCategory, string> = {
  OTC_MEDICATION: "/media/products/otc-medication.webp",
  PRESCRIPTION_RX: "/media/products/rx-prescription.webp",
  MEDICAL_DEVICE: "/media/products/medical-device.webp",
  WELLNESS_SUPPLEMENT: "/media/products/wellness-supplement.webp",
  PEDIATRIC_CARE: "/media/products/pediatric-care.webp",
  COLD_CHAIN: "/media/products/cold-chain.webp",
};

const FEMALE_DOCTOR_NAMES = [
  "salma",
  "camille",
  "maya",
  "amina",
  "nadia",
  "claire",
  "sophie",
  "fatima",
  "leila",
  "sarah",
  "marie",
  "elena",
];

/** Picks a curated local medical portrait when no custom photo was uploaded yet. */
export function resolveDefaultAvatar(name: string, role?: string): string {
  const lowerName = name.toLowerCase();
  const normalizedRole = (role ?? "").toUpperCase();

  if (normalizedRole === "DOCTOR" || lowerName.startsWith("dr.")) {
    const looksFemale = FEMALE_DOCTOR_NAMES.some((n) => lowerName.includes(n));
    return looksFemale
      ? "/media/avatars/doctor-female.webp"
      : "/media/avatars/doctor-male.webp";
  }

  if (normalizedRole === "PHARMACIST") {
    return "/media/avatars/pharmacist.webp";
  }
  if (normalizedRole === "LAB_TECH") {
    return "/media/avatars/lab-tech.webp";
  }
  if (normalizedRole === "DRIVER") {
    return "/media/avatars/driver-ems.webp";
  }
  if (normalizedRole === "HOSPITAL_ADMIN" || normalizedRole === "OPS_ADMIN") {
    return "/media/avatars/doctor-male.webp";
  }

  return "/media/avatars/patient.webp";
}

export function resolveProductPicture(
  category: PharmacyProductCategory,
  imageUrl?: string | null,
): string {
  return imageUrl && imageUrl.length > 0
    ? imageUrl
    : PRODUCT_CATEGORY_IMAGES[category];
}

interface EntityAvatarProps {
  name: string;
  role?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

/** Displays a custom S3 avatar if set, falling back smoothly to a bundled studio portrait or initials. */
export function EntityAvatar({
  name,
  role,
  avatarUrl,
  size = "md",
  className = "",
}: EntityAvatarProps) {
  const defaultSrc = resolveDefaultAvatar(name, role);
  const preferredSrc = avatarUrl && avatarUrl.length > 0 ? avatarUrl : defaultSrc;
  const [activeSrc, setActiveSrc] = useState(preferredSrc);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setActiveSrc(preferredSrc);
    setFallbackFailed(false);
  }, [preferredSrc]);

  const sizeClass = SIZE_CLASSES[size];

  if (fallbackFailed) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full border border-teal-200 bg-teal-50 font-bold text-teal-800 ${sizeClass} ${className}`}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={name}
      onError={() => {
        if (activeSrc !== defaultSrc) {
          setActiveSrc(defaultSrc);
        } else {
          setFallbackFailed(true);
        }
      }}
      className={`shrink-0 rounded-full border border-teal-200 bg-slate-100 object-cover ${sizeClass} ${className}`}
    />
  );
}

interface ProductThumbnailProps {
  name: string;
  category: PharmacyProductCategory;
  imageUrl?: string | null;
  className?: string;
}

/** Displays a clean pharmaceutical product packshot with deterministic category fallback. */
export function ProductThumbnail({
  name,
  category,
  imageUrl,
  className = "h-36 w-full",
}: ProductThumbnailProps) {
  const defaultSrc = PRODUCT_CATEGORY_IMAGES[category];
  const preferredSrc = resolveProductPicture(category, imageUrl);
  const [activeSrc, setActiveSrc] = useState(preferredSrc);

  useEffect(() => {
    setActiveSrc(preferredSrc);
  }, [preferredSrc]);

  return (
    <img
      src={activeSrc}
      alt={name}
      loading="lazy"
      onError={() => {
        if (activeSrc !== defaultSrc) {
          setActiveSrc(defaultSrc);
        }
      }}
      className={`rounded-xl border border-slate-200 bg-slate-50 object-cover ${className}`}
    />
  );
}
