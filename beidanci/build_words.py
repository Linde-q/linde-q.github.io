# -*- coding: utf-8 -*-
"""把 words.txt 转成网页用的 words.js(词库更新后重新跑一次就行)

用法(在 web 目录下):
    python build_words.py                # 用上一层的 words.txt
    python build_words.py 另一个词库.txt   # 用指定的文件
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
# 常见位置: 网页文件夹里 / 上一层 / 上一层里的项目文件夹
CANDIDATES = [
    os.path.join(HERE, "words.txt"),
    os.path.join(PARENT, "words.txt"),
    os.path.join(PARENT, "背单词小助手", "words.txt"),
]


def decode(raw):
    """UTF-8(含 BOM) / GBK 自动识别"""
    for enc in ("utf-8-sig", "gbk"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8(replace)"


def main():
    if len(sys.argv) > 1:
        src = sys.argv[1]
    else:
        src = next((p for p in CANDIDATES if os.path.isfile(p)), "")
        if not src:
            print("找不到 words.txt, 请把词库路径当参数传进来, 例如:")
            print("    python build_words.py D:\\背单词小助手\\背单词小助手\\words.txt")
            sys.exit(1)
    with open(src, "rb") as fp:
        text, enc = decode(fp.read())
    data = {"name": os.path.basename(src), "encoding": enc, "text": text}
    # JSON 字符串本身也是合法的 JS 字符串
    js = "window.WORDS_SOURCE = " + json.dumps(data, ensure_ascii=False)
    js = js.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029") + ";\n"
    out = os.path.join(HERE, "words.js")
    with open(out, "w", encoding="utf-8") as fp:
        fp.write(js)
    print("%s -> %s (%d 行, %s)" % (src, out, len(text.splitlines()), enc))


if __name__ == "__main__":
    main()
