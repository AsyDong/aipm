# ============ 预备级电子闪卡 PDF → public/img/fc/<no>.jpg ============
#
# 用法：python tools/cut-fc-pdf.py
# 前置：pip install pymupdf pillow；PDF 路径写死在 PDF_PATH（家长下载的课件）。
# 产物：115 张单词卡图，按卡片编号命名（1.jpg…115.jpg），最长边 384、白底 JPEG q82。
#
# PDF 结构（Power Up Start Smart 预备级闪卡，剑桥 2019）：
#   第 1-10 页  = 单元总览网格（Hello + Unit 1-9），跳过
#   第 11-129 页 = 每页一张放大卡片：左下角「编号 单词」、左上返回箭头、右上星星、右下版权
#   4 页重复素材跳过：29/30（Mrs/Mr Friendly 第二版）、43/44（man/woman 第二版）
# 裁剪框必须排除：箭头(y<420,x<160)、星星(x>1820,y<260)、底部文字行(y>2750)。

import os
import fitz
from PIL import Image

PDF_PATH = r'D:\Download\A作业\预备级电子闪卡.pdf'
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'img', 'fc')
SKIP_PAGES = {29, 30, 43, 44}  # 1-based 页码：重复素材
CROP = (170, 320, 1920, 2650)  # l, t, r, b（全分辨率 2091x2967）
MAX_SIDE = 384

# 页码 → 卡片编号（第 11 页 = 1 号卡，跳过重复页后顺序递增）
page_to_no = {}
no = 0
for page in range(11, 130):
    if page in SKIP_PAGES:
        continue
    no += 1
    page_to_no[page] = no
assert no == 115, no

os.makedirs(OUT_DIR, exist_ok=True)
doc = fitz.open(PDF_PATH)
total = 0
for page, card_no in page_to_no.items():
    pix = doc[page - 1].get_pixmap(matrix=fitz.Matrix(1.0, 1.0), clip=fitz.Rect(*CROP))
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    # 白底裁边：保留浅灰投影（<245），去掉四周留白
    gray = img.convert('L').point(lambda v: 0 if v > 245 else 255)
    bbox = gray.getbbox()
    if bbox:
        pad = 12
        l = max(0, bbox[0] - pad)
        t = max(0, bbox[1] - pad)
        img = img.crop((l, t, min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad)))
    w, h = img.size
    scale = MAX_SIDE / max(w, h)
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out = os.path.join(OUT_DIR, f'{card_no}.jpg')
    img.save(out, 'JPEG', quality=82)
    total += os.path.getsize(out)

print(f'{no} 张 → {OUT_DIR}，共 {total // 1024} KB')
