FROM python:3.12-slim
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install uv
ARG LLAMA_CPP_VERSION=b11815
ARG PARLOR_REF=da1ddf1f3e1a7ea04f69df24e98541ab5c402ccf
RUN python - <<'PY'
import os, pathlib, tarfile, urllib.request, time

def fetch(url, path):
    for attempt in range(6):
        try:
            urllib.request.urlretrieve(url, path)
            return
        except Exception:
            if attempt == 5: raise
            time.sleep(2 ** attempt)

version = os.environ.get("LLAMA_CPP_VERSION", "b11815")
llama = "/tmp/llama.tar.gz"
fetch(f"https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-ubuntu-x64.tar.gz", llama)
with tarfile.open(llama, "r:gz") as archive:
    archive.extractall("/opt/llama")
binary = next(pathlib.Path("/opt/llama").rglob("llama-server"))
pathlib.Path("/usr/local/bin/llama-server").symlink_to(binary)
pathlib.Path(llama).unlink()

ref = os.environ.get("PARLOR_REF", "da1ddf1f3e1a7ea04f69df24e98541ab5c402ccf")
parlor = "/tmp/parlor.tar.gz"
fetch(f"https://github.com/fikrikarim/parlor/archive/{ref}.tar.gz", parlor)
with tarfile.open(parlor, "r:gz") as archive:
    root = archive.getmembers()[0].name.split("/")[0]
    archive.extractall("/opt")
pathlib.Path("/opt", root).rename("/opt/parlor")
pathlib.Path(parlor).unlink()
PY

# Keep the executable beside its release shared libraries, and fail the build
# if the loader cannot resolve them. The UI can start while models warm up;
# /health/ready and WebSockets require the complete model pipeline.
RUN llama-server --version
COPY patch_server.py /opt/easyjob/patch_server.py
RUN python /opt/easyjob/patch_server.py /opt/parlor/src/parlor/server.py
RUN python /opt/easyjob/patch_server.py --llama /opt/parlor/src/parlor/llama.py
RUN cd /opt/parlor && uv sync --frozen --no-dev
WORKDIR /opt/parlor
ENV PATH="/opt/parlor/.venv/bin:/usr/local/bin:${PATH}" PORT=8000 MODEL=e2b
EXPOSE 8000
# Parlor defaults to localhost for direct local use. In the stack it sits
# behind Caddy, so bind the internal interface and expose HTTPS publicly.
CMD ["uv", "run", "uvicorn", "parlor.server:app", "--host", "0.0.0.0", "--port", "8000"]
