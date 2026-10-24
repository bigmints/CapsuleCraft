import fs from 'fs';
import path from 'path';

const APP_DATA = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const TAURI_VAULT_DIR = path.join(APP_DATA, 'com.capsuleos.app', 'vault');
const LOCAL_VAULT_DIR = path.resolve('vault');

function assembleMinimalEml(capsule) {
  const boundaryRoot = `BOUNDARY_ROOT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const boundaryPayload = `BOUNDARY_PAYLOAD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const headers = [
    `From: ${capsule.from || 'Author <author@local>'}`,
    `To: ${capsule.to || 'Co-Thinker <agent@local>'}`,
    `Subject: ${capsule.subject || 'Untitled'}`,
    `Date: ${capsule.date || new Date().toUTCString()}`,
    `Message-ID: ${capsule.messageId}`,
  ];

  if (capsule.inReplyTo) headers.push(`In-Reply-To: ${capsule.inReplyTo}`);
  if (capsule.references && capsule.references.length > 0) headers.push(`References: ${capsule.references.join(' ')}`);
  if (capsule.tags && capsule.tags.length > 0) headers.push(`X-Capsule-Tags: ${capsule.tags.join(', ')}`);
  headers.push(`X-Capsule-Status: ${capsule.status || 'Active'}`);
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryRoot}"`);

  const canvasJson = JSON.stringify({
    version: '1.0',
    generator: 'CapsuleOS v2.0 (Zero-DB Pure-MIME Engine)',
    messageId: capsule.messageId,
    subject: capsule.subject,
    tags: capsule.tags || [],
    blocks: capsule.blocks || []
  }, null, 2);

  const parts = [];

  // 1. JSON state payload
  parts.push(
    `--${boundaryRoot}\r\n` +
    `Content-Type: multipart/alternative; boundary="${boundaryPayload}"\r\n\r\n` +
    `--${boundaryPayload}\r\n` +
    `Content-Type: application/json; charset=utf-8\r\n` +
    `Content-Disposition: inline; filename="canvas.json"\r\n\r\n` +
    `${canvasJson}\r\n\r\n` +
    `--${boundaryPayload}--\r\n`
  );

  // 2. Attachments
  for (const att of (capsule.attachments || [])) {
    parts.push(
      `--${boundaryRoot}\r\n` +
      `Content-Type: ${att.mimeType || 'text/plain'}; name="${att.name}"\r\n` +
      `Content-Disposition: attachment; filename="${att.name}"\r\n\r\n` +
      `${att.content}\r\n`
    );
  }

  parts.push(`--${boundaryRoot}--\r\n`);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('');
}

const DEMO_CAPSULES = [
  {
    messageId: '<capsule-strategy-001@vault.local>',
    subject: 'Стратегия развития и масштабирование платформы',
    tags: ['#strategy', '#growth'],
    date: new Date().toUTCString(),
    blocks: [
      { id: 'b1', type: 'heading', data: { level: 1, text: 'Стратегия развития и масштабирование платформы' } },
      {
        id: 'b2',
        type: 'paragraph',
        data: {
          text: 'В будущем мы планируем значительно улучшить продукт и оптимизировать ключевые процессы. Проект ждет грандиозный успех и взрывной рост выручки, наша победа на рынке неизбежна.'
        }
      },
      {
        id: 'b3',
        type: 'callout',
        data: {
          title: 'Ожидания',
          content: 'Мы гарантированно удвоим аудиторию за счет вирального охвата, клиенты в полном восторге от выгоды сервиса.',
          icon: 'Sparkles',
          tone: 'emerald'
        }
      }
    ],
    attachments: []
  },
  {
    messageId: '<capsule-metrics-002@vault.local>',
    subject: 'Анализ юнит-экономики и когорт CAC/LTV',
    tags: ['#analytics', '#finance', '#data'],
    date: new Date(Date.now() - 3600000).toUTCString(),
    blocks: [
      { id: 'm1', type: 'heading', data: { level: 1, text: 'Анализ юнит-экономики и когорт CAC/LTV' } },
      {
        id: 'm2',
        type: 'paragraph',
        data: {
          text: 'Сводные данные за последние шесть месяцев работы. Стоимость привлечения в среднем снижается, однако в апреле зафиксирован аномальный расход на контекстную рекламу.'
        }
      },
      {
        id: 'm3',
        type: 'callout',
        data: {
          title: 'Вывод по метрикам',
          content: 'LTV/CAC держится около 4.2x. Нужно провести аудит апрельского всплеска и проверить каналы дистрибуции.',
          icon: 'TrendingUp',
          tone: 'blue'
        }
      }
    ],
    attachments: [
      {
        name: 'sales_metrics.csv',
        mimeType: 'text/csv',
        content: `Month,CAC,LTV,Revenue_K\nJan,100,410,50\nFeb,105,430,55\nMar,102,450,58\nApr,850,460,60\nMay,98,480,60.1\nJun,95,510,60.2`
      }
    ]
  },
  {
    messageId: '<capsule-arch-003@vault.local>',
    subject: 'Distributed Vault Architecture & High-Load Planning',
    tags: ['#architecture', '#engineering', '#offline'],
    date: new Date(Date.now() - 7200000).toUTCString(),
    blocks: [
      { id: 'a1', type: 'heading', data: { level: 1, text: 'Distributed Vault Architecture & High-Load Planning' } },
      {
        id: 'a2',
        type: 'paragraph',
        data: {
          text: 'We plan to significantly optimize the synchronization engine soon. We must deploy the cluster to staging, measure p99 latency, and test network partitions.'
        }
      },
      {
        id: 'a3',
        type: 'callout',
        data: {
          title: 'Implementation Milestones',
          content: 'First step: verify disk I/O throughput with 50,000 synthetic .eml files under concurrent writes.',
          icon: 'Cpu',
          tone: 'blue'
        }
      }
    ],
    attachments: []
  },
  {
    messageId: '<capsule-reply-004@vault.local>',
    subject: 'Re: Стратегия развития и масштабирование платформы',
    inReplyTo: '<capsule-strategy-001@vault.local>',
    references: ['<capsule-strategy-001@vault.local>'],
    tags: ['#cothink', '#critique'],
    date: new Date(Date.now() - 1800000).toUTCString(),
    blocks: [
      { id: 'r1', type: 'heading', data: { level: 2, text: 'Контраргументы к стратегии масштабирования' } },
      {
        id: 'r2',
        type: 'ai_opponent_block',
        data: {
          criticism: 'Тезис об удвоении аудитории ничем не подкреплен в данных. Отсутствует оценка стоимости привлечения и расчет оттока (churn rate).',
          confidence: 0.86,
          sourceClaim: 'Мы гарантированно удвоим аудиторию за счет вирального охвата'
        }
      },
      {
        id: 'r3',
        type: 'paragraph',
        data: {
          text: 'Необходимо связать стратегию с реальными цифрами из [[Анализ юнит-экономики и когорт CAC/LTV]] перед выходом на совет директоров.'
        }
      }
    ],
    attachments: []
  }
];

// Write to targets
const targets = [TAURI_VAULT_DIR, LOCAL_VAULT_DIR];

for (const dir of targets) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const cap of DEMO_CAPSULES) {
    const fileName = cap.messageId.replace(/[<>]/g, '') + '.eml';
    const filePath = path.join(dir, fileName);
    const emlContent = assembleMinimalEml(cap);
    fs.writeFileSync(filePath, emlContent, 'utf-8');
    console.log(`Saved: ${filePath}`);
  }
}

console.log('Successfully populated test capsules into all vault directories!');
