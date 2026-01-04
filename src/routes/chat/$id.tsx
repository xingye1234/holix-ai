import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatContext } from "@/context/chat";
import { SettingsPanelProvider } from "@/context/settings-panel";
import { updateConfig } from "@/lib/config";
import useChat from "@/store/chat";
import { MainContent } from "@/views/main/content";
import MainFooter from "@/views/main/footer";
import { useMessageStore } from "@/store/message";

export const Route = createFileRoute("/chat/$id")({
  component: Component,
});

function Component() {
  const { id } = Route.useParams();
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const chat = useChat((state) => state.chats.find((chat) => chat.uid === id));
  const loadMessages = useMessageStore((state) => state.loadMessages);
  const hasMessages = useMessageStore((state) =>
    id ? !!state.messagesByChatId[id] : false,
  );

  useEffect(() => {
    updateConfig("currentChatId", id);
  }, [id]);

  // 当进入聊天页面且该聊天的消息未加载时，加载消息
  useEffect(() => {
    if (id && !hasMessages) {
      loadMessages(id);
    }
  }, [id, hasMessages, loadMessages]);

  // 使用 useMemo 优化 Context value，避免不必要的重渲染
  const contextValue = useMemo(
    () => ({ chat: chat || null, chatId: id }),
    [chat, id],
  );

  const settingsPanelValue = useMemo(
    () => ({
      isOpen: isSettingsPanelOpen,
      toggle: () => setIsSettingsPanelOpen((prev) => !prev),
      open: () => setIsSettingsPanelOpen(true),
      close: () => setIsSettingsPanelOpen(false),
    }),
    [isSettingsPanelOpen],
  );

  return (
    <ChatContext.Provider value={contextValue}>
      <SettingsPanelProvider value={settingsPanelValue}>
        <div className="w-full h-[calc(100vh - var(--app-header-height))] flex">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            <MainContent />
            <MainFooter />
          </div>

          {/* Settings Panel */}
          {isSettingsPanelOpen && (
            <div className="w-80 border-l bg-background flex flex-col">
              <div className="h-(--app-header-height) border-b px-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">设置</h2>
                <Button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsSettingsPanelOpen(false)}
                  title="关闭"
                  variant="ghost"
                >
                  ✕
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <p className="text-sm text-muted-foreground">设置面板内容</p>
                {/* TODO: 添加设置选项 */}
              </div>
            </div>
          )}
        </div>
      </SettingsPanelProvider>
    </ChatContext.Provider>
  );
}
