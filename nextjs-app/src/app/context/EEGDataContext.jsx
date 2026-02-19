"use client";

import React, { createContext, useContext, useState } from "react";

const EEGDataContext = createContext({
  source: null,
  subject: null,
  runs: null,
  uploadedFileName: null,
  eegData: null,
  setEEGContext: () => {},
});

export function useEEGData() {
  return useContext(EEGDataContext);
}

export default function EEGDataProvider({ children }) {
  const [ctx, setCtx] = useState({
    source: null,
    subject: null,
    runs: null,
    uploadedFileName: null,
    eegData: null,
  });

  const setEEGContext = (updates) => {
    setCtx((prev) => ({ ...prev, ...updates }));
  };

  return (
    <EEGDataContext.Provider value={{ ...ctx, setEEGContext }}>
      {children}
    </EEGDataContext.Provider>
  );
}
