/* node selftest.js —— 检查解析 / 判分 / 错题本 / 选项逻辑(用例和 app.py --selftest 一致)
   用法: node selftest.js  (需要和 words.js / quiz.js 放在同一层) */
'use strict';
const assert = require('assert');

global.window = global;
require('./words.js');
const QB = require('./quiz.js');

// ---------- 词库解析 ----------
const words = QB.parseWords(window.WORDS_SOURCE.text);
console.log('词库:', window.WORDS_SOURCE.name, '共', words.length, '词');
assert.strictEqual(words.length, 591, '词数应该是 591');

const byChapter = {};
for (const w of words) { byChapter[w.chapter] = (byChapter[w.chapter] || 0) + 1; }
assert.deepStrictEqual(byChapter, { 1: 34, 2: 45, 3: 49, 4: 246, 5: 101, 6: 28, 7: 44, 8: 44 });
console.log('每章词数 OK:', JSON.stringify(byChapter));

const first = words[0];
assert.deepStrictEqual([first.en, first.zh, first.chapter], ['printed circuit', '印制电路', 1]);
assert.strictEqual(QB.chapterLabel(first), '第1章 综合词汇');
const withSection = words.find(w => w.section === '3.3');
assert.strictEqual(QB.chapterLabel(withSection), '第3章 设计 · 3.3 电气互连');
console.log('章节标签 OK');

// ---------- 判分 ----------
const w1 = { en: 'pad/land', zh: '焊盘/连接盘', chapter: 3, section: null };
assert.ok(QB.checkAnswer('zh2en', 'land', w1).ok);
assert.ok(QB.checkAnswer('zh2en', '  PAD ', w1).ok);
assert.ok(QB.checkAnswer('en2zh', '焊盘', w1).ok);
assert.ok(QB.checkAnswer('en2zh', '焊盘连接盘', w1).ok);
const w2 = { en: 'buried/blind via', zh: '埋/盲孔', chapter: 3, section: '3.3' };
assert.ok(QB.checkAnswer('en2zh', '盲孔', w2).ok);
assert.ok(QB.checkAnswer('en2zh', '埋盲孔', w2).ok);
assert.ok(!QB.checkAnswer('en2zh', '埋', w2).ok, '中文单字不算对');
const w3 = { en: 'resin flux', zh: '松香（保护层）焊剂', chapter: 6, section: null };
assert.ok(QB.checkAnswer('en2zh', '松香焊剂', w3).ok);
assert.ok(QB.checkAnswer('en2zh', '松香（保护层）焊剂', w3).ok);
assert.ok(!QB.checkAnswer('en2zh', '保护层', w3).ok);
const w4 = { en: 'AOI(automatic optical inspection)', zh: '自动光学检测', chapter: 7, section: null };
assert.ok(QB.checkAnswer('zh2en', 'aoi', w4).ok);
assert.ok(QB.checkAnswer('zh2en', 'automatic optical inspection', w4).ok);
assert.ok(!QB.checkAnswer('en2zh', '自动检测', w4).ok);
console.log('答案判定 OK');

// ---------- 出题 ----------
const qs = QB.makeQuestions(words, 10, 'random');
assert.strictEqual(qs.length, 10);
assert.strictEqual(new Set(qs.map(q => q.word.en)).size, 10, '一轮里不该出现重复词');
assert.ok(qs.every(q => ['en2zh', 'zh2en'].indexOf(q.direction) >= 0));
assert.ok(qs.every(q => q.prompt && q.answer));
assert.strictEqual(QB.makeQuestions(words.slice(0, 3), 10, 'en2zh').length, 3, '词不够时按实际数量出题');
assert.strictEqual(QB.pickPool(words, null).length, 591);
assert.strictEqual(QB.pickPool(words, [1]).length, 34);
console.log('出题 OK');

// ---------- 错题本 + 选项(用假的 localStorage) ----------
function fakeStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}
const store = fakeStore();
const wb = new QB.WrongBook(store);
assert.strictEqual(wb.record(w1, false).state, 'added');
assert.strictEqual(wb.record(w1, true).state, 'ok');
assert.strictEqual(wb.record(w1, false).state, 'reset');
let last = null;
for (let i = 0; i < 5; i++) { last = wb.record(w1, true); }
assert.strictEqual(last.state, 'removed');
assert.strictEqual(wb.size(), 0);

const wb2 = new QB.WrongBook(store);
wb2.record(w2, false);
const wb3 = new QB.WrongBook(store);
assert.strictEqual(wb3.size(), 1, '错题本要能存下来');
assert.deepStrictEqual(wb3.list()[0].key, ['buried/blind via', '埋/盲孔', 3, '3.3']);
wb3.clear();
assert.strictEqual(new QB.WrongBook(store).size(), 0);

const st = new QB.Settings(store);
assert.deepStrictEqual(st.data, { direction: 'random', count: 10, source: 'all', chapters: null });
st.set({ direction: 'en2zh', count: 20, source: 'wrong', chapters: [1, 4] });
assert.deepStrictEqual(new QB.Settings(store).data,
  { direction: 'en2zh', count: 20, source: 'wrong', chapters: [1, 4] });
store.setItem('beidanci.v1.settings', '{"count":999,"chapters":"坏数据"}');
assert.strictEqual(new QB.Settings(store).data.count, 10, '坏数据要回落到默认值');
console.log('错题本 / 选项 OK');

// ---------- 自己导入的词库 ----------
const custom = '1.测试-\nhello\t你好\nworld\t世界\n';
assert.strictEqual(QB.parseWords(custom).length, 2);
assert.strictEqual(QB.parseWords('乱码没有章节也没有tab').length, 0);
QB.saveCustomWords(store, { name: 'my.txt', text: custom });
assert.strictEqual(QB.loadCustomWords(store).name, 'my.txt');
QB.clearCustomWords(store);
assert.strictEqual(QB.loadCustomWords(store), null);
assert.strictEqual(QB.decodeBytes(new Uint8Array([0x68, 0x69]).buffer), 'hi');
assert.strictEqual(QB.decodeBytes(new Uint8Array([0xD6, 0xD0, 0xCE, 0xC4]).buffer), '中文');
console.log('导入词库 OK');

console.log('SELFTEST OK');
