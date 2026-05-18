"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AIConfig, activeModel, defaultConfig, isConfigured, loadConfig, saveConfig } from "../lib/ai-config";
import { ProviderId } from "../lib/ai-providers";

interface AIContextValue {
  config: AIConfig;
  setConfig: (next: AIConfig) => void;
  setActiveProvider: (id: ProviderId | "local") => void;
  updateProvider: (id: ProviderId, patch: Partial<{ apiKey: string; model: string; baseUrl: string }>) => void;
  configured: boolean;
  active: ReturnType<typeof activeModel>;
}

const Ctx = createContext<AIContextValue | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AIConfig>(defaultConfig());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfigState(loadConfig());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveConfig(config);
  }, [config, hydrated]);

  const setConfig = useCallback((next: AIConfig) => setConfigState(next), []);

  const setActiveProvider = useCallback(
    (id: ProviderId | "local") => setConfigState((c) => ({ ...c, activeProvider: id })),
    []
  );

  const updateProvider = useCallback(
    (id: ProviderId, patch: Partial<{ apiKey: string; model: string; baseUrl: string }>) =>
      setConfigState((c) => ({
        ...c,
        perProvider: { ...c.perProvider, [id]: { ...c.perProvider[id], ...patch } },
      })),
    []
  );

  return (
    <Ctx.Provider
      value={{
        config,
        setConfig,
        setActiveProvider,
        updateProvider,
        configured: isConfigured(config),
        active: activeModel(config),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAI must be used inside AIProvider");
  return ctx;
}
