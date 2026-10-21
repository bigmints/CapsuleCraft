import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { CapsuleNode, VaultGraphState } from './types';
import { vaultStore } from './engine/vaultStore';
import { offlineAiResponse } from './engine/offlineAi';
import { assembleEml, parseEml } from './engine/mime';
import { Navbar, ActiveView } from './components/Navbar';
import { VaultSidebar } from './components/VaultSidebar';
import { BlockCanvasEditor } from './components/BlockCanvasEditor';
import { GraphView } from './components/GraphView';
import { ThoughtThreadView } from './components/ThoughtThreadView';
import { RawMimeInspector } from './components/RawMimeInspector';
import { AutonomousHtmlPreview } from './components/AutonomousHtmlPreview';
import { BenchmarkModal } from './components/BenchmarkModal';
import { AiCoThinkModal } from './components/AiCoThinkModal';

export default function App() {
  const [graphState, setGraphState] = useState<VaultGraphState>(() => vaultStore.getState());
  const [selectedMessageId, setSelectedMessageId] = useState<string>('msg-001@capsuleos.local');
  const [activeView, setActiveView] = useState<ActiveView>('canvas');
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Subscribe to VaultStore changes
  useEffect(() => {
    const unsubscribe = vaultStore.subscribe(() => {
      setGraphState(vaultStore.getState());
    });
    return () => unsubscribe();
  }, []);

  const currentCapsule = selectedMessageId
    ? graphState.nodes.get(selectedMessageId) || Array.from(graphState.nodes.values())[0]
    : Array.from(graphState.nodes.values())[0];

  // Update capsule in memory
  const handleUpdateCapsule = useCallback((updated: CapsuleNode) => {
    vaultStore.saveNode(updated);
  }, []);

  // Create new blank capsule
  const handleCreateNewCapsule = useCallback(() => {
    const newId = `msg-${Date.now().toString(36)}@capsuleos.local`;
    const newCapsule: CapsuleNode = {
      messageId: newId,
      subject: 'Новая мысль (RFC 5322)',
      from: 'Alexey <alexey@workspace.local>',
      to: 'CapsuleOS Knowledge Vault <vault@capsuleos.local>',
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      references: [],
      status: 'Active',
      tags: ['#ideation'],
      blocks: [
        {
          id: `blk_${Date.now()}_1`,
          type: 'heading',
          data: { level: 1, text: 'Новая мысль' },
        },
        {
          id: `blk_${Date.now()}_2`,
          type: 'paragraph',
          data: { text: 'Введите текст вашей мысли или нажмите / для вставки таблицы, холста или AI блока...' },
        },
      ],
      attachments: [],
      fileName: `capsule_${Date.now()}.eml`,
    };

    vaultStore.saveNode(newCapsule);
    setSelectedMessageId(newId);
    setActiveView('canvas');
    showToast('Создана новая .eml капсула в оперативной памяти');
  }, []);

  // Create In-Reply-To child capsule. `blocks` lets the caller inject
  // AI-generated content (offline Co-Thinker) instead of the default template.
  const handleCreateReply = useCallback((parentId: string, title?: string, blocks?: CapsuleNode['blocks']) => {
    const parent = graphState.nodes.get(parentId);
    const newId = `msg-reply-${Date.now().toString(36)}@capsuleos.local`;
    const finalTitle = title || (parent ? `Re: ${parent.subject}` : 'Re: Размышление');
    const newCapsule: CapsuleNode = {
      messageId: newId,
      subject: finalTitle,
      from: 'Alexey <alexey@workspace.local>',
      to: 'CapsuleOS Knowledge Vault <vault@capsuleos.local>',
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      inReplyTo: parentId,
      references: parent ? [parentId, ...(parent.references || [])] : [parentId],
      status: 'Active',
      tags: parent ? [...parent.tags] : ['#dialogue'],
      blocks: blocks || [
        {
          id: `blk_${Date.now()}_1`,
          type: 'heading',
          data: { level: 2, text: finalTitle },
        },
        {
          id: `blk_${Date.now()}_2`,
          type: 'paragraph',
          data: { text: 'Дочерняя ветка размышления и аргументации...' },
        },
      ],
      attachments: [],
      fileName: `reply_${Date.now()}.eml`,
    };

    vaultStore.saveNode(newCapsule);
    setSelectedMessageId(newId);
    setActiveView('canvas');
    showToast(`Порождена дочерняя капсула «${finalTitle}» со связью In-Reply-To`);
  }, [graphState.nodes]);

  // Delete Capsule
  const handleDeleteCapsule = useCallback((messageId: string) => {
    const wasSelected = messageId === selectedMessageId;
    vaultStore.deleteNode(messageId);
    // Only reset the selection when the deleted capsule was on screen.
    if (wasSelected) {
      const remaining = Array.from(vaultStore.getState().nodes.keys());
      if (remaining.length > 0) {
        setSelectedMessageId(remaining[0]);
      }
    }
    showToast('Капсула удалена из RAM хранилища');
  }, [selectedMessageId]);

  // Import .eml file
  const handleImportEml = useCallback(async (file: File) => {
    try {
      const rawText = await file.text();
      const parsed = parseEml(rawText, file.name);
      vaultStore.saveNode(parsed);
      setSelectedMessageId(parsed.messageId);
      setActiveView('canvas');
      showToast(`Импортирован файл ${file.name} (RFC 5322)`);
    } catch (err: any) {
      showToast(`Ошибка импорта: ${err.message}`);
    }
  }, []);

  // Export single .eml
  const handleDownloadEml = useCallback((messageId: string) => {
    const node = graphState.nodes.get(messageId);
    if (!node) return;
    const rawEml = node.rawEml || assembleEml(node);
    const blob = new Blob([rawEml], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.fileName || `${node.subject.replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Скачан .eml: ${a.download}`);
  }, [graphState.nodes]);

  // Export whole vault as ZIP
  const handleExportVaultZip = useCallback(async () => {
    const zip = new JSZip();
    const allNodes: CapsuleNode[] = Array.from(graphState.nodes.values());

    for (const node of allNodes) {
      const rawEml = node.rawEml || assembleEml(node);
      const filename = node.fileName || `${node.subject.replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
      zip.file(filename, rawEml);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CapsuleOS_Vault_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Экспортирован архив Vault (${allNodes.length} .eml файлов)`);
  }, [graphState.nodes]);

  // AI Co-Thinking trigger.
  // Accepts both the editor's short actions and the Co-Think modal modes:
  //   critique | counter_arg | synthesis | data_insight | continue | reply_thread
  const handleAiAction = useCallback(async (
    action: 'critique' | 'continue' | 'reply_thread' | 'data_insight' | string,
    customPrompt?: string,
    selectedPersona?: string
  ) => {
    if (!currentCapsule) return;
    setIsAiLoading(true);
    const persona = selectedPersona || 'Claude 3.5 Sonnet';

    // Normalize modal mode names onto engine actions.
    // counter_arg -> reply_thread (child capsule), synthesis -> continue (callout).
    const mode =
      action === 'synthesis' ? 'continue'
      : action === 'counter_arg' ? 'reply_thread'
      : action;

    try {
      const defaultPrompt = mode === 'critique'
        ? `Проведи критический анализ рисков и слабых мест для капсулы "${currentCapsule.subject}"`
        : mode === 'continue'
        ? `Предложи синтез и следующее логическое развитие мысли для капсулы "${currentCapsule.subject}"`
        : mode === 'reply_thread'
        ? `Создай дочерний контраргумент для капсулы "${currentCapsule.subject}"`
        : `Проанализируй данные и метрики капсулы "${currentCapsule.subject}"`;

      const promptToSend = customPrompt || defaultPrompt;

      // Offline deterministic Co-Thinker — no server, no API key needed.
      // (Original implementation called the Gemini-backed /api/ai/co-think endpoint.)
      await new Promise((r) => setTimeout(r, 350)); // keep spinner visible for UX
      const data = offlineAiResponse(mode, currentCapsule, promptToSend, persona);
      const aiReply =
        data.reply ||
        data.text ||
        data.result?.criticism ||
        data.result?.text ||
        (typeof data.result === 'string' ? data.result : '') ||
        'Анализ капсулы завершен.';

      if (mode === 'reply_thread') {
        // Reuse the AI-generated blocks instead of the default template.
        const aiBlocks = data.result?.blocks;
        handleCreateReply(
          currentCapsule.messageId,
          data.result?.subject || `Re: ${currentCapsule.subject} (${persona})`,
          Array.isArray(aiBlocks) && aiBlocks.length > 0 ? aiBlocks : undefined
        );
      } else if (mode === 'continue') {
        const newCallout = {
          id: `blk_ai_cont_${Date.now()}`,
          type: 'callout' as const,
          data: {
            title: `AI Synthesis (${persona})`,
            content: aiReply,
            tone: 'emerald' as const,
          },
        };
        handleUpdateCapsule({
          ...currentCapsule,
          blocks: [...currentCapsule.blocks, newCallout],
        });
        showToast(`AI Synthesis добавлен в капсулу (${persona})`);
      } else if (mode === 'data_insight') {
        const newCallout = {
          id: `blk_ai_data_${Date.now()}`,
          type: 'callout' as const,
          data: {
            title: `Data Insight (${persona})`,
            content: aiReply,
            tone: 'blue' as const,
          },
        };
        handleUpdateCapsule({
          ...currentCapsule,
          blocks: [...currentCapsule.blocks, newCallout],
        });
        showToast(`Data Insight добавлен в капсулу (${persona})`);
      } else {
        // Insert AI Opponent block
        const newBlock = {
          id: `blk_ai_${Date.now()}`,
          type: 'ai_opponent_block' as const,
          author: persona,
          data: {
            criticism: aiReply,
            confidence: 0.94,
            sourceClaim: currentCapsule.subject,
          },
        };
        handleUpdateCapsule({
          ...currentCapsule,
          blocks: [...currentCapsule.blocks, newBlock],
        });
        showToast(`AI Critique добавлен в капсулу (${persona})`);
      }
    } catch (err: any) {
      console.warn('AI API error, using client fallback:', err);
      const fallbackBlock = {
        id: `blk_ai_${Date.now()}`,
        type: 'ai_opponent_block' as const,
        author: persona,
        data: {
          criticism: `Критический анализ рисков [${persona}]: в сценарии "${currentCapsule.subject}" необходимо учесть предел пропускной способности mmap при одновременной записи из нескольких процессов.`,
          confidence: 0.92,
          sourceClaim: currentCapsule.subject,
        },
      };
      handleUpdateCapsule({
        ...currentCapsule,
        blocks: [...currentCapsule.blocks, fallbackBlock],
      });
      showToast('Добавлен блок анализа Co-Thinker');
    } finally {
      setIsAiLoading(false);
      setIsAiModalOpen(false);
    }
  }, [currentCapsule, handleCreateReply, handleUpdateCapsule]);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenBenchmark={() => setIsBenchmarkOpen(true)}
        onOpenAiCoThink={() => setIsAiModalOpen(true)}
        totalCapsules={graphState.graphNodes.length}
        scanDurationMs={graphState.scanStats.scanDurationMs}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Vault File Tree Sidebar */}
        <VaultSidebar
          graphState={graphState}
          selectedMessageId={selectedMessageId}
          onSelectNode={(id) => {
            setSelectedMessageId(id);
          }}
          onCreateNewCapsule={handleCreateNewCapsule}
          onDeleteCapsule={handleDeleteCapsule}
          onImportEml={handleImportEml}
          onExportVaultZip={handleExportVaultZip}
        />

        {/* Center Main Stage View */}
        <main className="flex-1 h-full overflow-hidden bg-slate-950 flex flex-col">
          {activeView === 'canvas' && currentCapsule && (
            <BlockCanvasEditor
              capsule={currentCapsule}
              allCapsules={Array.from(graphState.nodes.values())}
              onUpdateCapsule={handleUpdateCapsule}
              onOpenParent={(parentId) => {
                setSelectedMessageId(parentId);
              }}
              onRequestAiAction={handleAiAction}
              isAiLoading={isAiLoading}
              onOpenCapsule={(id) => {
                if (id) setSelectedMessageId(id);
              }}
            />
          )}

          {activeView === 'graph' && (
            <GraphView
              graphState={graphState}
              selectedMessageId={selectedMessageId}
              onSelectNode={(id) => {
                if (id) setSelectedMessageId(id);
              }}
              onOpenInCanvas={(id) => {
                setSelectedMessageId(id);
                setActiveView('canvas');
              }}
            />
          )}

          {activeView === 'thread' && (
            <ThoughtThreadView
              graphState={graphState}
              selectedMessageId={selectedMessageId}
              onSelectNode={setSelectedMessageId}
              onOpenInCanvas={(id) => {
                setSelectedMessageId(id);
                setActiveView('canvas');
              }}
              onCreateReply={handleCreateReply}
            />
          )}

          {activeView === 'mime' && currentCapsule && (
            <RawMimeInspector
              capsule={currentCapsule}
              onDownloadEml={handleDownloadEml}
            />
          )}

          {activeView === 'html_preview' && currentCapsule && (
            <AutonomousHtmlPreview
              capsule={currentCapsule}
              onDownloadEml={handleDownloadEml}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/50 text-slate-100 text-xs font-mono px-4 py-2.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Benchmark Simulator Modal */}
      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />

      {/* AI Co-Think Modal */}
      {currentCapsule && (
        <AiCoThinkModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          currentCapsule={currentCapsule}
          isLoading={isAiLoading}
          onExecuteAi={(prompt, mode, persona) => {
            handleAiAction(mode, prompt, persona);
          }}
        />
      )}
    </div>
  );
}
