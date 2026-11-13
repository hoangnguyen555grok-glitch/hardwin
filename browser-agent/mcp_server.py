from __future__ import annotations

import os
from typing import Any

from mcp.server.fastmcp import FastMCP
from playwright.async_api import async_playwright

APP_URL = os.getenv("GEED_APP_URL", "https://geed-hardwin.vercel.app/")
APP_ORIGIN = "https://geed-hardwin.vercel.app"
CDP_URL = os.getenv("GEED_CDP_URL", "http://127.0.0.1:9222")

mcp = FastMCP("Geed Hardwin Control")


async def _call_editor_api(method: str, args: dict[str, Any] | None = None) -> Any:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.connect_over_cdp(CDP_URL)
        pages = [page for context in browser.contexts for page in context.pages]
        page = next((p for p in pages if p.url.startswith(APP_ORIGIN)), None)
        if page is None:
            raise RuntimeError(
                "No Geed Hardwin tab found in the connected Opera profile. "
                "Open https://geed-hardwin.vercel.app/ in the Opera window started by start_opera_debug.bat."
            )
        result = await page.evaluate(
            """({method, args}) => {
              const api = window["GeedHardwinBridge"];
              if (!api) throw new Error("The Geed Hardwin control API is not available. Reload the editor to v1.12 or newer.");
              const fn = api[method];
              if (typeof fn !== "function") throw new Error("Unsupported editor action: " + method);
              return fn(...(args || []));
            }""",
            {"method": method, "args": args or {}},
        )
        await playwright.stop()
        return result


@mcp.tool()
async def geed_get_status() -> dict[str, Any]:
    """Read the current Geed Hardwin scene, timeline, layer count and selection."""
    return await _call_editor_api("getStatus")


@mcp.tool()
async def geed_list_layers() -> list[dict[str, Any]]:
    """List visible Geed Hardwin layer metadata; does not read media contents."""
    return await _call_editor_api("listLayers")


@mcp.tool()
async def geed_create_circle(
    x: float = 640,
    y: float = 360,
    radius: float = 70,
    color: str = "#4d8ff0",
) -> dict[str, Any]:
    """Create one circle on the current stage with bounded size and color."""
    return await _call_editor_api(
        "createCircle",
        {"x": x, "y": y, "radius": radius, "color": color, "name": "MCP Circle"},
    )


@mcp.tool()
async def geed_animate_circle(
    duration_seconds: int = 10,
    from_x: float = 220,
    to_x: float = 1060,
    y: float = 360,
) -> dict[str, Any]:
    """Create a circle and animate it between two positions over the requested duration."""
    return await _call_editor_api(
        "animateCircle",
        {"durationSeconds": duration_seconds, "fromX": from_x, "toX": to_x, "y": y},
    )


@mcp.tool()
async def geed_play() -> dict[str, Any]:
    """Start playback of the current Geed Hardwin timeline."""
    return await _call_editor_api("play")


@mcp.tool()
async def geed_stop() -> dict[str, Any]:
    """Stop playback and return the timeline to frame zero."""
    return await _call_editor_api("stop")


@mcp.tool()
async def geed_set_frame(frame: int) -> dict[str, Any]:
    """Move the Geed Hardwin playhead to a specified frame."""
    return await _call_editor_api("setFrame", frame)


@mcp.tool()
async def geed_delete_selected_layers() -> dict[str, Any]:
    """Delete the currently selected layer(s). This is destructive; call only after explicit user approval."""
    return await _call_editor_api("deleteSelected")


@mcp.tool()
async def geed_export_video() -> dict[str, Any]:
    """Start exporting the current Geed Hardwin project. This creates a local download in Opera."""
    return await _call_editor_api("exportVideo")


if __name__ == "__main__":
    # Deliberately bind to loopback only. Do not expose this server publicly
    # until authentication is added and a trusted tunnel is configured.
    mcp.run(transport="streamable-http", host="127.0.0.1", port=8766)
