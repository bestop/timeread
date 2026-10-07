#!/bin/bash
# timeread 端到端验证：冷启动种子 → API 冒烟 → agent-browser UI 自检
cd /home/z/my-project
SHOTS=/home/z/my-project/scripts/verify-shots
mkdir -p "$SHOTS"

pkill -f "next dev" 2>/dev/null
sleep 1
rm -f db/custom.db db/custom.db-journal

echo "===== 1. 启动 dev server ====="
setsid nohup bun run dev >/dev/null 2>&1 </dev/null &
UP=0
for i in $(seq 1 60); do
  if curl -s -m 2 -o /dev/null http://localhost:3000/; then UP=1; break; fi
  sleep 1
done
[ "$UP" = "1" ] && echo "server UP" || { echo "server FAILED"; exit 1; }

echo "===== 2. API 冒烟 ====="
echo "--- 冷启动种子（quotes 触发 ensureSeeded）---"
curl -s -o /dev/null -w "quotes -> %{http_code} (%{time_total}s)\n" http://localhost:3000/api/quotes
echo "--- 背景列表 ---"
curl -s http://localhost:3000/api/backgrounds | python3 -c "import sys,json;d=json.load(sys.stdin);print('bg count:',len(d['items']),'| first:',d['items'][0]['label'],d['items'][0]['id'])"
echo "--- 背景图片流（读库）---"
curl -s -o /dev/null -w "bg image -> %{http_code} (%{size_download}B)\n" http://localhost:3000/api/backgrounds/preset-bg-1/image
echo "--- 上传 1 张（入库）---"
UPID=$(curl -s -X POST -F "files=@storage/bg/preset_0_1791344466519.jpg" http://localhost:3000/api/backgrounds | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['created'][0]['id'] if d.get('created') else 'FAIL')")
echo "uploaded id: $UPID"
curl -s -o /dev/null -w "uploaded image stream -> %{http_code} (%{size_download}B)\n" "http://localhost:3000/api/backgrounds/$UPID/image"
echo "--- 当日日签首次合成 ---"
curl -s -o /dev/null -w "card-image -> %{http_code} (%{size_download}B, %{time_total}s)\n" "http://localhost:3000/api/card-image"
echo "--- 二次访问（读库直出）---"
curl -s -o /dev/null -w "card-image -> %{http_code} (%{time_total}s)\n" "http://localhost:3000/api/card-image"
echo "--- 换一换 ---"
curl -s -X POST http://localhost:3000/api/daily/regenerate -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('variant:',d['variant'],'| bg:',d['backgroundLabel'])"
echo "--- 往期 ---"
curl -s http://localhost:3000/api/daily/history | python3 -c "import sys,json;print('history items:',len(json.load(sys.stdin)['items']))"

echo "===== 3. agent-browser UI 自检 ====="
which agent-browser >/dev/null 2>&1 || { echo "agent-browser NOT installed"; exit 1; }
agent-browser open http://localhost:3000/ 2>&1 | tail -1
agent-browser wait --load networkidle 2>&1 | tail -1
sleep 2
agent-browser screenshot "$SHOTS/01-today-desktop.png" 2>&1 | tail -1
echo "--- 今日页快照（前 25 行）---"
agent-browser snapshot -i 2>&1 | head -25
echo "--- 切到背景库 ---"
agent-browser find text "背景库" click 2>&1 | tail -1
sleep 2
agent-browser screenshot "$SHOTS/02-backgrounds.png" 2>&1 | tail -1
echo "--- 切到文字库 ---"
agent-browser find text "文字库" click 2>&1 | tail -1
sleep 1.5
echo "--- 通过 UI 新增文案 ---"
agent-browser find label "正文" fill "风起于青萍之末，浪成于微澜之间。【慢慢走】，欣赏啊。~~山高路远~~，看世界，也找自己。" 2>&1 | tail -1
agent-browser find text "存入文字库" click 2>&1 | tail -1
sleep 2
agent-browser screenshot "$SHOTS/03-quotes-added.png" 2>&1 | tail -1
echo "--- 切到往期 ---"
agent-browser find text "往期回顾" click 2>&1 | tail -1
sleep 2
agent-browser screenshot "$SHOTS/04-history.png" 2>&1 | tail -1
echo "--- 移动端 390x844 今日页 ---"
agent-browser set viewport 390 844 2>&1 | tail -1
agent-browser find text "今日日签" click 2>&1 | tail -1
sleep 2
agent-browser screenshot "$SHOTS/05-today-mobile.png" 2>&1 | tail -1
echo "--- console 与页面错误 ---"
echo "CONSOLE:"; agent-browser console 2>&1 | grep -v "^\[" | head -8
echo "ERRORS:"; agent-browser errors 2>&1 | head -8
agent-browser close 2>&1 | tail -1

echo "===== 4. 清理测试数据 ====="
curl -s -X DELETE "http://localhost:3000/api/backgrounds/$UPID" | head -c 60; echo
QID=$(curl -s http://localhost:3000/api/quotes | python3 -c "import sys,json;d=json.load(sys.stdin);items=[i for i in d['items'] if '青萍之末' in i['content']];print(items[0]['id'] if items else '')")
[ -n "$QID" ] && curl -s -X DELETE "http://localhost:3000/api/quotes/$QID" | head -c 40 && echo
echo "DONE"
