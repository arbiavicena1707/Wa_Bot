FROM node:20-slim

# Install dependency sistem yang dibutuhkan oleh Baileys / Canvas jika diperlukan
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependensi
RUN npm install --production

# Copy seluruh source code
COPY . .

# Port yang dibuka (Koyeb membaca port 8000 secara default)
ENV PORT=8000
EXPOSE 8000

# Jalankan bot
CMD ["node", "index.js"]
