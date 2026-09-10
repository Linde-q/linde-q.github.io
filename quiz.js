/* 背单词小助手 —— 核心逻辑(桌面版 app.py 的网页移植)
   这里只放纯逻辑, 界面在 index.html, 词库数据在 words.js
   浏览器里挂到 window.QB, node 里可以 require 出来做测试 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (root) { root.QB = api; }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONSECUTIVE_TO_REMOVE = 5;   // 连续答对几次后移出错题本
  const DIRECTIONS = ['random', 'en2zh', 'zh2en'];
  const COUNTS = [5, 10, 20, 50];
  const SOURCES = ['all', 'wrong'];

  const DIRECTION_LABELS = { random: '🎲 随机方向', en2zh: '🔤 英 → 中', zh2en: '🀄 中 → 英' };
  const SOURCE_LABELS = { all: '🌏 全部单词', wrong: '📖 只看错题' };

  const HEADER_RE = /^(.*?)(\d+(?:\.\d+)?)[.．]?(.*?)[\-–— ]*$/;
  const TRIM_CHARS = '。．.!！?？~～;；,，、';

  // ---------- 词库解析(和 app.py 的 parse_words 一致) ----------
  function parseWords(text) {
    const words = [];
    let chapter = null, chapterName = '', section = null, sectionTitle = '';
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { continue; }
      if (line.indexOf('\t') >= 0) {
        const parts = line.split('\t').map(p => p.trim()).filter(p => p);
        if (parts.length >= 2 && chapter) {
          const en = parts[0], zh = parts[parts.length - 1];
          if (en && zh) { words.push({ en: en, zh: zh, chapter: chapter,
                                       chapterName: chapterName,
                                       section: section, sectionTitle: sectionTitle }); }
        }
      } else {
        const m = HEADER_RE.exec(line);
        if (!m) { continue; }
        const topic = m[1].trim(), num = m[2], title = m[3].trim();
        const top = parseInt(num.split('.')[0], 10);
        if (num.indexOf('.') >= 0) {
          chapter = top; chapterName = topic; section = num; sectionTitle = title;
        } else {
          chapter = top; chapterName = title; section = null; sectionTitle = '';
        }
      }
    }
    return words;
  }

  function wordKey(w) {
    return JSON.stringify([w.en, w.zh, w.chapter, w.section || '']);
  }

  function chapterLabel(w) {
    return w.sectionTitle
      ? '第' + w.chapter + '章 ' + w.chapterName + ' · ' + w.section + ' ' + w.sectionTitle
      : '第' + w.chapter + '章 ' + w.chapterName;
  }

  function chapterList(words) {
    const map = new Map();
    for (const w of words) {
      let e = map.get(w.chapter);
      if (!e) { e = { chapter: w.chapter, names: new Set(), count: 0 }; map.set(w.chapter, e); }
      e.names.add(w.chapterName);
      e.count += 1;
    }
    return Array.from(map.values())
      .sort((a, b) => a.chapter - b.chapter)
      .map(e => ({ chapter: e.chapter, name: Array.from(e.names).sort().join('/'), count: e.count }));
  }

  // ---------- 答案判定(宽松) ----------
  function norm(s) {
    return String(s).normalize('NFKC').toLowerCase()
      .replace(/\s+/g, '')
      .replace(/^[。．.!！?？~～;；,，、]+/, '')
      .replace(/[。．.!！?？~～;；,，、]+$/, '');
  }

  function stripParens(s) {
    let out = '', depth = 0;
    for (const ch of s) {
      if (ch === '(') { depth += 1; }
      else if (ch === ')') { depth = Math.max(0, depth - 1); }
      else if (depth === 0) { out += ch; }
    }
    return out;
  }

  function parenGroups(s) {
    const groups = [], chars = Array.from(s);
    let depth = 0, start = null;
    chars.forEach((ch, i) => {
      if (ch === '(') {
        if (depth === 0) { start = i + 1; }
        depth += 1;
      } else if (ch === ')') {
        depth -= 1;
        if (depth === 0 && start !== null) { groups.push(chars.slice(start, i).join('')); }
      }
    });
    return groups;
  }

  function answerVariants(text, isZh) {
    const s = norm(text);
    const base = stripParens(s);
    const variants = new Set([s, base, base.split('/').join('')]);
    if (!isZh) {                                  // 英文: 括号里的全称也算对
      for (const g of parenGroups(s)) {
        variants.add(g);
        variants.add(stripParens(g));
      }
    }
    for (let part of base.split(/[/,，、;；]/)) {  // 斜杠/逗号分隔的多种写法
      part = part.trim();
      if (part && (!isZh || Array.from(part).length >= 2)) { variants.add(part); }
    }
    const out = new Set();
    for (const v of variants) { if (v) { out.add(v); } }
    return out;
  }

  function checkAnswer(direction, typed, word) {
    const t = norm(typed);
    if (direction === 'zh2en') {
      return { ok: answerVariants(word.en, false).has(t), answer: word.en };
    }
    return { ok: answerVariants(word.zh, true).has(t), answer: word.zh };
  }

  // ---------- 出题 ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeQuestions(pool, count, direction) {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    return picked.map(w => {
      const d = direction === 'random'
        ? (Math.random() < 0.5 ? 'en2zh' : 'zh2en')
        : direction;
      return { word: w, direction: d,
               prompt: d === 'en2zh' ? w.en : w.zh,
               answer: d === 'en2zh' ? w.zh : w.en };
    });
  }

  function pickPool(words, chapterSet) {
    if (!chapterSet) { return words.slice(); }
    const set = typeof chapterSet.has === 'function' ? chapterSet : new Set(chapterSet);
    return words.filter(w => set.has(w.chapter));
  }

  // ---------- 错题本(存浏览器本地) ----------
  const WB_KEY = 'beidanci.v1.wrongbook';

  function WrongBook(store) {
    this.store = store;
    this.entries = new Map();
    this.load();
  }

  WrongBook.prototype.load = function () {
    this.entries = new Map();
    let data = null;
    try { data = JSON.parse(this.store.getItem(WB_KEY) || 'null'); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.entries)) { return; }
    for (const it of data.entries) {
      if (!Array.isArray(it.key)) { continue; }
      this.entries.set(JSON.stringify(it.key), {
        key: it.key, wrong: parseInt(it.wrong, 10) || 0, streak: parseInt(it.streak, 10) || 0,
      });
    }
  };

  WrongBook.prototype.save = function () {
    try {
      this.store.setItem(WB_KEY, JSON.stringify(
        { version: 2, entries: Array.from(this.entries.values()) }));
    } catch (e) { /* 存不了也不影响用 */ }
  };

  WrongBook.prototype.size = function () { return this.entries.size; };

  WrongBook.prototype.record = function (word, correct) {
    const k = wordKey(word);
    const e = this.entries.get(k);
    if (correct) {
      if (!e) { return { state: 'ok', streak: 0 }; }
      e.streak += 1;
      if (e.streak >= CONSECUTIVE_TO_REMOVE) {
        this.entries.delete(k);
        this.save();
        return { state: 'removed', streak: CONSECUTIVE_TO_REMOVE };
      }
      this.save();
      return { state: 'ok', streak: e.streak };
    }
    const first = !e;
    const cur = e || { key: JSON.parse(k), wrong: 0, streak: 0 };
    cur.wrong += 1;
    cur.streak = 0;
    this.entries.set(k, cur);
    this.save();
    return { state: first ? 'added' : 'reset', streak: 0 };
  };

  WrongBook.prototype.list = function () { return Array.from(this.entries.values()); };

  WrongBook.prototype.clear = function () { this.entries.clear(); this.save(); };

  // 错题本里的词(按答错次数排序, 找不到原文的跳过)
  WrongBook.prototype.words = function (wordByKey) {
    const out = [];
    for (const e of this.list()) {
      const w = wordByKey.get(JSON.stringify(e.key));
      if (w) { out.push({ word: w, wrong: e.wrong, streak: e.streak }); }
    }
    return out.sort((a, b) => b.wrong - a.wrong);
  };

  // ---------- 选项(存浏览器本地, 所以来回切页面不会丢) ----------
  const SETTINGS_KEY = 'beidanci.v1.settings';

  function Settings(store) {
    this.store = store;
    this.data = { direction: 'random', count: 10, source: 'all', chapters: null };
    this.load();
  }

  Settings.prototype.load = function () {
    let d = null;
    try { d = JSON.parse(this.store.getItem(SETTINGS_KEY) || 'null'); } catch (e) { d = null; }
    if (d && typeof d === 'object') {
      if (DIRECTIONS.indexOf(d.direction) >= 0) { this.data.direction = d.direction; }
      if (COUNTS.indexOf(d.count) >= 0) { this.data.count = d.count; }
      if (SOURCES.indexOf(d.source) >= 0) { this.data.source = d.source; }
      if (Array.isArray(d.chapters)) {
        this.data.chapters = d.chapters.filter(c => typeof c === 'number');
      } else if (d.chapters === null) {
        this.data.chapters = null;
      }
    }
  };

  Settings.prototype.save = function () {
    try { this.store.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch (e) { /* 忽略 */ }
  };

  Settings.prototype.set = function (patch) {
    Object.assign(this.data, patch);
    this.save();
  };

  // ---------- 自己导入的词库(可选, 存在浏览器里) ----------
  const WORDS_KEY = 'beidanci.v1.words';

  function loadCustomWords(store) {
    try {
      const d = JSON.parse(store.getItem(WORDS_KEY) || 'null');
      if (d && typeof d.text === 'string') { return d; }
    } catch (e) { /* 忽略 */ }
    return null;
  }

  function saveCustomWords(store, obj) {
    try { store.setItem(WORDS_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  function clearCustomWords(store) {
    try { store.removeItem(WORDS_KEY); } catch (e) { /* 忽略 */ }
  }

  // 按 UTF-8 / GBK 解码导入的文件(先用严格模式解码, 失败了才换下一种, 和 app.py 一致)
  function decodeBytes(buf, forced) {
    const tryList = forced ? [forced] : ['utf-8', 'gbk'];
    for (const enc of tryList) {
      try { return new TextDecoder(enc, { fatal: true }).decode(buf); }
      catch (e) { /* 换下一种 */ }
    }
    return new TextDecoder('utf-8').decode(buf);
  }

  return {
    CONSECUTIVE_TO_REMOVE: CONSECUTIVE_TO_REMOVE,
    DIRECTIONS: DIRECTIONS, COUNTS: COUNTS, SOURCES: SOURCES,
    DIRECTION_LABELS: DIRECTION_LABELS, SOURCE_LABELS: SOURCE_LABELS,
    parseWords: parseWords, wordKey: wordKey, chapterLabel: chapterLabel, chapterList: chapterList,
    norm: norm, stripParens: stripParens, parenGroups: parenGroups,
    answerVariants: answerVariants, checkAnswer: checkAnswer,
    makeQuestions: makeQuestions, pickPool: pickPool, shuffle: shuffle,
    WrongBook: WrongBook, Settings: Settings,
    loadCustomWords: loadCustomWords, saveCustomWords: saveCustomWords,
    clearCustomWords: clearCustomWords, decodeBytes: decodeBytes,
  };
}));
