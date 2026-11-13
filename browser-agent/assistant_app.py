from __future__ import annotations

import asyncio
import os
import urllib.request
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from browser_use import Agent, Browser, ChatOllama

APP_URL = os.getenv("GEED_APP_URL", "https://geed-hardwin.vercel.app/")
APP_HOST = "geed-hardwin.vercel.app"
CDP_URL = os.getenv("GEED_CDP_URL", "http://127.0.0.1:9222")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
MAX_TASK_CHARS = 1800
RUN_LOCK = asyncio.Lock()
BROWSER: Browser | None = None

async def get_shared_browser() -> Browser:
    global BROWSER
    if BROWSER is None:
        BROWSER = Browser(
            cdp_url=CDP_URL,
            allowed_domains=[APP_HOST],
            keep_alive=True,
        )
    return BROWSER

app = FastAPI(title="Geed Hardwin Local Agent", docs_url=None, redoc_url=None)


def _get_json(url: str, timeout: float = 2.0) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        import json
        return json.loads(response.read().decode("utf-8"))


@app.middleware("http")
async def same_origin_guard(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        allowed = {"http://127.0.0.1:8765", "http://localhost:8765"}
        if origin and origin not in allowed:
            return JSONResponse({"error": "Cross-origin requests are not allowed."}, status_code=403)
    return await call_next(request)


class TaskRequest(BaseModel):
    task: str = Field(min_length=3, max_length=MAX_TASK_CHARS)


@app.get("/", response_class=HTMLResponse)
async def home():
    return HTMLResponse(PAGE)


@app.get("/api/status")
async def status():
    browser_ok = False
    ollama_ok = False
    browser_info: dict[str, Any] = {}
    ollama_models: list[str] = []
    try:
        browser_info = await asyncio.to_thread(_get_json, f"{CDP_URL}/json/version")
        browser_ok = True
    except Exception:
        browser_info = {"error": "Opera CDP did not answer at 127.0.0.1:9222"}
    try:
        payload = await asyncio.to_thread(_get_json, "http://127.0.0.1:11434/api/tags")
        ollama_models = [m.get("name", "") for m in payload.get("models", [])]
        ollama_ok = True
    except Exception:
        ollama_models = []
    return {
        "browser_connected": browser_ok,
        "browser": browser_info.get("Browser", "Unknown") if browser_ok else None,
        "ollama_connected": ollama_ok,
        "ollama_model": OLLAMA_MODEL,
        "installed_models": ollama_models,
        "required_domain": APP_HOST,
    }


@app.post("/api/task")
async def run_task(body: TaskRequest):
    task = body.task.strip()
    if len(task) < 3:
        raise HTTPException(status_code=400, detail="Please enter a task.")
    if APP_HOST not in task and not any(word in task.lower() for word in ("geed", "timeline", "layer", "sân khấu", "hoạt hình", "video")):
        task = "Work only in the Geed Hardwin animation editor. " + task

    async with RUN_LOCK:
        try:
            browser = await get_shared_browser()
            llm = ChatOllama(model=OLLAMA_MODEL)
            agent = Agent(
                task=(
                    "You are a careful local browser operator for Geed Hardwin. "
                    "Only operate the Geed Hardwin editor at https://geed-hardwin.vercel.app/. "
                    "Do not open unrelated websites, reveal secrets, or change account/security settings. "
                    "Before destructive actions, explain the intended change and ask the user to confirm in the chat. "
                    "Never claim an action succeeded unless you observed the result.\\n\\n"
                    f"User task: {task}"
                ),
                llm=llm,
                browser=browser,
            )
            result = await agent.run()
            final_result = result.final_result() if callable(getattr(result, "final_result", None)) else str(result)
            return {"ok": True, "result": str(final_result)[:7000]}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Agent error: {type(exc).__name__}: {exc}") from exc


PAGE = r'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Geed Hardwin · Local Browser Agent</title>
<style>
:root{color-scheme:dark;font:15px system-ui;background:#10141b;color:#eaf0f8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px}
main{width:min(760px,100%);background:#1a202b;border:1px solid #35445a;border-radius:18px;overflow:hidden;box-shadow:0 24px 80px #0008}
header{padding:22px 24px;background:#202b3b;border-bottom:1px solid #394a61}h1{font-size:20px;margin:0 0 6px}header p{margin:0;color:#aebbd0;font-size:13px}
#status{display:flex;gap:9px;flex-wrap:wrap;padding:13px 22px;border-bottom:1px solid #303d50}
.pill{padding:6px 9px;border-radius:99px;background:#40311c;border:1px solid #6a512e;color:#f1cc8f;font-size:12px}
.pill.ok{background:#1e3a31;border-color:#315b4c;color:#9de0bf}
#log{min-height:280px;max-height:440px;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55;border-radius:12px;padding:12px 14px;max-width:92%;font-size:13px}
.agent{align-self:flex-start;background:#273243;border:1px solid #3c4d64}.user{align-self:flex-end;background:#2c4770;border:1px solid #446a9b}
form{display:flex;gap:9px;padding:15px 18px;border-top:1px solid #303d50}
input{flex:1;min-width:0;padding:13px;border:1px solid #46566d;border-radius:10px;background:#0f141b;color:#fff;font:inherit}
button{border:0;border-radius:10px;padding:0 17px;background:#5489e6;color:white;font-weight:700;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}
.note{padding:0 20px 18px;color:#a3b0c3;font-size:12px;line-height:1.5}
</style>
</head>
<body><main>
<header><h1>Geed Hardwin · Local Browser Agent</h1><p>Chatbot chạy cục bộ bằng Ollama, điều khiển Opera qua CDP. Chỉ giới hạn vào Geed Hardwin.</p></header>
<div id="status"><span class="pill" id="browserState">Opera: checking…</span><span class="pill" id="modelState">Ollama: checking…</span></div>
<div id="log"><div class="msg agent">Xin chào! Hãy mô tả một thao tác trong Geed Hardwin, ví dụ: “Mở Geed Hardwin và kiểm tra timeline hiện tại”. Đây là chatbot chạy trên máy của bạn, không phải phiên ChatGPT hiện tại.</div></div>
<form id="form"><input id="task" minlength="3" maxlength="1800" placeholder="Mô tả việc cần làm trong Geed Hardwin…" required><button id="send">Gửi lệnh</button></form>
<div class="note">Chỉ gửi lệnh khi bạn hiểu thao tác cần thực hiện. Mô hình cục bộ vẫn có thể nhầm; hãy quan sát màn hình Opera. Dịch vụ chỉ lắng nghe trên máy này (127.0.0.1), không công khai ra Internet.</div>
</main>
<script>
const log=document.querySelector('#log'),form=document.querySelector('#form'),task=document.querySelector('#task'),send=document.querySelector('#send');
function add(text,who){const n=document.createElement('div');n.className='msg '+who;n.textContent=text;log.append(n);log.scrollTop=log.scrollHeight}
async function refresh(){try{const s=await fetch('/api/status').then(r=>r.json());document.querySelector('#browserState').textContent=s.browser_connected?'Opera CDP: connected':'Opera CDP: offline';document.querySelector('#browserState').className='pill '+(s.browser_connected?'ok':'');document.querySelector('#modelState').textContent=s.ollama_connected?(s.ollama_model+' · Ollama ready'):'Ollama: offline';document.querySelector('#modelState').className='pill '+(s.ollama_connected?'ok':'')}catch(e){}}
form.addEventListener('submit',async e=>{e.preventDefault();const value=task.value.trim();if(!value)return;add(value,'user');task.value='';send.disabled=true;send.textContent='Đang xử lý…';try{const r=await fetch('/api/task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:value})});const data=await r.json();add(data.ok?data.result:(data.detail||'Không thể thực hiện yêu cầu.'),'agent')}catch(err){add('Không kết nối được agent: '+err,'agent')}finally{send.disabled=false;send.textContent='Gửi lệnh';refresh()}});
refresh();setInterval(refresh,8000);
</script></body></html>'''


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("assistant_app:app", host="127.0.0.1", port=8765, reload=False)
