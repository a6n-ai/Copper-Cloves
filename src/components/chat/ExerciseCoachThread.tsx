/**
 * Minimal chat window for the exercise coach (Phase 2/3, monarch/.llm/phases.md).
 * Deliberately plain — assistant-ui's ThreadPrimitive/ComposerPrimitive/MessagePrimitive
 * own all the hard parts (streaming state, tool-call parts, message list), this file is
 * just the visual shell, built on this app's own Button/ScrollArea rather than
 * assistant-ui's pre-styled kit, so it matches the existing design system instead of
 * introducing a second one.
 */
import { AssistantRuntimeProvider, ThreadPrimitive, ComposerPrimitive, MessagePrimitive } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { useState, type FC, type PropsWithChildren } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-sage px-4 py-2.5 text-white-warm">
      <MessagePrimitive.Content components={{ Text: ({ text }) => <p className="whitespace-pre-wrap text-sm">{text}</p> }} />
    </div>
  </MessagePrimitive.Root>
);

const ToolCallBadge: FC<{ toolName: string; status: { type: string } }> = ({ toolName, status }) => (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic px-1">
    {status.type === "running" && <Loader2 className="size-3 animate-spin" />}
    {status.type === "running" ? `Checking ${toolName.replace(/_/g, " ")}…` : `Checked ${toolName.replace(/_/g, " ")}`}
  </div>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-start">
    <div className="max-w-[80%] space-y-1.5">
      <MessagePrimitive.Content
        components={{
          Text: ({ text }) => (
            <div className="rounded-2xl rounded-bl-sm bg-white-warm border border-border px-4 py-2.5">
              <p className="whitespace-pre-wrap text-sm">{text}</p>
            </div>
          ),
          tools: { Fallback: ToolCallBadge },
        }}
      />
    </div>
  </MessagePrimitive.Root>
);

const EmptyState: FC = () => (
  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground px-6">
    <p className="text-sm">Ask about your upcoming classes, your streak, or get a suggestion.</p>
    <p className="text-xs opacity-70">e.g. &quot;what&apos;s my streak?&quot; · &quot;what classes do I have this week?&quot;</p>
  </div>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="flex items-end gap-2 border-t border-border p-3">
    {/*
      asChild + plain <textarea>, bypassing ComposerPrimitive.Input's default
      react-textarea-autosize render: that library doesn't reflect controlled
      value updates into the DOM node under this app's React 19 — composer
      state updates correctly (confirmed via aui.composer.getState()) but the
      textarea stays visually empty. Radix Slot still merges value/onChange/
      onKeyDown etc. onto this element, so behavior is otherwise identical.
    */}
    <ComposerPrimitive.Input asChild>
      <textarea
        placeholder="Ask your coach…"
        rows={1}
        className="flex-1 resize-none rounded-xl border border-border bg-white-warm px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sage/40"
      />
    </ComposerPrimitive.Input>
    <ComposerPrimitive.Send asChild>
      <Button size="icon" className="shrink-0">
        <Send className="size-4" />
      </Button>
    </ComposerPrimitive.Send>
  </ComposerPrimitive.Root>
);

const ScrollFrame: FC<PropsWithChildren> = ({ children }) => (
  <div className="flex h-[70vh] max-h-[720px] w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
    {children}
  </div>
);

export function ExerciseCoachThread() {
  const [transport] = useState(() => new AssistantChatTransport({ api: "/api/chat/coach" }));
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ScrollFrame>
        <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
          <ThreadPrimitive.Viewport className="flex-1 space-y-3 overflow-y-auto p-4">
            <ThreadPrimitive.Empty>
              <EmptyState />
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </ThreadPrimitive.Viewport>
          <Composer />
        </ThreadPrimitive.Root>
      </ScrollFrame>
    </AssistantRuntimeProvider>
  );
}
