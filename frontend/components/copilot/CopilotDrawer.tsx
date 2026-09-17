"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Send, X } from "lucide-react";

import { ConfidenceRing } from "@/components/charts/ConfidenceRing";
import { Button } from "@/components/ui/button";
import { DisclaimerBar } from "@/components/ui/disclaimer-bar";
import { ModeBadge } from "@/components/ui/mode-badge";
import { MrnChip } from "@/components/ui/mrn-chip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/cn";
import { useAppState } from "@/hooks/useAppState";
import { apiClient, ApiError } from "@/lib/api";
import type {
  AiMode,
  CopilotChatResponse,
  CopilotCitation,
  CopilotConversationMessage,
  CopilotConversationSummary,
  ResultMode,
} from "@/lib/contracts";


type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  renderMode: ResultMode;
  aiMode: AiMode;
  contextUsed?: boolean;
  citations?: CopilotCitation[];
  insufficientEvidence?: boolean;
};

function buildDemoReply(message: string, patientName?: string): CopilotChatResponse {
  return {
    conversation_id: 0,
    patient_id: 1,
    message_id: Date.now(),
    reply: patientName
      ? `Demo mode response for ${patientName}: this is sample guidance only. Ask again in connected mode for a chart-grounded summary.\n\nQuestion: ${message}`
      : `Demo mode response: no connected patient context is available in demo mode.\n\nQuestion: ${message}`,
    citations: [],
    disclaimer:
      "Clinical decision support only. Verify findings with licensed clinical judgment.",
    mode: "demo",
    ai_mode: null,
    context_used: Boolean(patientName),
    timeline_event_id: null,
  };
}

function coerceResultMode(value: unknown, fallback: ResultMode): ResultMode {
  return value === "real" || value === "fallback" || value === "demo" || value === "error"
    ? value
    : fallback;
}

function coerceAiMode(value: unknown): AiMode {
  return value === "openai" || value === "heuristic" ? value : null;
}

function mapPersistedMessage(message: CopilotConversationMessage): CopilotMessage {
  const role = message.role === "assistant" ? "assistant" : "user";
  const metadata = message.metadata ?? {};
  const renderMode = coerceResultMode(metadata.mode, role === "assistant" ? "fallback" : "real");
  const contextUsed =
    typeof metadata.context_used === "boolean" ? metadata.context_used : undefined;

  return {
    id: `persisted-${message.id}`,
    role,
    content: message.content,
    renderMode,
    aiMode: coerceAiMode(metadata.ai_mode),
    contextUsed,
    citations: message.citations,
    insufficientEvidence: metadata.insufficient_evidence === true,
  };
}

function buildAssistantMessage(payload: CopilotChatResponse, mode: ResultMode): CopilotMessage {
  return {
    id: `assistant-${payload.message_id}`,
    role: "assistant",
    content: payload.reply,
    renderMode: mode,
    aiMode: payload.ai_mode,
    contextUsed: payload.context_used,
    citations: payload.citations,
    insufficientEvidence: payload.insufficient_evidence === true,
  };
}

function buildConversationTitle(tab: CopilotConversationSummary, fallbackMessage?: string): string {
  return tab.title?.trim() || fallbackMessage?.trim().slice(0, 80) || "Untitled chat";
}

export function CopilotDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { demoMode, selectedPatient, selectedPatientId, notifyPatientActivity, hydrated, copilotPrefill, clearCopilotPrefill } = useAppState();
  const asideRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [draftMessages, setDraftMessages] = useState<CopilotMessage[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, CopilotMessage[]>>({});
  const [conversationTabs, setConversationTabs] = useState<CopilotConversationSummary[]>([]);
  const [closedConversationIds, setClosedConversationIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<number | null>(null);
  // Guard against null === null: with no prior conversations the drawer must
  // not look like it is loading, and Send must stay enabled.
  const isLoadingActiveConversation =
    activeConversationId != null && loadingConversationId === activeConversationId;
  const [error, setError] = useState<string | null>(null);

  const visibleTabs = conversationTabs.filter(
    (tab) => !closedConversationIds.includes(tab.id),
  );
  const messages =
    activeConversationId != null
      ? messagesByConversation[activeConversationId] ?? []
      : draftMessages;

  // Focus management: move focus into the drawer on open, restore on close,
  // close on Escape, and keep Tab inside the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const aside = asideRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !aside) return;
      const focusable = Array.from(
        aside.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute("hidden"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      // Never leave focus inside the hidden drawer: go back to the opener, else the top-bar trigger.
      if (aside?.contains(document.activeElement)) {
        const target = previous && previous !== document.body ? previous : document.querySelector<HTMLElement>("[data-copilot-trigger]");
        target?.focus();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && copilotPrefill) {
      setInput(copilotPrefill);
      clearCopilotPrefill();
      inputRef.current?.focus();
    }
  }, [open, copilotPrefill, clearCopilotPrefill]);

  useEffect(() => {
    setDraftMessages([]);
    setMessagesByConversation({});
    setConversationTabs([]);
    setClosedConversationIds([]);
    setActiveConversationId(null);
    setInput("");
    setError(null);
  }, [demoMode, selectedPatientId]);

  useEffect(() => {
    if (!open || !hydrated) {
      return;
    }

    let cancelled = false;

    const loadConversations = async () => {
      try {
        const result = await apiClient.fetchCopilotConversations(
          selectedPatientId,
          {
            demoMode,
            fallback: () => [],
          },
        );

        if (cancelled) {
          return;
        }

        setConversationTabs(result.data);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        const message =
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load previous Copilot conversations.";
        setError(message);
      }
    };

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [demoMode, open, selectedPatientId, hydrated]);

  useEffect(() => {
    if (draftMessages.length > 0) {
      return;
    }

    if (
      activeConversationId != null &&
      visibleTabs.some((tab) => tab.id === activeConversationId)
    ) {
      return;
    }

    setActiveConversationId(visibleTabs[0]?.id ?? null);
  }, [activeConversationId, draftMessages.length, visibleTabs]);

  useEffect(() => {
    if (!open || activeConversationId == null || messagesByConversation[activeConversationId]) {
      return;
    }

    let cancelled = false;

    const loadConversation = async () => {
      setLoadingConversationId(activeConversationId);

      try {
        const result = await apiClient.fetchCopilotConversation(activeConversationId);
        if (cancelled) {
          return;
        }

        setMessagesByConversation((current) => ({
          ...current,
          [activeConversationId]: result.data.messages.map(mapPersistedMessage),
        }));
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        const message =
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load that Copilot conversation.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoadingConversationId((current) =>
            current === activeConversationId ? null : current,
          );
        }
      }
    };

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, messagesByConversation, open]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) {
      return;
    }

    const targetConversationId = activeConversationId;
    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      renderMode: "real",
      aiMode: null,
    };
    const baseMessages =
      targetConversationId != null
        ? messagesByConversation[targetConversationId] ?? []
        : draftMessages;
    const optimisticMessages = [...baseMessages, userMessage];

    setInput("");
    setError(null);
    if (targetConversationId != null) {
      setMessagesByConversation((current) => ({
        ...current,
        [targetConversationId]: optimisticMessages,
      }));
    } else {
      setDraftMessages(optimisticMessages);
    }
    setLoading(true);

    try {
      const result = await apiClient.copilotChat(
        {
          message,
          context_patient_id: selectedPatientId,
          conversation_id: targetConversationId,
        },
        {
          demoMode,
          fallback: () => buildDemoReply(message, selectedPatient?.name),
          fallbackMessage: "Demo mode is enabled. Showing demo copilot output.",
        },
      );

      if (result.warning) {
        setError(result.warning);
      }

      const assistantMessage = buildAssistantMessage(result.data, result.mode);

      if (result.data.conversation_id && result.mode !== "demo") {
        const resolvedConversationId = result.data.conversation_id;
        const nextMessages = [...optimisticMessages, assistantMessage];

        setMessagesByConversation((current) => ({
          ...current,
          [resolvedConversationId]: nextMessages,
        }));
        setDraftMessages([]);
        setActiveConversationId(resolvedConversationId);
        setClosedConversationIds((current) =>
          current.filter((conversationId) => conversationId !== resolvedConversationId),
        );
        setConversationTabs((current) => {
          const existing = current.find((tab) => tab.id === resolvedConversationId);
          const updatedTab: CopilotConversationSummary = {
            id: resolvedConversationId,
            patient_id: result.data.patient_id,
            title: existing?.title ?? message.slice(0, 80),
            created_at: existing?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: nextMessages.length,
            latest_message_preview: result.data.reply.slice(0, 160),
          };
          return [
            updatedTab,
            ...current.filter((tab) => tab.id !== resolvedConversationId),
          ];
        });
      } else if (targetConversationId != null) {
        setMessagesByConversation((current) => ({
          ...current,
          [targetConversationId]: [...optimisticMessages, assistantMessage],
        }));
      } else {
        setDraftMessages([...optimisticMessages, assistantMessage]);
      }

      if (
        result.mode !== "demo" &&
        result.data.timeline_event_id &&
        selectedPatientId
      ) {
        notifyPatientActivity(
          "Copilot interaction added to the patient timeline.",
          selectedPatientId,
        );
      }
    } catch (caughtError) {
      const messageText =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to reach Copilot right now.";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setDraftMessages([]);
    setInput("");
    setError(null);
  };

  const handleCloseConversation = (conversationId: number) => {
    setClosedConversationIds((current) =>
      current.includes(conversationId) ? current : [...current, conversationId],
    );

    if (conversationId !== activeConversationId) {
      return;
    }

    const remainingTabs = visibleTabs.filter((tab) => tab.id !== conversationId);
    setActiveConversationId(remainingTabs[0]?.id ?? null);
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const sources = lastAssistant?.citations ?? [];

  return (
    // inert removes the closed drawer from the tab order and the accessibility tree (axe: aria-hidden-focus)
    <div className={`absolute inset-0 z-30 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div className={`absolute inset-0 bg-ink-900/30 transition-opacity duration-[var(--rs-motion-base)] ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Copilot"
        className={`absolute inset-y-0 right-0 flex w-full flex-col lg:max-w-[420px] border-l border-border-hairline bg-surface-raised shadow-elevation-2 transition-transform duration-[var(--rs-motion-base)] ease-[var(--rs-motion-ease)] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-border-hairline px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Bot className="h-4 w-4 text-accent-600" aria-hidden="true" />
            Copilot
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleNewChat}>
              New chat
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Copilot">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border-hairline bg-surface-sunken px-5 py-2 text-2xs text-ink-500">
          Context:
          {selectedPatient ? <MrnChip name={selectedPatient.name} mrn={selectedPatient.mrn} className="text-xs" /> : <span>No connected patient selected</span>}
        </div>

        {visibleTabs.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-border-hairline px-5 py-2" role="tablist" aria-label="Conversations">
            {visibleTabs.map((tab) => {
              const active = tab.id === activeConversationId;
              return (
                <div key={tab.id} className={cn("flex max-w-[220px] shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5", active ? "border-accent-100 bg-accent-050 text-accent-700" : "border-border-hairline text-ink-500")}>
                  <button type="button" role="tab" aria-selected={active} className="min-w-0 flex-1 truncate text-left text-2xs font-medium" onClick={() => setActiveConversationId(tab.id)}>
                    {buildConversationTitle(tab)}
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-surface"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseConversation(tab.id);
                    }}
                    aria-label={`Close ${buildConversationTitle(tab)} tab`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {isLoadingActiveConversation && messages.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface-sunken p-3 text-xs text-ink-500">
              <ConfidenceRing value={null} size={28} state="loading" title="Loading conversation" label={null} />
              Loading conversation…
            </div>
          ) : null}

          {messages.length === 0 && !isLoadingActiveConversation ? (
            <div className="space-y-3">
              <p className="rounded-md border border-dashed border-border-strong bg-surface-sunken p-3 text-xs text-ink-500">
                Ask about a report, triage concern, or evidence question. Responses are clinical decision support only and should be verified before use.
              </p>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Suggested</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => setInput(prompt)} className="rounded-pill border border-border-hairline px-2.5 py-1 text-2xs text-ink-700 hover:border-accent-600 hover:text-accent-700">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={cn("rounded-lg px-4 py-3", message.role === "assistant" ? "bg-surface-sunken text-ink-900" : "ml-8 bg-accent-050 text-ink-900")}>
              <div className="mb-1.5 flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">
                {message.role === "assistant" ? "Copilot" : "You"}
                {message.role === "assistant" ? <ModeBadge mode={message.renderMode} /> : null}
              </div>
              {message.role === "assistant" && message.insufficientEvidence ? (
                <p className="mb-2 flex items-start gap-2 rounded-md border border-severity-moderate/30 bg-severity-moderate-bg px-3 py-2 text-xs text-ink-900">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-severity-moderate" aria-hidden="true" />
                  <span>
                    <strong>Insufficient evidence</strong> — no indexed source supports this answer fully. Consult the primary team before acting on it.
                  </span>
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderWithRefs(message.content, message.citations ?? [])}</p>
              {message.role === "assistant" && message.contextUsed != null ? (
                <p className="mt-2 text-2xs text-ink-500">
                  {message.contextUsed ? "Used connected patient context" : "No connected patient context used"}
                  {message.aiMode ? ` · AI processing ${message.aiMode}` : ""}
                </p>
              ) : null}
            </div>
          ))}

          {loading ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-sunken px-4 py-3 text-xs text-ink-500">
              <ConfidenceRing value={null} size={28} state="loading" title="Copilot is thinking" label={null} />
              Copilot is thinking…
            </div>
          ) : null}

          {sources.length > 0 ? (
            <section aria-labelledby="copilot-sources-title" className="rounded-lg border border-border-hairline p-3">
              <h4 id="copilot-sources-title" className="text-2xs font-semibold uppercase tracking-[0.05em] text-ink-500">Sources</h4>
              <ol className="mt-2 space-y-1.5">
                {sources.map((citation, index) => (
                  <li key={`${citation.citation_id ?? citation.title}-${index}`} className="flex items-center gap-2 text-xs text-ink-700">
                    <ConfidenceRing value={citation.score != null ? Math.round(citation.score * 100) : null} size={16} title={`Relevance for ${citation.title}`} label={null} />
                    <span className="font-mono text-2xs text-accent-700">[{index + 1}]</span>
                    <span className="min-w-0 flex-1 truncate">
                      {citation.title}
                      {citation.section ? <span className="text-ink-500">, {citation.section}</span> : null}
                    </span>
                    {citation.score != null ? <span className="font-mono text-2xs text-ink-500 rs-tabular">{citation.score.toFixed(2)}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="border-t border-border-hairline px-5 py-3">
          {error ? <p className="mb-2 text-2xs text-severity-critical" role="alert">{error}</p> : null}
          <DisclaimerBar className="mb-3" />
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              placeholder="Ask Copilot…"
              aria-label="Message Copilot"
              className="min-h-[44px]"
            />
            <Button onClick={() => void handleSend()} loading={loading} disabled={isLoadingActiveConversation} size="icon" aria-label="Send">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

const SUGGESTED_PROMPTS = ["Summarize this patient's imaging history", "What's the surgical urgency here?"];

/** Turns inline citation ids like [E1] or [1] into superscript [n] markers that match the Sources list. */
function renderWithRefs(content: string, citations: CopilotCitation[]) {
  if (citations.length === 0) return content;
  const ids = citations.map((c, index) => ({ id: c.citation_id ?? String(index + 1), index: index + 1 }));
  const parts = content.split(/(\[[A-Za-z]?\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[([A-Za-z]?\d+)\]$/);
    if (!match) return part;
    const hit = ids.find((x) => x.id === match[1]) ?? ids.find((x) => String(x.index) === match[1].replace(/^[A-Za-z]/, ""));
    return hit ? (
      <sup key={i} className="font-mono text-2xs text-accent-700">
        [{hit.index}]
      </sup>
    ) : (
      part
    );
  });
}
