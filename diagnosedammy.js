export const config = { runtime: 'edge' };

/**
 * 完全コスト0運用用フラグ
 * true  : ダミー診断文を返す（API未使用）
 * false : 本番用（将来Claude API接続）
 */
const USE_DUMMY = true;

/**
 * 危険表現チェック（本番用に残す）
 */
const FORBIDDEN = ['相談', '専門家', '対策', '手続き', 'すべき', '必要', '緊急'];
function checkOutput(text) {
  for (const w of FORBIDDEN) {
    if (text.includes(w)) return false;
  }
  if (/\d{2,}/.test(text)) return false;
  return true;
}

/**
 * スコア計算（既存仕様維持）
 */
function calcScore(answers) {
  let score = 0;
  if (answers.age === '60代' || answers.age === '70代以上') score += 20;
  else if (answers.age === '50代') score += 10;
  if (answers.spouse === 'いる') score += 10;
  if (answers.children === 'いる') score += 15;
  if (answers.realestate === 'ある') score += 25;
  if (answers.business === 'ある') score += 30;
  return Math.min(score, 100);
}

/**
 * 区分判定（内部用）
 */
function getRiskLevel(score) {
  if (score <= 39) return '問題未露出層';
  if (score <= 69) return '表面化予備層';
  return '回避不能層';
}

/**
 * ダミー診断文（本番仕様と同一構造）
 */
const DUMMY_TEXT = {
  '問題未露出層': `
【1. 現状の整理】
現在の状況では、相続に関する具体的な問題が表に出ている状態ではない。
一方で、家族構成や資産の形によって将来の影響が変わる前提はすでに成立している。

【2. 今のまま進んだ場合に起きやすいこと】
時間の経過とともに、判断を要する場面が突然現れることがある。
準備の有無に関係なく、周囲が動き出すケースも少なくない。

【3. 今後考えておきたい視点】
状況を整理する軸を、早めに持っておくこと自体が安心につながる。
「いつ考えるか」を意識しておくことが一つの視点になる。
`,
  '表面化予備層': `
【1. 現状の整理】
現在の条件では、相続に関する論点がいくつか存在している状態といえる。
まだ顕在化していないが、前提条件はすでに揃っている。

【2. 今のまま進んだ場合に起きやすいこと】
想定していなかったタイミングで話題が持ち上がることがある。
意図しない形で、判断を求められる場面が生じることも多い。

【3. 今後考えておきたい視点】
何が論点になるかを整理する視点を持つと、見通しが立てやすくなる。
状況そのものを俯瞰する考え方が役に立つ。
`,
  '回避不能層': `
【1. 現状の整理】
現在の状況は、相続に関する複数の要素が同時に関係する段階に入っている。
個人の意思とは別に、条件として整理が避けられない状態にある。

【2. 今のまま進んだ場合に起きやすいこと】
周囲の判断や感情が絡み、話が複雑になるケースがある。
時間が経つほど、軌道修正が難しくなる傾向が見られる。

【3. 今後考えておきたい視点】
何が既に決まっていて、何が決まっていないのかを分けて捉える視点が重要になる。
状況の構造を整理する意識が、後の混乱を減らす要因になる。
`
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const answers = await req.json();
  const score = calcScore(answers);
  const riskLevel = getRiskLevel(score);

  const family = [
    answers.spouse === 'いる' ? '配偶者あり' : '配偶者なし',
    answers.children === 'いる' ? '子あり' : '子なし'
  ].join('・');

  const assets = [];
  if (answers.realestate === 'ある') assets.push('不動産あり');
  if (answers.business === 'ある') assets.push('事業・自社株あり');
  if (!assets.length) assets.push('不動産・事業資産なし');

  /**
   * ダミー分岐（完全0円）
   */
  if (USE_DUMMY) {
    return new Response(
      JSON.stringify({
        text: DUMMY_TEXT[riskLevel],
        family,
        assets: assets.join('・'),
        age: answers.age
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * 本番用（将来使用・現在は非アクティブ）
   */
  return new Response(JSON.stringify({ error: 'API disabled' }), { status: 503 });
}