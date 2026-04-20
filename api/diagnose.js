const FORBIDDEN = ['相談', '専門家', '対策', '手続き', 'すべき', '必要', '緊急'];

function calcScore({ age, spouse, children, realestate, business }) {
  let score = 0;
  if (age === '70代以上' || age === '60代') score += 20;
  else if (age === '50代') score += 10;
  if (spouse === 'いる')     score += 10;
  if (children === 'いる')   score += 15;
  if (realestate === 'ある') score += 25;
  if (business === 'ある')   score += 30;
  return Math.min(score, 100);
}

function getRiskLevel(score) {
  if (score <= 39) return '問題未露出層';
  if (score <= 69) return '表面化予備層';
  return '回避不能層';
}

function checkOutput(text) {
  for (const w of FORBIDDEN) {
    if (text.includes(w)) return false;
  }
  if (/\d{2,}/.test(text)) return false;
  return true;
}

const SYSTEM_PROMPT = `あなたは「相続に関する一次診断コメント」を作成する専門家です。
あなたの役割は、入力情報をもとに、現状を整理し、放置した場合に起きやすいことを示し、次に考えるべき視点を提示することです。

厳守事項：
- 法律・税務の断定は禁止
- 金額・期限・具体的手続きの提示は禁止
- 専門用語は禁止
- 不安を過度に煽らない
- 相談を直接促す表現は禁止
- 全体は落ち着いた客観的な文調で書く

出力構成（必ずこの順で）：
【1. 現状の整理】
現在の状況を、第三者視点で2文で説明する。

【2. 今のまま進んだ場合に起きやすいこと】
一般的に起こりやすい問題を、断定せずに2文で述べる。

【3. 今後考えておきたい視点】
具体的な行動提案は避け、「整理しておくと安心な考え方」を1〜2文で示す。

文章量は全体で300文字以内。敬語は使わない。`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { age, spouse, children, realestate, business } = req.body || {};
  if (!age || !spouse || !children || !realestate || !business) {
    res.status(400).json({ error: '入力が不足しています' }); return;
  }

  const score = calcScore({ age, spouse, children, realestate, business });
  const riskLevel = getRiskLevel(score);
  const familyParts = [spouse === 'いる' ? '配偶者あり' : '配偶者なし', children === 'いる' ? '子あり' : '子なし'];
  const assetParts = [];
  if (realestate === 'ある') assetParts.push('不動産あり');
  if (business === 'ある') assetParts.push('事業・自社株あり');
  if (!assetParts.length) assetParts.push('不動産・事業資産なし');

  const userText = `年代：${age}\n家族構成：${familyParts.join('・')}\n資産状況：${assetParts.join('・')}\n危険度判定：${riskLevel}`;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'APIキーが設定されていません' }); return; }

  let aiText;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 600 }
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error ${response.status}`);
    }
    const data = await response.json();
    aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    res.status(502).json({ error: `AI呼び出しエラー: ${e.message}` }); return;
  }

  if (!aiText || !checkOutput(aiText)) {
    res.status(422).json({ error: '適切なコメントを生成できませんでした。入力を変えて再度お試しください。' }); return;
  }

  const m1 = aiText.match(/【1[^】]*】([\s\S]*?)(?=【2|$)/);
  const m2 = aiText.match(/【2[^】]*】([\s\S]*?)(?=【3|$)/);
  const m3 = aiText.match(/【3[^】]*】([\s\S]*?)$/);

  res.status(200).json({
    r1: m1 ? m1[1].trim() : '',
    r2: m2 ? m2[1].trim() : '',
    r3: m3 ? m3[1].trim() : aiText.trim(),
    meta: `${age}・${familyParts.join('・')}・${assetParts.join('・')}`,
  });
};
