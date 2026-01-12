FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/build ./build
COPY --from=builder /app/dist ./dist
COPY server.js ./

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.js"]
