"use client";

import { useEffect, useState } from "react";
import { Bot, Send, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

function modeLabel(mode: ResultMode): string {
  if (mode === "real") return "Connected";
  if (mode === "fallback") return "Connected fallback";
  if (mode === "demo") return "Demo";
  return "Error";
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
  const { demoMode, selectedPatient, selectedPatientId, notifyPatientActivity } = useAppState();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [draftMessages, setDraftMessages] = useState<CopilotMessage[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, CopilotMessage[]>>({});
  const [conversationTabs, setConversationTabs] = useState<CopilotConversationSummary[]>([]);
  const [closedConversationIds, setClosedConversationIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleTabs = conversationTabs.filter(
    (tab) => !closedConversationIds.includes(tab.id),
  );
  const messages =
    activeConversationId != null
      ? messagesByConversation[activeConversationId] ?? []
      : draftMessages;

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
    if (!open) {
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
  }, [demoMode, open, selectedPatientId]);

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

  return (
    <div
      className={`absolute inset-0 z-30 transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-[#101828]/20 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-[#E6ECF5] bg-white shadow-[-18px_0_45px_rgba(15,23,42,0.08)] transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#E6ECF5] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#4C8DFF]" />
              <h3 className="text-sm font-semibold text-[#101828]">RediSense Copilot</h3>
            </div>
            <p className="mt-1 text-[11px] text-[#667085]">
              {selectedPatient
                ? `Context: ${selectedPatient.name} · MRN ${selectedPatient.mrn ?? "N/A"}`
                : "No connected patient selected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewChat}>
              New chat
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="border-b border-[#E6ECF5] px-5 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleTabs.length === 0 ? (
              <p className="py-1 text-[11px] text-[#98A2B3]">
                Previous Copilot conversations will appear here.
              </p>
            ) : (
              visibleTabs.map((tab) => {
                const active = tab.id === activeConversationId;
                return (
                  <div
                    key={tab.id}
                    className={`flex max-w-[240px] shrink-0 items-center gap-1 rounded-full border px-2 py-1 ${
                      active
                        ? "border-[#C7D7FE] bg-[#EAF2FF] text-[#1D4ED8]"
                        : "border-[#E6ECF5] bg-white text-[#667085]"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[11px] font-medium"
                      onClick={() => setActiveConversationId(tab.id)}
                    >
                      {buildConversationTitle(tab)}
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-1 transition-colors hover:bg-white/80 hover:text-[#101828]"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCloseConversation(tab.id);
                      }}
                      aria-label={`Close ${buildConversationTitle(tab)} tab`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loadingConversationId === activeConversationId && messages.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] p-4 text-sm text-[#667085]">
              Loading conversation…
            </div>
          ) : null}

          {messages.length === 0 && loadingConversationId !== activeConversationId ? (
            <div className="rounded-[20px] border border-dashed border-[#E6ECF5] bg-[#F8FAFD] p-4 text-sm text-[#667085]">
              Ask about a report, triage concern, or evidence question. Responses are
              clinical decision support only and should be verified before use.
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-[20px] px-4 py-3 ${
                message.role === "assistant"
                  ? "bg-[#F8FAFD] text-[#101828]"
                  : "ml-10 bg-[#EAF2FF] text-[#1D4ED8]"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em]">
                {message.role === "assistant" ? (
                  <Bot className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
                {message.role}
                {message.role === "assistant" ? (
                  <Badge
                    tone={
                      message.renderMode === "real"
                        ? "success"
                        : message.renderMode === "fallback"
                          ? "warning"
                          : message.renderMode === "demo"
                            ? "outline"
                            : "danger"
                    }
                  >
                    {modeLabel(message.renderMode)}
                  </Badge>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              {message.role === "assistant" && message.contextUsed != null ? (
                <p className="mt-2 text-[11px] text-[#667085]">
                  {message.contextUsed
                    ? "Used connected patient context"
                    : "No connected patient context used"}
                  {message.aiMode ? ` · AI processing ${message.aiMode}` : ""}
                </p>
              ) : null}
              {message.citations && message.citations.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {message.citations.map((citation) => (
                    <div
                      key={`${message.id}-${citation.title}`}
                      className="rounded-[14px] border border-[#E6ECF5] bg-white px-3 py-2 text-xs text-[#667085]"
                    >
                      <p className="font-medium text-[#101828]">{citation.title}</p>
                      <p>
                        {[citation.source, citation.section].filter(Boolean).join(" · ")}
                      </p>
                      {citation.snippet ? (
                        <p className="mt-1 text-[#667085]">{citation.snippet}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}

          {loading ? (
            <div className="rounded-[20px] bg-[#F8FAFD] px-4 py-3 text-sm text-[#667085]">
              Copilot is thinking…
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#E6ECF5] px-5 py-4">
          {error ? <p className="mb-3 text-[11px] text-[#B42318]">{error}</p> : null}
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            rows={4}
            placeholder="Ask Copilot about the active patient, report, or evidence question..."
            className="rounded-[18px] border-[#E6ECF5]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#98A2B3]">
              Clinical decision support only. Verify before acting.
            </p>
            <Button
              onClick={() => void handleSend()}
              loading={loading}
              disabled={loadingConversationId === activeConversationId}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
