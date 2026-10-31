FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ANYRB_PORT=8787

WORKDIR /workspace
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY index.html ./index.html
COPY server ./server
COPY app ./app

EXPOSE 8787
CMD ["python", "-m", "server.app", "--host", "0.0.0.0", "--port", "8787"]
