# =====================================================================
#  Dockerfile — image produksi untuk aplikasi undangan (Node.js 22).
#  Node 22 dipakai karena proyek memakai `node:sqlite` bawaan (>= 22.5).
#
#  Build:  docker build -t undangan .
#  Run  :  docker run -p 3000:3000 -v undangan-data:/data \
#            -e DATABASE_PATH=/data/wedding.db undangan
# =====================================================================
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# 1) Pasang dependensi dulu (cache layer lebih baik).
COPY package*.json ./
RUN npm install --omit=dev

# 2) Salin kode aplikasi.
COPY . .

# 3) Direktori data untuk SQLite (di-mount sebagai volume di produksi).
RUN mkdir -p /data
ENV DATABASE_PATH=/data/wedding.db

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
