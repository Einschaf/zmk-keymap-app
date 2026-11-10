import { createContext, useContext, useState } from "react";
import type { HostLayout } from "./hid";

const KEY = "zmk-keymap-app:host-layout";

function load(): HostLayout {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "us" || v === "jis") return v;
  } catch {
    /* storage unavailable */
  }
  return navigator.language.startsWith("ja") ? "jis" : "us";
}

export function useHostLayoutState() {
  const [layout, setLayout] = useState<HostLayout>(load);
  const set = (l: HostLayout) => {
    setLayout(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage unavailable */
    }
  };
  return [layout, set] as const;
}

export const HostLayoutContext = createContext<HostLayout>("us");
export const useHostLayout = () => useContext(HostLayoutContext);
