"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useApp } from "@/context/AppContext";

type InvokeStatus = "idle" | "loading" | "success" | "error";

export function InvokeAgentButton() {
  const [status, setStatus] = useState<InvokeStatus>("idle");
  const { activeView, currentUserId } = useApp();

  function handleClick() {
    setStatus("loading");

    void Sentry.startSpan(
      { name: "invoke-agent-button", op: "ui.click" },
      async () => {
        try {
          const res = await fetch(`/api/agents/${currentUserId}/invoke`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId: activeView.id }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setStatus("success");
        } catch {
          setStatus("error");
        }
      },
    ).then(() => {
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    });
  }

  const label = {
    idle: "A",
    loading: "...",
    success: "\u2713",
    error: "!",
  }[status];

  return (
    <button
      onClick={handleClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 transition-colors"
      title="Invoke agent (dev only)"
    >
      {label}
    </button>
  );
}
