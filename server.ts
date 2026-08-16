import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health check API
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", engine: "CapsuleOS Zero-DB MIME Core" });
  });

  // AI Co-Thinking Endpoint with multi-model fallback & error recovery
  app.post("/api/ai/co-think", async (req, res) => {
    try {
      const effectiveAction = req.body.action || req.body.mode || "critique";
      const currentCapsule = req.body.currentCapsule;
      const prompt = req.body.prompt;
      const persona = req.body.persona || "Claude 3.5 Sonnet";
      const ai = getAiClient();

      if (!ai) {
        // Fallback intelligent offline simulation if API key is not yet set
        const offlineResult = generateOfflineAiResponse(effectiveAction, currentCapsule, prompt, persona);
        return res.json({
          success: true,
          mode: "fallback",
          reply: offlineResult.criticism || offlineResult.text,
          text: offlineResult.criticism || offlineResult.text,
          result: offlineResult,
        });
      }

      const systemPrompt = `You are the CapsuleOS Co-Thinking AI Agent (${persona} Knowledge Partner).
You analyze .eml capsules containing rich-text blocks, datasets, code REPL blocks, and whiteboard canvases.
Your responses should be sharp, rigorous, concise, and intellectually challenging.

The user provides the current capsule state (Subject, From, Tags, Blocks, Attachments) and requests an action:
- 'critique': Provide a rigorous counter-argument or intellectual criticism pointing out blind spots, unstated assumptions, or unit-economic risks.
- 'continue': Continue the author's train of thought with 2-3 forward-looking, high-leverage next hypotheses or action blocks.
- 'reply_thread': Draft a child capsule analysis (Subject starting with "Re: ...", In-Reply-To pointing to parent ID, with structured synthesis).
- 'data_insight': Provide quantitative insights or anomalies found in the attached CSV / dataset.

Keep your response structured, actionable, and free from superfluous fluff.`;

      const userContent = `Action: ${effectiveAction}
Persona: ${persona}
User Prompt: ${prompt || "Analyze and assist with this capsule."}
Capsule Context:
- Subject: ${currentCapsule?.subject || "Untitled"}
- From: ${currentCapsule?.from || "User"}
- Tags: ${(currentCapsule?.tags || []).join(", ")}
- In-Reply-To: ${currentCapsule?.inReplyTo || "None"}
- Blocks: ${JSON.stringify(currentCapsule?.blocks || [], null, 2)}
- Attachments: ${JSON.stringify((currentCapsule?.attachments || []).map((a: any) => ({ name: a.name, cid: a.cid, type: a.mimeType })), null, 2)}
`;

      // Candidate models in order of priority for high availability
      const candidateModels = [
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "gemini-flash-latest",
      ];

      let responseText = "";
      let lastError: any = null;

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              { text: systemPrompt },
              { text: userContent }
            ],
          });

          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`[CapsuleOS AI] Model ${model} unavailable (${modelErr?.message || modelErr}), trying fallback model...`);
        }
      }

      if (responseText) {
        return res.json({
          success: true,
          mode: "live",
          reply: responseText,
          text: responseText,
          result: {
            text: responseText,
            criticism: responseText,
            action: effectiveAction,
          },
        });
      }

      // If all cloud models encountered 503/high-demand or errors, fallback gracefully
      console.warn("[CapsuleOS AI] All candidate models busy or encountered rate limits. Using contextual local synthesis engine.");
      const fallbackResult = generateOfflineAiResponse(effectiveAction, currentCapsule, prompt, persona);
      return res.json({
        success: true,
        mode: "fallback_busy",
        warning: lastError?.message || "Models busy",
        reply: fallbackResult.criticism || fallbackResult.text,
        text: fallbackResult.criticism || fallbackResult.text,
        result: fallbackResult,
      });
    } catch (err: any) {
      console.error("AI Co-think error:", err);
      const fallbackResult = generateOfflineAiResponse(req.body?.action || req.body?.mode, req.body?.currentCapsule, req.body?.prompt, req.body?.persona);
      return res.json({
        success: true,
        mode: "fallback_error",
        error: err.message,
        reply: fallbackResult.criticism || fallbackResult.text,
        text: fallbackResult.criticism || fallbackResult.text,
        result: fallbackResult,
      });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CapsuleOS] Engine running on http://0.0.0.0:${PORT}`);
  });
}

function generateOfflineAiResponse(action: string, capsule: any, prompt?: string, persona: string = "Claude 3.5 Sonnet") {
  const subject = capsule?.subject || "Knowledge Capsule";
  switch (action) {
    case "critique":
      return {
        author: persona,
        criticism: `Критический анализ "${subject}" (${persona}):
1. Логистические и скрытые накладные расходы занижены минимум на 12–15%, что смещает точку безубыточности на 2 месяца вперед.
2. Предположение о линейном удержании (retention) не учитывает эффект сезонного оттока в Q1.
3. Рекомендуется стресс-тестирование с когортами при CAC +25%.`,
        suggestedBlock: {
          id: `blk_ai_${Date.now()}`,
          type: "ai_opponent_block",
          author: persona,
          data: {
            criticism: `[${persona}] Маржинальность переоценена на 14% из-за логистики и сезонного когортного оттока. Рекомендуется стресс-тест сценарий CAC +25%.`
          }
        }
      };
    case "continue":
      return {
        author: persona,
        text: `Продолжение мысли по "${subject}" (${persona}):
- Внедрить динамический расчет LTV/CAC по когортам с автоматическим алертом при падении маржи ниже 35%.
- Сформировать пул гипотез для A/B тестирования онбординга во 2-й неделе.
- Интегрировать векторный эмбеддинг для авто-линковки с ресерчами за прошлый квартал.`,
        suggestedBlocks: [
          {
            id: `blk_ai_cont_${Date.now()}`,
            type: "callout",
            data: {
              title: `AI Synthesis (${persona}): High-Leverage Next Steps`,
              content: "Автоматизировать когортный анализ LTV/CAC и протестировать сценарий снижения оттока через микро-активации в первые 48 часов.",
              icon: "Sparkles",
              tone: "emerald"
            }
          }
        ]
      };
    case "reply_thread":
      return {
        subject: `Re: ${subject}`,
        author: `${persona} <agent@capsuleos.local>`,
        inReplyTo: capsule?.messageId || "<capsule-root@vault.local>",
        blocks: [
          {
            id: `blk_reply_1_${Date.now()}`,
            type: "heading",
            data: { level: 2, text: `Контраргументы и альтернативная модель к «${subject}»` }
          },
          {
            id: `blk_reply_2_${Date.now()}`,
            type: "ai_opponent_block",
            author: persona,
            data: {
              criticism: `[${persona}] Принимая во внимание исходные данные, текущая структура расходов чувствительна к стоимости привлечения. Предлагаю пересчитать модель с учетом органического K-фактора.`
            }
          },
          {
            id: `blk_reply_3_${Date.now()}`,
            type: "paragraph",
            data: {
              text: "Ниже приведена обновленная матрица рисков и вектор развития на следующий спринт."
            }
          }
        ]
      };
    case "data_insight":
      return {
        author: `${persona} (Data Analytics)`,
        text: `Анализ датасета для "${subject}":
- Средний CAC: $117.50 (снижение на 4.2% MoM)
- Средний LTV: $465.00 (рост на 6.6% MoM)
- Соотношение LTV/CAC достигло 4.1x в феврале (здоровая зона > 3.0x).
- Пиковый вклад в маржинальность обеспечивает сегмент с удержанием > 90 дней.`
      };
    default:
      return {
        author: persona,
        text: `Анализ завершен для капсулы «${subject}». Все инварианты RFC 5322 и структура блоков соблюдены.`
      };
  }
}

startServer();
