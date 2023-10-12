FROM ghcr.io/puppeteer/puppeteer:21.3.8

USER root
RUN mkdir -p /custom-profile
RUN chown -R node:node /custom-profile

ENV CHROMIUM_USER_DATA=/custom-profile
USER node

ENV CHROMIUM_USER_DATA=/custom-profile

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "start"]