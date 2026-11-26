"""Local-only CORS gateway for the upstream VieNeu-TTS OpenAI-compatible API.

The model and synthesis remain on this computer. The upstream speech API is reused;
this wrapper only adds an exact-origin CORS allowlist and enforces loopback binding.
"""
from __future__ import annotations

import logging
import os
import sys

from fastapi.middleware.cors import CORSMiddleware

# The vieneu PyPI distribution includes the upstream API module.
from apps.openai_speech import app, main as run_upstream_server

log = logging.getLogger("geed-audio-engine")


def allowed_origins() -> list[str]:
    raw = os.environ.get("GEED_AUDIO_ORIGINS", "")
    origins = [item.strip().rstrip("/") for item in raw.replace(";", ",").split(",")]
    return [item for item in origins if item]


def configure_cors() -> None:
    origins = allowed_origins()
    if not origins:
        raise RuntimeError(
            "GEED_AUDIO_ORIGINS is required. Set it to the exact Geed website origin "
            "(for example https://your-geed-site.pages.dev). Do not use a wildcard."
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Request-Id", "X-Sample-Rate", "Retry-After"],
        max_age=600,
    )
    log.info("Geed audio CORS allowlist: %s", ", ".join(origins))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    configure_cors()

    # Never expose a local speech service to the LAN or public network.
    os.environ["HOST"] = "127.0.0.1"
    os.environ.setdefault("PORT", "8000")

    log.info("Starting VieNeu-TTS locally at http://127.0.0.1:%s", os.environ["PORT"])
    log.info("Text and generated audio are processed on this computer.")
    run_upstream_server()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise
    except Exception as exc:
        print(f"Geed audio engine could not start: {exc}", file=sys.stderr)
        raise
