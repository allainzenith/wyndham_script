FROM ghcr.io/puppeteer/puppeteer:21.3.8

ENV CHROMIUM_USER_DATA=.config/chrome_profile

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY ./config/jsons/token.json /usr/src/app/config/jsons/token.json

RUN chown node:node /usr/src/app/config/jsons/token.json

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]