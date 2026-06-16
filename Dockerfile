FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY api-server.js .

EXPOSE 3000

CMD ["node", "api-server.js"]
