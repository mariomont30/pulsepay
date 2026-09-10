FROM node:20-alpine

# OpenSSL é exigido pelo engine do Prisma em tempo de execução no Alpine
# (musl). Sem isso o container falha com "Error loading shared library
# libssl.so.1.1/libssl.so.3: No such file or directory".
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm install prisma --no-save

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]
