FROM node:18-alpine

RUN mkdir -p /home/node/market_maker/node_modules && chown -R node:node /home/node/market_maker

WORKDIR /home/node/market_maker

COPY package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

RUN npm ci && npm run build

CMD ["npm", "run", "maker"]
