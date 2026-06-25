"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Send, Bot, User, Loader2,
  Sparkles, WifiOff, Volume2,
} from "lucide-react";

interface Message {
  id: string;
  type: "user" | "bot" | "error";
  text: string;
  time: Date;
}

interface Props {
  config: {
    title?: string;
    language?: string;
    tts?: boolean;
    [key: string]: any;
  };
  isEditMode?: boolean;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function HomeAssistantAssistWidget({ config }: Props) {
  const title = config.title || "HA Assist";
  const language = config.language || "id";
  const ttsEnabled = config.tts !== false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cek koneksi HA saat mount
  useEffect(() => {
    fetch("/api/home-assistant/entities?ping=true")
      .then((r) => r.json())
      .then((j) => setConnected(j.success))
      .catch(() => setConnected(false));
  }, []);

  // TTS menggunakan Web Speech API
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === "id" ? "id-ID" : "en-US";
    utter.rate = 1;
    window.speechSynthesis?.speak(utter);
  }, [ttsEnabled, language]);

  // Kirim pesan ke HA Assist
  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      text: trimmed,
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/home-assistant/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language, conversation_id: conversationId }),
      });
      const json = await res.json();

      if (json.success) {
        const reply = json.data?.response?.speech?.plain?.speech
          || json.data?.response?.speech?.plain?.extra_data?.name
          || "Done.";
        const newConvId = json.data?.conversation_id;
        if (newConvId) setConversationId(newConvId);

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          text: reply,
          time: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        speak(reply);
        setConnected(true);
      } else {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          type: "error",
          text: json.error || "Gagal mendapat respons dari HA.",
          time: new Date(),
        }]);
        setConnected(false);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        type: "error",
        text: "Tidak bisa terhubung ke Home Assistant.",
        time: new Date(),
      }]);
      setConnected(false);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [sending, language, conversationId, speak]);

  // Voice recognition
  const toggleListen = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        type: "error",
        text: "Browser tidak mendukung voice input.",
        time: new Date(),
      }]);
      return;
    }

    const recognition = new SR();
    recognition.lang = language === "id" ? "id-ID" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      send(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, language, send]);

  const clearHistory = () => {
    setMessages([]);
    setConversationId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="py-2 px-3 pb-0 shrink-0">
        <div className="flex items-center justify-between gap-2 pb-2 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-md p-1 bg-primary/10 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold truncate">{title}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Connection dot */}
            <span className={`h-1.5 w-1.5 rounded-full ${
              connected === null ? "bg-muted" :
              connected ? "bg-emerald-500" : "bg-destructive"
            }`} />
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            {ttsEnabled && (
              <Volume2 className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 px-2 py-1 min-h-0 overflow-hidden flex flex-col gap-2">
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="space-y-2 px-1 py-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <Sparkles className="h-6 w-6 text-primary/40" />
                <p className="text-xs text-muted-foreground">
                  Ketik atau bicara untuk kontrol perangkat
                </p>
                <div className="flex flex-wrap gap-1 justify-center mt-1">
                  {["Nyalakan lampu", "Matikan AC", "Kunci pintu"].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => send(ex)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-primary/30 text-primary/70 hover:bg-primary/10 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-1.5 ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.type !== "user" && (
                    <div className={`shrink-0 rounded-full p-1 mt-0.5 self-start ${
                      msg.type === "error" ? "bg-destructive/10" : "bg-primary/10"
                    }`}>
                      {msg.type === "error"
                        ? <WifiOff className="h-2.5 w-2.5 text-destructive" />
                        : <Bot className="h-2.5 w-2.5 text-primary" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[80%] space-y-0.5`}>
                    <div className={`rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                      msg.type === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : msg.type === "error"
                        ? "bg-destructive/10 text-destructive rounded-tl-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                    <p className={`text-[9px] text-muted-foreground/50 px-1 ${
                      msg.type === "user" ? "text-right" : "text-left"
                    }`}>
                      {formatTime(msg.time)}
                    </p>
                  </div>
                  {msg.type === "user" && (
                    <div className="shrink-0 rounded-full p-1 mt-0.5 self-start bg-primary/10">
                      <User className="h-2.5 w-2.5 text-primary" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-1.5 justify-start">
                <div className="shrink-0 rounded-full p-1 mt-0.5 bg-primary/10">
                  <Bot className="h-2.5 w-2.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="shrink-0 flex gap-1.5 items-center border-t pt-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder={listening ? "Mendengarkan..." : "Ketik perintah..."}
              disabled={sending || listening}
              className="h-8 text-xs pr-8"
            />
            {sending && (
              <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon"
            variant={listening ? "destructive" : "outline"}
            className={`h-8 w-8 shrink-0 ${listening ? "animate-pulse" : ""}`}
            onClick={toggleListen}
            disabled={sending}
          >
            {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
