"use client";

import Image from "next/image";
import React from "react";
import Logo from "@/app/logo.svg";

type LoadingIndicatorProps = {
  label?: string;
  size?: number;
};

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  label = "Loading",
  size = 64,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-[#154CB3]">
      <div className="flex items-center justify-center">
        <Image
          src={Logo}
          alt="SOCIO is loading"
          width={size}
          height={size}
          className="animate-pulse"
        />
      </div>
      {label ? (
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#063168]/80">
          {label}
        </p>
      ) : null}
    </div>
  );
};

export default LoadingIndicator;
